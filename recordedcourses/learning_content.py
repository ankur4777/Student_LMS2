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
