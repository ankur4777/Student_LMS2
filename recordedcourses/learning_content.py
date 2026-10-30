"""Tenant-scoped authoring API for the optional MySLS Learning Center.

Legacy purchased-course APIs are deliberately separate. The organization
master switch is enforced before any read or mutation performed here.
"""

import mimetypes

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import TeacherProfile
from .learning_access import OrganizationLearningEnabled
from .models import (
    RecordedCourse, RecordedLesson, CourseModule, ModuleResource,
    TeacherCourseAssignment,
)


def _authorized_courses(user):
    if user.role == "college_admin":
        return RecordedCourse.objects.filter(organization=user.organization)
    if user.role == "teacher":
        return RecordedCourse.objects.filter(
            organization=user.organization,
            teacher_course_assignments__teacher__user=user,
            teacher_course_assignments__is_active=True,
        ).distinct()
    return RecordedCourse.objects.none()


def _course(user, course_id):
    return get_object_or_404(_authorized_courses(user), pk=course_id)


def _module(user, module_id):
    return get_object_or_404(
        CourseModule.objects.select_related("course").filter(
            course__in=_authorized_courses(user)
        ), pk=module_id,
    )


def _error(exc):
    if isinstance(exc, ValidationError):
        return Response({"detail": "; ".join(exc.messages)}, status=400)
    return Response({"detail": "A duplicate position or invalid reference was supplied."}, status=400)


def _int(value, field):
    if isinstance(value, bool):
        raise ValidationError({field: "Must be a positive whole number."})
    try:
        result = int(value)
    except (ValueError, TypeError):
        raise ValidationError({field: "Must be a positive whole number."})
    if str(result) != str(value).strip() or result <= 0:
        raise ValidationError({field: "Must be a positive whole number."})
    return result


def _module_data(module):
    return {
        "id": module.pk, "course_id": module.course_id,
        "title": module.title, "description": module.description,
        "position": module.position, "is_published": module.is_published,
        "lesson_count": module.lessons.count(),
        "resource_count": module.resources.count(),
    }


def _resource_data(resource):
    # Do not return private path, file URL, or storage filename.
    return {
        "id": resource.pk, "module_id": resource.module_id,
        "title": resource.title, "kind": resource.kind,
        "created_at": resource.created_at,
    }


def _lesson_data(lesson):
    # Video is retrieved only through existing protected playback APIs.
    return {
        "id": lesson.pk, "title": lesson.title,
        "description": lesson.description, "position": lesson.position,
        "module_id": lesson.module_id, "is_active": lesson.is_active,
    }


class ManagedLearningCoursesAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request):
        if request.user.role not in ("college_admin", "teacher"):
            return Response({"detail": "Only assigned teachers and college admins can manage courses."}, status=403)
        courses = _authorized_courses(request.user).order_by("title", "id")
        return Response({"courses": [
            {"id": c.pk, "title": c.title, "description": c.description,
             "module_count": c.modules.count(), "lesson_count": c.lessons.count()}
            for c in courses
        ]})


class ManagedCourseModulesAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request, course_id):
        course = _course(request.user, course_id)
        return Response({
            "course": {"id": course.pk, "title": course.title},
            "modules": [_module_data(m) for m in course.modules.all()],
        })

    def post(self, request, course_id):
        course = _course(request.user, course_id)
        title = str(request.data.get("title", "")).strip()
        if not title or len(title) > 180:
            return Response({"detail": "Title must contain 1–180 characters."}, status=400)
        try:
            position = _int(request.data.get("position"), "position")
            description = str(request.data.get("description", "")).strip()
            if len(description) > 12000:
                raise ValidationError("Description is too long.")
            with transaction.atomic():
                module = CourseModule.objects.create(
                    course=course, title=title, description=description,
                    position=position, is_published=False,
                )
        except (ValidationError, IntegrityError) as exc:
            return _error(exc)
        return Response({"module": _module_data(module)}, status=201)


class ManagedModuleDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def patch(self, request, module_id):
        module = _module(request.user, module_id)
        fields = request.data
        if not isinstance(fields, dict):
            return Response({"detail": "Provide an object of module fields."}, status=400)
        if "is_published" in fields and request.user.role != "college_admin":
            return Response({"detail": "Only a college admin can publish a module."}, status=403)
        allowed = {"title", "description", "position", "is_published"}
        if not fields or set(fields) - allowed:
            return Response({"detail": "Unknown or empty module update."}, status=400)
        try:
            if "title" in fields:
                value = str(fields["title"]).strip()
                if not value or len(value) > 180:
                    raise ValidationError("Title must contain 1–180 characters.")
                module.title = value
            if "description" in fields:
                value = str(fields["description"]).strip()
                if len(value) > 12000:
                    raise ValidationError("Description is too long.")
                module.description = value
            if "position" in fields:
                module.position = _int(fields["position"], "position")
            if "is_published" in fields:
                if type(fields["is_published"]) is not bool:
                    raise ValidationError("is_published must be true or false.")
                module.is_published = fields["is_published"]
            with transaction.atomic():
                module.save()
        except (ValidationError, IntegrityError) as exc:
            return _error(exc)
        return Response({"module": _module_data(module)})


class ManagedModuleResourcesAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, module_id):
        module = _module(request.user, module_id)
        return Response({"resources": [_resource_data(r) for r in module.resources.all()]})

    def post(self, request, module_id):
        module = _module(request.user, module_id)
        title = str(request.data.get("title", "")).strip()
        kind = str(request.data.get("kind", "notes"))
        upload = request.FILES.get("file")
        if not title or len(title) > 180 or kind not in ModuleResource.Kind.values or not upload:
            return Response({"detail": "A valid title, resource type and file are required."}, status=400)
        resource = ModuleResource(
            module=module, title=title, kind=kind,
            file=upload, uploaded_by=request.user,
        )
        try:
            resource.full_clean()
            resource.save()
        except (ValidationError, IntegrityError) as exc:
            return _error(exc)
        return Response({"resource": _resource_data(resource)}, status=201)


class ManagedResourceDownloadAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request, resource_id):
        resource = get_object_or_404(
            ModuleResource.objects.select_related("module__course").filter(
                module__course__in=_authorized_courses(request.user)
            ), pk=resource_id,
        )
        try:
            handle = resource.file.open("rb")
        except (FileNotFoundError, OSError):
            return Response({"detail": "File not available."}, status=404)
        extension = resource.file.name.rsplit(".", 1)[-1].lower()
        content_type = mimetypes.guess_type("resource." + extension)[0] or "application/octet-stream"
        response = FileResponse(handle, as_attachment=True,
                                filename="resource." + extension,
                                content_type=content_type)
        response["Cache-Control"] = "no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class ManagedCourseTeachersAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request, course_id):
        if request.user.role != "college_admin":
            return Response({"detail": "Only college admins can assign course teachers."}, status=403)
        course = _course(request.user, course_id)
        return Response({
            "teachers": [
                {"teacher_id": a.teacher_id, "teacher_name": str(a.teacher),
                 "is_active": a.is_active}
                for a in course.teacher_course_assignments.select_related("teacher__user").all()
            ],
            "available_teachers": [
                {"teacher_id": t.pk, "teacher_name": str(t)}
                for t in TeacherProfile.objects.filter(
                    user__organization=course.organization, user__role="teacher",
                    user__is_active=True,
                ).select_related("user").order_by("user__first_name", "pk")[:500]
            ],
        })

    def post(self, request, course_id):
        if request.user.role != "college_admin":
            return Response({"detail": "Only college admins can assign course teachers."}, status=403)
        course = _course(request.user, course_id)
        try:
            teacher_id = _int(request.data.get("teacher_id"), "teacher_id")
        except ValidationError as exc:
            return _error(exc)
        teacher = get_object_or_404(
            TeacherProfile.objects.filter(
                user__organization=course.organization, user__is_active=True,
                user__role="teacher"
            ), pk=teacher_id,
        )
        if type(request.data.get("is_active", True)) is not bool:
            return Response({"detail": "is_active must be true or false."}, status=400)
        with transaction.atomic():
            assignment, _ = TeacherCourseAssignment.objects.update_or_create(
                course=course, teacher=teacher,
                defaults={"is_active": request.data.get("is_active", True), "assigned_by": request.user},
            )
        return Response({"teacher_id": assignment.teacher_id, "is_active": assignment.is_active})


class ManagedModuleLessonsAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, module_id):
        module = _module(request.user, module_id)
        return Response({"lessons": [_lesson_data(l) for l in module.lessons.all()]})

    def post(self, request, module_id):
        module = _module(request.user, module_id)
        title = str(request.data.get("title", "")).strip()
        video = request.FILES.get("video")
        if not title or len(title) > 180 or not video:
            return Response({"detail": "Title and video are required."}, status=400)
        try:
            with transaction.atomic():
                # Lesson ordering remains course-wide for legacy compatibility.
                position = (RecordedLesson.objects.filter(course=module.course).aggregate(
                    last=Max("position"))["last"] or 0) + 1
                lesson = RecordedLesson(
                    course=module.course, module=module, title=title,
                    description=str(request.data.get("description", "")).strip(),
                    position=position, video=video, is_active=True,
                )
                lesson.full_clean()
                lesson.save()
        except (ValidationError, IntegrityError) as exc:
            return _error(exc)
        return Response({"lesson": _lesson_data(lesson)}, status=201)


class ManagedLessonModuleAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def patch(self, request, lesson_id):
        lesson = get_object_or_404(
            RecordedLesson.objects.select_related("course").filter(
                course__in=_authorized_courses(request.user)
            ), pk=lesson_id,
        )
        try:
            module_id = _int(request.data.get("module_id"), "module_id")
        except ValidationError as exc:
            return _error(exc)
        module = get_object_or_404(CourseModule, pk=module_id, course=lesson.course)
        lesson.module = module
        lesson.save(update_fields=["module", "updated_at"])
        return Response({"lesson": _lesson_data(lesson)})


class ManagedCourseProgressAPIView(APIView):
    """Paginated, tenant-scoped course reporting for assigned teachers and admins.

    Aggregate results in batches so an institution with many students does
    not generate a database query for every student and every module.
    """
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]
    PAGE_SIZE = 25

    def get(self, request, course_id):
        from django.db.models import Count, Max, Q
        from .models import (
            RecordedCourseAccess, LessonLearningProgress, ModuleQuiz,
            ModuleQuizAttempt, ModuleAssignment, ModuleAssignmentSubmission,
            CourseFinalAttempt, CourseCertificate,
        )

        course = _course(request.user, course_id)
        raw_page = request.query_params.get("page", "1")
        if not raw_page.isascii() or not raw_page.isdecimal() or len(raw_page) > 6:
            return Response({"detail": "page must be a positive integer."}, status=400)
        page = int(raw_page)
        if page < 1 or page > 100000:
            return Response({"detail": "page must be a positive integer."}, status=400)

        search = request.query_params.get("search", "").strip()
        if len(search) > 80:
            return Response({"detail": "Search is limited to 80 characters."}, status=400)
        accesses = RecordedCourseAccess.objects.filter(
            course=course, organization=course.organization,
            student__user__organization=course.organization,
        ).select_related("student__user").order_by("student__user__username", "student_id")
        if search:
            accesses = accesses.filter(
                Q(student__user__username__icontains=search) |
                Q(student__user__first_name__icontains=search) |
                Q(student__user__last_name__icontains=search) |
                Q(student__admission_number__icontains=search)
            )
        total = accesses.count()
        start = (page - 1) * self.PAGE_SIZE
        enrolled = list(accesses[start:start + self.PAGE_SIZE])
        student_ids = [item.student_id for item in enrolled]

        modules = list(CourseModule.objects.filter(
            course=course, is_published=True,
        ).annotate(
            lesson_count=Count("lessons", filter=Q(lessons__is_active=True), distinct=True),
        ).order_by("position", "pk"))
        module_ids = [m.pk for m in modules]
        quizzes = {q.module_id: q for q in ModuleQuiz.objects.filter(
            module_id__in=module_ids, is_published=True,
        )}
        assignments = {a.module_id: a for a in ModuleAssignment.objects.filter(
            module_id__in=module_ids, is_published=True,
        )}
        watched = {
            (r["student_id"], r["lesson__module_id"]): r["total"]
            for r in LessonLearningProgress.objects.filter(
                student_id__in=student_ids, lesson__module_id__in=module_ids,
                lesson__is_active=True, completed_at__isnull=False,
            ).values("student_id", "lesson__module_id").annotate(
                total=Count("lesson_id", distinct=True),
            )
        }
        quiz_results = {
            (r["student_id"], r["quiz_id"]): r
            for r in ModuleQuizAttempt.objects.filter(
                student_id__in=student_ids, quiz__in=list(quizzes.values()),
            ).values("student_id", "quiz_id").annotate(
                passed_count=Count("pk", filter=Q(passed=True)),
                best_score=Max("score_percent"),
            )
        }
        assignment_results = {
            (r["student_id"], r["assignment_id"]): r
            for r in ModuleAssignmentSubmission.objects.filter(
                student_id__in=student_ids, assignment__in=list(assignments.values()),
            ).values("student_id", "assignment_id").annotate(
                best_score=Max("score_percent", filter=Q(graded_at__isnull=False)),
                pending_count=Count("pk", filter=Q(graded_at__isnull=True)),
            )
        }
        final_results = {
            r["student_id"]: r
            for r in CourseFinalAttempt.objects.filter(
                student_id__in=student_ids, exam__course=course,
            ).values("student_id").annotate(
                passed_count=Count("pk", filter=Q(passed=True)),
                best_score=Max("score_percent"),
            )
        }
        certificates = {
            c.student_id: c
            for c in CourseCertificate.objects.filter(
                course=course, student_id__in=student_ids,
            )
        }

        rows = []
        for enrollment in enrolled:
            student = enrollment.student
            details = []
            completed = viewed = all_videos = 0
            for module in modules:
                watched_count = watched.get((student.pk, module.pk), 0)
                viewed += watched_count
                all_videos += module.lesson_count
                quiz = quizzes.get(module.pk)
                quiz_result = quiz_results.get((student.pk, quiz.pk)) if quiz else None
                quiz_passed = not quiz or bool(quiz_result and quiz_result["passed_count"])
                assignment = assignments.get(module.pk)
                assignment_result = (
                    assignment_results.get((student.pk, assignment.pk)) if assignment else None
                )
                best_assignment = assignment_result["best_score"] if assignment_result else None
                assignment_passed = (
                    not assignment or best_assignment is not None
                    and best_assignment >= assignment.passing_percent
                )
                done = (module.lesson_count > 0 and watched_count == module.lesson_count
                        and quiz_passed and assignment_passed)
                completed += int(done)
                details.append({
                    "id": module.pk, "position": module.position, "title": module.title,
                    "lectures_viewed": watched_count, "lectures_total": module.lesson_count,
                    "completed": done,
                    "quiz_status": (
                        "not_required" if not quiz else
                        "passed" if quiz_passed else "not_passed"
                    ),
                    "quiz_best_percent": quiz_result["best_score"] if quiz_result else None,
                    "assignment_status": (
                        "not_required" if not assignment else
                        "passed" if assignment_passed else
                        "awaiting_review" if assignment_result and assignment_result["pending_count"]
                        else "not_passed"
                    ),
                    "assignment_best_percent": best_assignment,
                })
            final = final_results.get(student.pk)
            certificate = certificates.get(student.pk)
            rows.append({
                "student_id": student.pk,
                "student_name": student.user.get_full_name() or student.user.username,
                "admission_number": student.admission_number,
                "access_active": enrollment.has_access,
                "modules_completed": completed, "modules_total": len(modules),
                "lectures_viewed": viewed, "lectures_total": all_videos,
                "progress_percent": round(100 * completed / len(modules)) if modules else 0,
                "final_exam_best_percent": final["best_score"] if final else None,
                "final_exam_passed": bool(final and final["passed_count"]),
                "certificate_status": (
                    "revoked" if certificate.revoked_at else "issued"
                ) if certificate else "not_issued",
                "modules": details,
            })
        return Response({
            "course_id": course.pk, "course_title": course.title,
            "students_total": total, "page": page, "page_size": self.PAGE_SIZE,
            "has_next": start + self.PAGE_SIZE < total,
            "students": rows,
        })
