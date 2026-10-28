"""Phase 1 of MySLS recorded learning.

These new tables extend the existing recordedcourses app. Existing video, purchase,
student-access and academic exam tables remain unchanged.

Next phases will add APIs, progress tracking, quizzes, assignment grading and
certificate issuance. Do not treat these models as a complete feature toggle.
"""

import uuid
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, MinValueValidator
from django.db import models

# Imported only after recordedcourses.models has defined RecordedCourse/storage.
# recordedcourses.models imports this module at its end.
from .models import RecordedCourse, private_recorded_course_storage


class OrganizationLearningSettings(models.Model):
    """Platform-controlled organization entitlement, OFF by default.

    APIs and menus must enforce this switch in subsequent phases; the model
    by itself does not grant or deny access to existing paid recordings.
    """

    organization = models.OneToOneField(
        "institutions.Organization", on_delete=models.CASCADE,
        related_name="recorded_learning_settings",
    )
    is_enabled = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="learning_settings_updates",
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        state = "enabled" if self.is_enabled else "disabled"
        return f"{self.organization} — recorded learning {state}"


class CourseModule(models.Model):
    """An ordered chapter in an existing RecordedCourse."""

    course = models.ForeignKey(
        RecordedCourse, on_delete=models.CASCADE, related_name="modules",
    )
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    position = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["course", "position"],
                name="unique_recorded_module_position",
            ),
        ]

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.course.title} / {self.position}. {self.title}"


class TeacherCourseAssignment(models.Model):
    """Which teachers may contribute to a given organization's course."""

    course = models.ForeignKey(
        RecordedCourse, on_delete=models.CASCADE, related_name="teacher_course_assignments",
    )
    teacher = models.ForeignKey(
        "accounts.TeacherProfile", on_delete=models.CASCADE,
        related_name="assigned_recorded_courses",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="recorded_course_teacher_assignments",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["course", "teacher"],
                name="unique_recorded_course_teacher",
            ),
        ]

    def clean(self):
        errors = {}
        if self.course_id and self.teacher_id:
            if self.course.organization_id != self.teacher.user.organization_id:
                errors["teacher"] = "Teacher and course must belong to the same organization."
        if self.assigned_by_id and self.course_id:
            if self.assigned_by.role not in ("platform_admin", "college_admin"):
                errors["assigned_by"] = "Only a platform or college admin may assign teachers."
            elif self.assigned_by.role == "college_admin" and (
                self.assigned_by.organization_id != self.course.organization_id
            ):
                errors["assigned_by"] = "College admin must belong to the course organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.teacher} → {self.course}"


def module_resource_upload_path(instance, filename):
    """Avoid user-supplied folders/names and keep all resources tenant-scoped."""
    extension = Path(filename).suffix.lower()
    return (
        f"recorded_course_resources/{instance.module.course.organization_id}/"
        f"{instance.module.course_id}/{instance.module_id}/{uuid.uuid4().hex}{extension}"
    )


class ModuleResource(models.Model):
    class Kind(models.TextChoices):
        NOTES = "notes", "Notes"
        WORKSHEET = "worksheet", "Worksheet"
        REFERENCE = "reference", "Reference material"

    module = models.ForeignKey(
        CourseModule, on_delete=models.CASCADE, related_name="resources",
    )
    title = models.CharField(max_length=180)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.NOTES)
    file = models.FileField(
        upload_to=module_resource_upload_path,
        storage=private_recorded_course_storage,
        max_length=500,
        validators=[FileExtensionValidator(
            allowed_extensions=["pdf", "docx", "pptx", "txt", "png", "jpg", "jpeg"],
        )],
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="uploaded_course_resources",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def clean(self):
        errors = {}
        if self.uploaded_by_id and self.module_id:
            uploader = self.uploaded_by
            course = self.module.course
            if not uploader.is_active or not course.organization.is_active:
                errors["uploaded_by"] = "Uploader and organization must be active."
            elif uploader.role == "college_admin":
                if uploader.organization_id != course.organization_id:
                    errors["uploaded_by"] = "Admin cannot upload to a different organization."
            elif uploader.role == "teacher":
                if uploader.organization_id != course.organization_id or not (
                    TeacherCourseAssignment.objects.filter(
                        course=course, teacher__user=uploader, is_active=True,
                    ).exists()
                ):
                    errors["uploaded_by"] = "Teacher must be assigned to this course."
            elif uploader.role != "platform_admin":
                errors["uploaded_by"] = "This role cannot upload course resources."
        if self.file and getattr(self.file, "size", None) is not None:
            if self.file.size > 25 * 1024 * 1024:
                errors["file"] = "Resource file must not exceed 25 MB."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.module}: {self.title}"


class LessonLearningProgress(models.Model):
    """Learner-reported lesson completion; never sufficient alone for certificates."""
    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE,
        related_name="recorded_learning_progress",
    )
    lesson = models.ForeignKey(
        "recordedcourses.RecordedLesson", on_delete=models.CASCADE,
        related_name="learning_progress",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "lesson"],
                                    name="unique_learning_lesson_progress"),
        ]

    def clean(self):
        if self.student_id and self.lesson_id:
            if self.student.user.organization_id != self.lesson.course.organization_id:
                raise ValidationError({"lesson": "Student and lesson belong to different organizations."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
