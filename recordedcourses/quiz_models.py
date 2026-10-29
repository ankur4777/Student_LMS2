"""Auto-graded course module quizzes, separate from school academic exams."""
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models


class ModuleQuiz(models.Model):
    module = models.OneToOneField("recordedcourses.CourseModule", on_delete=models.CASCADE, related_name="quiz")
    title = models.CharField(max_length=180)
    passing_percent = models.PositiveSmallIntegerField(default=70, validators=[MinValueValidator(1), MaxValueValidator(100)])
    max_attempts = models.PositiveSmallIntegerField(default=3, validators=[MinValueValidator(1), MaxValueValidator(10)])
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class ModuleQuizQuestion(models.Model):
    quiz = models.ForeignKey(ModuleQuiz, on_delete=models.CASCADE, related_name="questions")
    prompt = models.CharField(max_length=1000)
    position = models.PositiveIntegerField()
    choices = models.JSONField(default=list)
    correct_index = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["position", "pk"]
        constraints = [
            models.UniqueConstraint(fields=["quiz", "position"], name="unique_module_quiz_question_position"),
        ]

    def clean(self):
        if not isinstance(self.choices, list) or not 2 <= len(self.choices) <= 6:
            raise ValidationError({"choices": "Provide two to six choices."})
        if any(not isinstance(c, str) or not c.strip() or len(c.strip()) > 400 for c in self.choices):
            raise ValidationError({"choices": "Each choice must contain 1-400 characters."})
        if not isinstance(self.correct_index, int) or not 0 <= self.correct_index < len(self.choices):
            raise ValidationError({"correct_index": "Select a valid correct choice."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class ModuleQuizAttempt(models.Model):
    quiz = models.ForeignKey(ModuleQuiz, on_delete=models.PROTECT, related_name="attempts")
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="recorded_module_quiz_attempts")
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
            models.UniqueConstraint(fields=["quiz", "student", "attempt_number"], name="unique_module_quiz_attempt"),
        ]

    def clean(self):
        if self.quiz_id and self.student_id:
            if self.quiz.module.course.organization_id != self.student.user.organization_id:
                raise ValidationError({"student": "Student and course must belong to the same organization."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
