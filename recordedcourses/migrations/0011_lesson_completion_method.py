"""Distinguish historic learner-reported progress from signed playback sessions."""
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("recordedcourses", "0010_final_exam_certificates"),
    ]

    operations = [
        migrations.AddField(
            model_name="lessonlearningprogress",
            name="completion_method",
            field=models.CharField(
                choices=[
                    ("learner_reported", "Learner reported (legacy)"),
                    ("signed_session", "Signed viewing session"),
                ],
                default="learner_reported", max_length=24,
            ),
        ),
    ]
