"""Student learning progress, separate from exam results/certification."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0006_studentprofile_profile_picture"),
        ("recordedcourses", "0006_link_lessons_to_modules"),
    ]
    operations = [
        migrations.CreateModel(
            name="LessonLearningProgress",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("lesson", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="learning_progress", to="recordedcourses.recordedlesson")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="recorded_learning_progress", to="accounts.studentprofile")),
            ],
        ),
        migrations.AddConstraint(
            model_name="lessonlearningprogress",
            constraint=models.UniqueConstraint(fields=("student", "lesson"), name="unique_learning_lesson_progress"),
        ),
    ]
