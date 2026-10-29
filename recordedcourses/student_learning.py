"""Student Learning Center endpoints for published recorded course modules.

These APIs extend purchased recorded-course access without modifying the legacy
catalog/playback routes. Lesson completion is learner-reported, not exam proof.
"""

import mimetypes
from pathlib import Path

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StudentProfile
from .learning_access import OrganizationLearningEnabled
from .learning_progression import module_access_map, is_module_unlocked
from .models import (
    CourseModule, LessonLearningProgress, ModuleResource, RecordedCourse,
    RecordedCourseAccess, RecordedLesson,
)


def _student(user):
    if user.role != "student" or not user.is_active:
        return None
    if not user.organization or not user.organization.is_active:
        return None
    return StudentProfile.objects.filter(user=user).first()


def _student_access(user, course_id):
    student = _student(user)
    if not student:
        return None, None
    access = RecordedCourseAccess.objects.select_related("course").filter(
        organization=user.organization,
        course_id=course_id,
        course__organization=user.organization,
        course__is_active=True,
        student=student,
        is_active=True,
        revoked_at__isnull=True,
        starts_at__lte=timezone.now(),
    ).first()
    if access is None or not access.has_access:
        return student, None
    return student, access


def _lesson_data(lesson, completed_ids):
    return {
        "id": lesson.pk,
        "title": lesson.title,
        "description": lesson.description,
        "position": lesson.position,
        "completed": lesson.pk in completed_ids,
    }


def _file_extension(resource):
    ext = Path(resource.file.name).suffix.lower().lstrip(".")
    return ext if ext in {"pdf", "docx", "pptx", "txt", "png", "jpg", "jpeg"} else "bin"


def _resource_data(resource):
    return {"id": resource.pk, "title": resource.title,
            "kind": resource.kind, "extension": _file_extension(resource)}


class StudentLearningCoursesAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request):
        student = _student(request.user)
        if not student:
            return Response({"detail": "Student account required."}, status=403)
        accesses = RecordedCourseAccess.objects.select_related("course").filter(
            organization=request.user.organization,
            course__organization=request.user.organization,
            student=student,
            course__is_active=True,
            is_active=True,
            revoked_at__isnull=True,
            starts_at__lte=timezone.now(),
        )
        result = []
        for access in accesses:
            if not access.has_access:
                continue
            modules = CourseModule.objects.filter(
                course=access.course, is_published=True,
            )
            total = RecordedLesson.objects.filter(
                module__in=modules, is_active=True,
            ).count()
            done = LessonLearningProgress.objects.filter(
                student=student, lesson__module__in=modules,
                lesson__is_active=True, completed_at__isnull=False,
            ).count()
            result.append({
                "id": access.course_id,
                "title": access.course.title,
                "description": access.course.description,
                "module_count": modules.count(),
                "completed_lessons": done,
                "total_lessons": total,
                "access_expires_at": access.expires_at,
            })
        return Response({"courses": result})


class StudentLearningCourseDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request, course_id):
        student, access = _student_access(request.user, course_id)
        if not student:
            return Response({"detail": "Student account required."}, status=403)
        if not access:
            return Response({"detail": "No active access to this course."}, status=403)
        modules = list(CourseModule.objects.filter(
            course=access.course, is_published=True,
        ).prefetch_related("lessons", "resources"))
        completed_ids = set(LessonLearningProgress.objects.filter(
            student=student,
            lesson__module__in=modules,
            lesson__is_active=True,
            completed_at__isnull=False,
        ).values_list("lesson_id", flat=True))
        # Local imports avoid circular dependencies between authoring and student APIs.
        from .learning_quizzes import student_quiz_status
        from .learning_assignments import student_assignment_status
        access_map = module_access_map(access.course, student)
        data = []
        for module in modules:
            state = access_map[module.pk]
            unlocked = state["unlocked"]
            lessons = [lesson for lesson in module.lessons.all() if lesson.is_active] if unlocked else []
            data.append({
                "id": module.pk, "title": module.title,
                "description": module.description, "position": module.position,
                "locked": not unlocked, "completed": state["completed"],
                "quiz": student_quiz_status(module, student) if unlocked else None,
                "assignment": student_assignment_status(module, student) if unlocked else None,
                "lessons": [_lesson_data(lesson, completed_ids) for lesson in lessons],
                "resources": [_resource_data(resource) for resource in module.resources.all()] if unlocked else [],
                "completed_lessons": state["completed_lessons"] if unlocked else 0,
                "total_lessons": state["total_lessons"] if unlocked else 0,
            })
        from .learning_finals import student_final_status
        return Response({
            "course": {
                "final_exam": student_final_status(access.course, student),
                "id": access.course_id,
                "title": access.course.title,
                "description": access.course.description,
                "access_expires_at": access.expires_at,
                "modules": data,
                # Include locked module lessons in aggregate progress totals
                # without exposing their content or private identifiers.
                "completed_lessons": sum(s["completed_lessons"] for s in access_map.values()),
                "total_lessons": sum(s["total_lessons"] for s in access_map.values()),
            }
        })


class StudentLearningResourceDownloadAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request, resource_id):
        student = _student(request.user)
        if not student:
            return Response({"detail": "Student account required."}, status=403)
        resource = get_object_or_404(
            ModuleResource.objects.select_related("module__course").filter(
                pk=resource_id,
                module__is_published=True,
                module__course__organization=request.user.organization,
                module__course__is_active=True,
            )
        )
        _, access = _student_access(request.user, resource.module.course_id)
        if not access:
            return Response({"detail": "No active course access."}, status=403)
        if not is_module_unlocked(resource.module, student):
            return Response({"detail": "Complete the previous module first."}, status=403)
        extension = _file_extension(resource)
        if extension == "bin":
            return Response({"detail": "Unsupported file."}, status=404)
        try:
            handle = resource.file.open("rb")
        except (OSError, FileNotFoundError):
            return Response({"detail": "Resource unavailable."}, status=404)
        response = FileResponse(
            handle, as_attachment=True,
            filename="course-resource." + extension,
            content_type=mimetypes.guess_type("file." + extension)[0] or "application/octet-stream",
        )
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class StudentLearningLessonCompleteAPIView(APIView):
    """Record self-reported lesson viewing; not certification/exam eligibility."""
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def post(self, request, lesson_id):
        student = _student(request.user)
        if not student:
            return Response({"detail": "Student account required."}, status=403)
        lesson = get_object_or_404(
            RecordedLesson.objects.select_related("module", "course").filter(
                pk=lesson_id, is_active=True,
                course__organization=request.user.organization,
                course__is_active=True,
                module__isnull=False,
                module__is_published=True,
            )
        )
        _, access = _student_access(request.user, lesson.course_id)
        if not access:
            return Response({"detail": "No active course access."}, status=403)
        if not is_module_unlocked(lesson.module, student):
            return Response({"detail": "Complete the previous module first."}, status=403)
        progress, created = LessonLearningProgress.objects.get_or_create(
            student=student, lesson=lesson,
            defaults={"completed_at": timezone.now()},
        )
        if not created and progress.completed_at is None:
            progress.completed_at = timezone.now()
            progress.save(update_fields=["completed_at", "updated_at"])
        return Response({"lesson_id": lesson.pk, "completed": True,
                         "completion_type": "learner_reported"})



class StudentLearningLessonPlaybackAPIView(APIView):
    """Protected module video route; the legacy paid-video endpoint is unchanged."""
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request, lesson_id):
        student = _student(request.user)
        if student is None:
            return Response({"detail": "Student account required."}, status=403)
        lesson = get_object_or_404(
            RecordedLesson.objects.select_related("module", "course").filter(
                pk=lesson_id, is_active=True,
                course__organization=request.user.organization,
                course__is_active=True,
                module__isnull=False, module__is_published=True,
            ),
        )
        _, access = _student_access(request.user, lesson.course_id)
        if not access:
            return Response({"detail": "Active course access required."}, status=403)
        if not is_module_unlocked(lesson.module, student):
            return Response({"detail": "Complete the previous module first."}, status=403)
        if not lesson.video:
            return Response({"detail": "Recorded video unavailable."}, status=404)
        try:
            handle = lesson.video.open("rb")
        except (OSError, FileNotFoundError):
            return Response({"detail": "Recorded video unavailable."}, status=404)
        response = FileResponse(
            handle, content_type=mimetypes.guess_type(lesson.video.name)[0] or "application/octet-stream",
        )
        response["Content-Disposition"] = 'inline; filename="recorded-lesson"'
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response
