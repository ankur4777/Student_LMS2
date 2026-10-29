"""Additive module assignments and private submitted work."""
import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import recordedcourses.assignment_models
import recordedcourses.models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("recordedcourses", "0008_module_quizzes"),
    ]

    operations = [
        migrations.CreateModel(
            name="ModuleAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=180)),
                ("instructions", models.TextField()),
                ("passing_percent", models.PositiveSmallIntegerField(default=60, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(100)])),
                ("max_attempts", models.PositiveSmallIntegerField(default=3, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(10)])),
                ("is_published", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("module", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="assignment", to="recordedcourses.coursemodule")),
            ],
        ),
        migrations.CreateModel(
            name="ModuleAssignmentSubmission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("attempt_number", models.PositiveSmallIntegerField()),
                ("answer_text", models.TextField(blank=True)),
                ("file", models.FileField(blank=True, max_length=500, storage=recordedcourses.models.PrivateRecordedCourseStorage(), upload_to=recordedcourses.assignment_models.assignment_submission_path, validators=[django.core.validators.FileExtensionValidator(allowed_extensions=["pdf", "docx", "txt", "png", "jpg", "jpeg"])])),
                ("submitted_at", models.DateTimeField(auto_now_add=True)),
                ("score_percent", models.PositiveSmallIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)])),
                ("feedback", models.TextField(blank=True)),
                ("graded_at", models.DateTimeField(blank=True, null=True)),
                ("assignment", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="submissions", to="recordedcourses.moduleassignment")),
                ("graded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="graded_learning_assignments", to=settings.AUTH_USER_MODEL)),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="learning_assignment_submissions", to="accounts.studentprofile")),
            ],
            options={"ordering": ["-submitted_at", "-pk"]},
        ),
        migrations.AddConstraint(
            model_name="moduleassignmentsubmission",
            constraint=models.UniqueConstraint(
                fields=("assignment", "student", "attempt_number"),
                name="unique_learning_assignment_attempt",
            ),
        ),
    ]
