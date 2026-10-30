"""One bounded playback session per student and lesson (additive migration)."""
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models
import uuid

class Migration(migrations.Migration):
    dependencies = [("recordedcourses", "0011_lesson_completion_method")]
    operations = [
        migrations.CreateModel(
            name="LessonPlaybackSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("session_id", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("started_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("last_heartbeat_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("last_position_seconds", models.FloatField(default=0)),
                ("duration_seconds", models.FloatField(blank=True, null=True)),
                ("credited_seconds", models.FloatField(default=0)),
                ("heartbeat_count", models.PositiveIntegerField(default=0)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("lesson", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="learning_playback_sessions", to="recordedcourses.recordedlesson")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="learning_playback_sessions", to="accounts.studentprofile")),
            ],
        ),
        migrations.AddConstraint(
            model_name="lessonplaybacksession",
            constraint=models.UniqueConstraint(fields=("student", "lesson"), name="unique_active_learning_playback_session"),
        ),
    ]
