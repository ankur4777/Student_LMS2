"""Module assignments and manually evaluated student submissions."""
import uuid
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, MaxValueValidator, MinValueValidator
from django.db import models

from .models import private_recorded_course_storage


class ModuleAssignment(models.Model):
    module = models.OneToOneField(
        "recordedcourses.CourseModule", on_delete=models.CASCADE, related_name="assignment",
    )
    title = models.CharField(max_length=180)
    instructions = models.TextField()
    passing_percent = models.PositiveSmallIntegerField(
        default=60, validators=[MinValueValidator(1), MaxValueValidator(100)],
    )
    max_attempts = models.PositiveSmallIntegerField(
        default=3, validators=[MinValueValidator(1), MaxValueValidator(10)],
    )
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


def assignment_submission_path(instance, filename):
    ext = Path(filename).suffix.lower()
    return (
        f"recorded_course_submissions/{instance.assignment.module.course.organization_id}/"
        f"{instance.assignment.module.course_id}/{instance.assignment.module_id}/"
        f"{uuid.uuid4().hex}{ext}"
    )


class ModuleAssignmentSubmission(models.Model):
    assignment = models.ForeignKey(
        ModuleAssignment, on_delete=models.PROTECT, related_name="submissions",
    )
    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE,
        related_name="learning_assignment_submissions",
    )
    attempt_number = models.PositiveSmallIntegerField()
    answer_text = models.TextField(blank=True)
    file = models.FileField(
        upload_to=assignment_submission_path,
        storage=private_recorded_course_storage,
        max_length=500, blank=True,
        validators=[FileExtensionValidator(
            allowed_extensions=["pdf", "docx", "txt", "png", "jpg", "jpeg"],
        )],
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, blank=True, null=True,
        on_delete=models.SET_NULL, related_name="graded_learning_assignments",
    )
    score_percent = models.PositiveSmallIntegerField(
        blank=True, null=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    feedback = models.TextField(blank=True)
    graded_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-submitted_at", "-pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "student", "attempt_number"],
                name="unique_learning_assignment_attempt",
            ),
        ]

    def clean(self):
        errors = {}
        if self.assignment_id and self.student_id:
            if self.assignment.module.course.organization_id != self.student.user.organization_id:
                errors["student"] = "Student and assignment must belong to the same organization."
        if not self.answer_text.strip() and not self.file:
            errors["answer_text"] = "Provide an answer or file."
        if len(self.answer_text) > 20000:
            errors["answer_text"] = "Answer is too long."
        if self.file and getattr(self.file, "size", None) is not None:
            if self.file.size > 25 * 1024 * 1024:
                errors["file"] = "Attachment must not exceed 25 MB."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
