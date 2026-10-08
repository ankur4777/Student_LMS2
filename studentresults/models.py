from django.db import models


class Exam(models.Model):
    organization = models.ForeignKey(
        "institutions.Organization",
        on_delete=models.CASCADE,
        related_name="exams",
    )

    section = models.ForeignKey(
        "academics.Section",
        on_delete=models.CASCADE,
        related_name="exams",
    )

    name = models.CharField(max_length=150)

    exam_date = models.DateField()

    is_published = models.BooleanField(default=False)

    # Legacy paper exams leave these fields empty. Online exams use the
    # existing Exam record and keep final-result publication separate.
    online_teacher_assignment = models.ForeignKey(
        "academics.TeacherAssignment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="online_exams",
    )
    online_starts_at = models.DateTimeField(null=True, blank=True)
    online_ends_at = models.DateTimeField(null=True, blank=True)
    online_duration_minutes = models.PositiveIntegerField(default=60)
    online_is_open = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-exam_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "section", "name"],
                name="unique_exam_per_section",
            )
        ]

    def __str__(self):
        return f"{self.name} - {self.section}"


class StudentResult(models.Model):
    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name="results",
    )

    student = models.ForeignKey(
        "accounts.StudentProfile",
        on_delete=models.CASCADE,
        related_name="results",
    )

    subject = models.ForeignKey(
        "academics.Subject",
        on_delete=models.CASCADE,
        related_name="student_results",
    )

    teacher = models.ForeignKey(
        "accounts.TeacherProfile",
        on_delete=models.CASCADE,
        related_name="graded_results",
    )

    marks_obtained = models.DecimalField(
        max_digits=6,
        decimal_places=2,
    )

    maximum_marks = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=100,
    )

    remarks = models.CharField(
        max_length=255,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = [
            "-exam__exam_date",
            "subject__name",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "exam",
                    "student",
                    "subject",
                ],
                name="unique_student_exam_subject_result",
            )
        ]

    @property
    def percentage(self):
        if not self.maximum_marks:
            return 0

        return round(
            (self.marks_obtained / self.maximum_marks) * 100,
            2,
        )

    def __str__(self):
        return (
            f"{self.student} - "
            f"{self.exam.name} - "
            f"{self.subject.name}"
        )

class ExamQuestion(models.Model):
    class Kind(models.TextChoices):
        MULTIPLE_CHOICE = "mcq", "Multiple choice"
        TRUE_FALSE = "true_false", "True or false"
        SHORT_ANSWER = "short", "Short answer"
        LONG_ANSWER = "long", "Long answer"

    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="questions")
    kind = models.CharField(max_length=16, choices=Kind.choices)
    prompt = models.TextField()
    marks = models.DecimalField(max_digits=7, decimal_places=2)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    @property
    def is_objective(self):
        return self.kind in (self.Kind.MULTIPLE_CHOICE, self.Kind.TRUE_FALSE)


class ExamChoice(models.Model):
    question = models.ForeignKey(
        ExamQuestion, on_delete=models.CASCADE, related_name="choices"
    )
    text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]


class ExamAttempt(models.Model):
    class State(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        SUBMITTED = "submitted", "Submitted (subjective pending)"
        GRADED = "graded", "Fully graded"

    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="attempts")
    student = models.ForeignKey(
        "accounts.StudentProfile",
        on_delete=models.CASCADE,
        related_name="online_exam_attempts",
    )
    state = models.CharField(
        max_length=16, choices=State.choices, default=State.IN_PROGRESS
    )
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    objective_marks = models.DecimalField(
        max_digits=8, decimal_places=2, default=0
    )
    subjective_marks = models.DecimalField(
        max_digits=8, decimal_places=2, default=0
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["exam", "student"], name="uniq_online_exam_attempt"
            )
        ]


class ExamAnswer(models.Model):
    attempt = models.ForeignKey(
        ExamAttempt, on_delete=models.CASCADE, related_name="answers"
    )
    question = models.ForeignKey(
        ExamQuestion, on_delete=models.CASCADE, related_name="answers"
    )
    selected_choice = models.ForeignKey(
        ExamChoice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_answers",
    )
    text_answer = models.TextField(blank=True)
    awarded_marks = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True
    )
    feedback = models.TextField(blank=True)
    graded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["attempt", "question"], name="uniq_online_exam_answer"
            )
        ]
