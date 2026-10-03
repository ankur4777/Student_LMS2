import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
        ("academics", "0010_class_roll_number_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="subject",
            name="student_assignment_mode",
            field=models.CharField(
                choices=[
                    ("all", "All Students"),
                    ("selected", "Selected Students Only"),
                ],
                default="all",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="SubjectStudentAccess",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("is_enrolled", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="subject_access_overrides",
                        to="accounts.studentprofile",
                    ),
                ),
                (
                    "subject",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="student_access_overrides",
                        to="academics.subject",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="subjectstudentaccess",
            constraint=models.UniqueConstraint(
                fields=("subject", "student"),
                name="uniq_subject_student_access",
            ),
        ),
    ]
