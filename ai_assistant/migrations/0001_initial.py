# Original migration for MySLS AI Tutor conversation persistence.
import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0006_studentprofile_profile_picture"),
        ("academics", "0012_classfeatureaccess_ai_assistant"),
        ("institutions", "0002_roll_number_settings"),
    ]

    operations = [
        migrations.CreateModel(
            name="StudentAIConversation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("mode", models.CharField(choices=[("dashboard", "My Dashboard"), ("tutor", "Subject Tutor")], max_length=12)),
                ("title", models.CharField(max_length=100)),
                ("enabled_features_at_creation", models.JSONField(default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_ai_conversations", to="institutions.organization")),
                ("section", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_ai_conversations", to="academics.section")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="ai_conversations", to="accounts.studentprofile")),
                ("subject", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="student_ai_conversations", to="academics.subject")),
            ],
            options={"ordering": ["-updated_at", "-created_at"]},
        ),
        migrations.CreateModel(
            name="StudentAIMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("user", "Student"), ("assistant", "AI Tutor")], max_length=10)),
                ("content", models.TextField()),
                ("links", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("conversation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="ai_assistant.studentaiconversation")),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
        migrations.AddIndex(
            model_name="studentaiconversation",
            index=models.Index(fields=["organization", "student", "-updated_at"], name="student_ai_conv_scope_idx"),
        ),
        migrations.AddIndex(
            model_name="studentaimessage",
            index=models.Index(fields=["conversation", "created_at"], name="student_ai_msg_time_idx"),
        ),
    ]
