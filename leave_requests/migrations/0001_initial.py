from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("institutions", "0001_initial"),
        ("accounts", "0006_studentprofile_profile_picture"),
        ("liveclasses", "0012_liveclassrecording_purchase_settings"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="LeaveRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.TextField(max_length=1000)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")], default="pending", max_length=10)),
                ("admin_note", models.CharField(blank=True, max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="leave_requests", to="institutions.organization")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="leave_requests", to="accounts.studentprofile")),
                ("parent", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="submitted_leave_requests", to="accounts.parentprofile")),
                ("live_class", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="leave_requests", to="liveclasses.liveclass")),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_leave_requests", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["organization", "status"], name="leave_org_status_idx"),
                    models.Index(fields=["parent", "created_at"], name="leave_parent_created_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(fields=("student", "live_class"), name="unique_student_class_leave_request"),
                ],
            },
        ),
    ]
