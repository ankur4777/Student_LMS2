"""Final exam, results, and immutable issued-certificate snapshot."""
import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("recordedcourses", "0009_module_assignments"),
    ]
    operations = [
        migrations.CreateModel(name="CourseFinalExam", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("title", models.CharField(max_length=180)),
            ("passing_percent", models.PositiveSmallIntegerField(default=70, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(100)])),
            ("max_attempts", models.PositiveSmallIntegerField(default=3, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(10)])),
            ("is_published", models.BooleanField(default=False)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("updated_at", models.DateTimeField(auto_now=True)),
            ("course", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="final_exam", to="recordedcourses.recordedcourse")),
        ]),
        migrations.CreateModel(name="CourseFinalQuestion", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("prompt", models.CharField(max_length=1000)),
            ("position", models.PositiveIntegerField()),
            ("choices", models.JSONField(default=list)),
            ("correct_index", models.PositiveSmallIntegerField()),
            ("exam", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="questions", to="recordedcourses.coursefinalexam")),
        ], options={"ordering": ["position", "pk"]}),
        migrations.CreateModel(name="CourseFinalAttempt", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("attempt_number", models.PositiveSmallIntegerField()),
            ("answers", models.JSONField(default=dict)),
            ("correct_count", models.PositiveIntegerField(default=0)),
            ("question_count", models.PositiveIntegerField(default=0)),
            ("score_percent", models.PositiveSmallIntegerField(default=0)),
            ("passed", models.BooleanField(default=False)),
            ("submitted_at", models.DateTimeField(auto_now_add=True)),
            ("exam", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="attempts", to="recordedcourses.coursefinalexam")),
            ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="learning_final_attempts", to="accounts.studentprofile")),
        ], options={"ordering": ["-submitted_at", "-pk"]}),
        migrations.CreateModel(name="CourseCertificate", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("public_id", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
            ("course_title_at_issue", models.CharField(max_length=180)),
            ("organization_name_at_issue", models.CharField(max_length=180)),
            ("student_name_at_issue", models.CharField(max_length=180)),
            ("module_count_at_issue", models.PositiveIntegerField()),
            ("score_percent", models.PositiveSmallIntegerField()),
            ("issued_at", models.DateTimeField(auto_now_add=True)),
            ("revoked_at", models.DateTimeField(blank=True, null=True)),
            ("revocation_reason", models.CharField(blank=True, max_length=500)),
            ("course", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="learning_certificates", to="recordedcourses.recordedcourse")),
            ("final_attempt", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="certificate", to="recordedcourses.coursefinalattempt")),
            ("organization", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="learning_certificates", to="institutions.organization")),
            ("student", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="learning_certificates", to="accounts.studentprofile")),
        ], options={"ordering": ["-issued_at"]}),
        migrations.AddConstraint(model_name="coursefinalquestion", constraint=models.UniqueConstraint(fields=("exam", "position"), name="unique_course_final_question_position")),
        migrations.AddConstraint(model_name="coursefinalattempt", constraint=models.UniqueConstraint(fields=("exam", "student", "attempt_number"), name="unique_course_final_attempt")),
        migrations.AddConstraint(model_name="coursecertificate", constraint=models.UniqueConstraint(fields=("course", "student"), name="unique_course_completion_certificate")),
    ]
