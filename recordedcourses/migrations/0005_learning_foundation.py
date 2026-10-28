# Generated for MySLS Recorded Learning Phase 1: additive schema only.
import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import recordedcourses.learning_models
import recordedcourses.models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("recordedcourses", "0004_recorded_class_purchase_access"),
    ]

    operations = [
        migrations.CreateModel(
            name="CourseModule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=180)),
                ("description", models.TextField(blank=True)),
                ("position", models.PositiveIntegerField(validators=[django.core.validators.MinValueValidator(1)])),
                ("is_published", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("course", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="modules", to="recordedcourses.recordedcourse")),
            ],
            options={"ordering": ["position", "id"]},
        ),
        migrations.CreateModel(
            name="ModuleResource",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=180)),
                ("kind", models.CharField(choices=[("notes", "Notes"), ("worksheet", "Worksheet"), ("reference", "Reference material")], default="notes", max_length=20)),
                ("file", models.FileField(max_length=500, storage=recordedcourses.models.PrivateRecordedCourseStorage(), upload_to=recordedcourses.learning_models.module_resource_upload_path, validators=[django.core.validators.FileExtensionValidator(allowed_extensions=["pdf", "docx", "pptx", "txt", "png", "jpg", "jpeg"])])),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("module", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="resources", to="recordedcourses.coursemodule")),
                ("uploaded_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="uploaded_course_resources", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["id"]},
        ),
        migrations.CreateModel(
            name="OrganizationLearningSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_enabled", models.BooleanField(default=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("organization", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="recorded_learning_settings", to="institutions.organization")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="learning_settings_updates", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="TeacherCourseAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("assigned_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="recorded_course_teacher_assignments", to=settings.AUTH_USER_MODEL)),
                ("course", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="teacher_course_assignments", to="recordedcourses.recordedcourse")),
                ("teacher", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assigned_recorded_courses", to="accounts.teacherprofile")),
            ],
        ),
        migrations.AddConstraint(
            model_name="coursemodule",
            constraint=models.UniqueConstraint(fields=("course", "position"), name="unique_recorded_module_position"),
        ),
        migrations.AddConstraint(
            model_name="teachercourseassignment",
            constraint=models.UniqueConstraint(fields=("course", "teacher"), name="unique_recorded_course_teacher"),
        ),
    ]
