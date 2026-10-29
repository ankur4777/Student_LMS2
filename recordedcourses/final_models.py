"""Final examination and verifiable learning certificate records."""
import uuid
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models


class CourseFinalExam(models.Model):
    course = models.OneToOneField("recordedcourses.RecordedCourse", on_delete=models.CASCADE, related_name="final_exam")
    title = models.CharField(max_length=180)
    passing_percent = models.PositiveSmallIntegerField(default=70, validators=[MinValueValidator(1), MaxValueValidator(100)])
    max_attempts = models.PositiveSmallIntegerField(default=3, validators=[MinValueValidator(1), MaxValueValidator(10)])
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class CourseFinalQuestion(models.Model):
    exam = models.ForeignKey(CourseFinalExam, on_delete=models.CASCADE, related_name="questions")
    prompt = models.CharField(max_length=1000)
    position = models.PositiveIntegerField()
    choices = models.JSONField(default=list)
    correct_index = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["position", "pk"]
        constraints = [
            models.UniqueConstraint(fields=["exam", "position"], name="unique_course_final_question_position"),
        ]

    def clean(self):
        if not isinstance(self.choices, list) or not 2 <= len(self.choices) <= 6:
            raise ValidationError({"choices": "Use two to six answer choices."})
        if any(not isinstance(c, str) or not 1 <= len(c.strip()) <= 400 for c in self.choices):
            raise ValidationError({"choices": "Each choice must be between 1 and 400 characters."})
        if type(self.correct_index) is not int or not 0 <= self.correct_index < len(self.choices):
            raise ValidationError({"correct_index": "Choose a valid correct option."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class CourseFinalAttempt(models.Model):
    exam = models.ForeignKey(CourseFinalExam, on_delete=models.PROTECT, related_name="attempts")
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="learning_final_attempts")
    attempt_number = models.PositiveSmallIntegerField()
    answers = models.JSONField(default=dict)
    correct_count = models.PositiveIntegerField(default=0)
    question_count = models.PositiveIntegerField(default=0)
    score_percent = models.PositiveSmallIntegerField(default=0)
    passed = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-submitted_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["exam", "student", "attempt_number"], name="unique_course_final_attempt"),
        ]

    def clean(self):
        if self.exam_id and self.student_id:
            if self.exam.course.organization_id != self.student.user.organization_id:
                raise ValidationError({"student": "Student must belong to the exam organization."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class CourseCertificate(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    course = models.ForeignKey("recordedcourses.RecordedCourse", on_delete=models.PROTECT, related_name="learning_certificates")
    organization = models.ForeignKey("institutions.Organization", on_delete=models.PROTECT, related_name="learning_certificates")
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.PROTECT, related_name="learning_certificates")
    final_attempt = models.OneToOneField(CourseFinalAttempt, on_delete=models.PROTECT, related_name="certificate")
    course_title_at_issue = models.CharField(max_length=180)
    organization_name_at_issue = models.CharField(max_length=180)
    student_name_at_issue = models.CharField(max_length=180)
    module_count_at_issue = models.PositiveIntegerField()
    score_percent = models.PositiveSmallIntegerField()
    issued_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revocation_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["-issued_at"]
        constraints = [
            models.UniqueConstraint(fields=["course", "student"], name="unique_course_completion_certificate"),
        ]

    def clean(self):
        if self.course_id and self.organization_id and self.course.organization_id != self.organization_id:
            raise ValidationError({"organization": "Course and certificate organizations must match."})
        if self.student_id and self.organization_id and self.student.user.organization_id != self.organization_id:
            raise ValidationError({"student": "Student and organization must match."})
        if self.final_attempt_id and self.course_id and self.student_id:
            if (not self.final_attempt.passed or self.final_attempt.exam.course_id != self.course_id
                    or self.final_attempt.student_id != self.student_id):
                raise ValidationError({"final_attempt": "A passed final exam for this course and student is required."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
