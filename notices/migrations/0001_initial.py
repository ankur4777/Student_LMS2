import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models

import notices.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("institutions", "0002_roll_number_settings"),
        ("academics", "0009_merge_20261001_1719"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Notice",
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
                ("title", models.CharField(max_length=200)),
                ("message", models.TextField()),
                (
                    "audience",
                    models.CharField(
                        choices=[
                            ("everyone", "Everyone"),
                            ("students", "All Students"),
                            ("teachers", "All Teachers"),
                            ("parents", "All Parents"),
                            ("class", "Specific Class"),
                            ("section", "Specific Section"),
                        ],
                        default="everyone",
                        max_length=20,
                    ),
                ),
                (
                    "publish_at",
                    models.DateTimeField(default=django.utils.timezone.now),
                ),
                (
                    "expires_at",
                    models.DateTimeField(blank=True, null=True),
                ),
                (
                    "attachment",
                    models.FileField(
                        blank=True,
                        null=True,
                        upload_to=notices.models.notice_attachment_upload_path,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "classroom",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notices",
                        to="academics.classroom",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="created_notices",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notices",
                        to="institutions.organization",
                    ),
                ),
                (
                    "section",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notices",
                        to="academics.section",
                    ),
                ),
            ],
            options={
                "ordering": ["-publish_at", "-created_at"],
            },
        ),
    ]
