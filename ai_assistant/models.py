"""Private AI chat records scoped to a MySLS student and enrollment."""

import uuid

from django.db import models


class StudentAIConversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "institutions.Organization", on_delete=models.CASCADE,
        related_name="student_ai_conversations",
    )
    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE,
        related_name="ai_conversations",
    )
    section = models.ForeignKey(
        "academics.Section", on_delete=models.CASCADE,
        related_name="student_ai_conversations",
    )
    subject = models.ForeignKey(
        "academics.Subject", on_delete=models.CASCADE,
        null=True, blank=True, related_name="student_ai_conversations",
    )
    mode = models.CharField(
        max_length=12, choices=[("dashboard", "My Dashboard"), ("tutor", "Subject Tutor")]
    )
    title = models.CharField(max_length=100)
    enabled_features_at_creation = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        indexes = [
            models.Index(fields=["organization", "student", "-updated_at"],
                         name="student_ai_conv_scope_idx"),
        ]


class StudentAIMessage(models.Model):
    conversation = models.ForeignKey(
        StudentAIConversation, on_delete=models.CASCADE, related_name="messages",
    )
    role = models.CharField(
        max_length=10, choices=[("user", "Student"), ("assistant", "AI Tutor")]
    )
    content = models.TextField()
    links = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["conversation", "created_at"],
                         name="student_ai_msg_time_idx"),
        ]
