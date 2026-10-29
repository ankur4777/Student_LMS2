"""Additive recorded-learning module quiz schema."""
import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("recordedcourses", "0007_student_lesson_progress")]

    operations = [
        migrations.CreateModel(
            name="ModuleQuiz",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=180)),
                ("passing_percent", models.PositiveSmallIntegerField(default=70, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(100)])),
                ("max_attempts", models.PositiveSmallIntegerField(default=3, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(10)])),
                ("is_published", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("module", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="quiz", to="recordedcourses.coursemodule")),
            ],
        ),
        migrations.CreateModel(
            name="ModuleQuizQuestion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("prompt", models.CharField(max_length=1000)),
                ("position", models.PositiveIntegerField()),
                ("choices", models.JSONField(default=list)),
                ("correct_index", models.PositiveSmallIntegerField()),
                ("quiz", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="questions", to="recordedcourses.modulequiz")),
            ],
            options={"ordering": ["position", "pk"]},
        ),
        migrations.CreateModel(
            name="ModuleQuizAttempt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("attempt_number", models.PositiveSmallIntegerField()),
                ("answers", models.JSONField(default=dict)),
                ("correct_count", models.PositiveIntegerField(default=0)),
                ("question_count", models.PositiveIntegerField(default=0)),
                ("score_percent", models.PositiveSmallIntegerField(default=0)),
                ("passed", models.BooleanField(default=False)),
                ("submitted_at", models.DateTimeField(auto_now_add=True)),
                ("quiz", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="attempts", to="recordedcourses.modulequiz")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="recorded_module_quiz_attempts", to="accounts.studentprofile")),
            ],
            options={"ordering": ["-submitted_at", "-pk"]},
        ),
        migrations.AddConstraint(
            model_name="modulequizquestion",
            constraint=models.UniqueConstraint(fields=("quiz", "position"), name="unique_module_quiz_question_position"),
        ),
        migrations.AddConstraint(
            model_name="modulequizattempt",
            constraint=models.UniqueConstraint(fields=("quiz", "student", "attempt_number"), name="unique_module_quiz_attempt"),
        ),
    ]
