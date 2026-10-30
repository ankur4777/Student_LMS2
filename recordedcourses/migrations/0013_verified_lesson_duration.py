"""Store server-verified duration for new Learning Center video uploads."""
import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("recordedcourses", "0012_lesson_playback_session"),
    ]

    operations = [
        migrations.AddField(
            model_name="recordedlesson",
            name="verified_duration_seconds",
            field=models.FloatField(
                blank=True, null=True,
                validators=[
                    django.core.validators.MinValueValidator(0.1),
                    django.core.validators.MaxValueValidator(28800),
                ],
            ),
        ),
        migrations.AddField(
            model_name="recordedlesson",
            name="duration_verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
