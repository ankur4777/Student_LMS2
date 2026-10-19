from django.conf import settings
from django.db import models


class LeaveRequest(models.Model):
    """One parent's request for a linked student to miss a scheduled class."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    organization = models.ForeignKey(
        "institutions.Organization",
        on_delete=models.CASCADE,
        related_name="leave_requests",
    )
    student = models.ForeignKey(
        "accounts.StudentProfile",
        on_delete=models.CASCADE,
        related_name="leave_requests",
    )
    parent = models.ForeignKey(
        "accounts.ParentProfile",
        on_delete=models.CASCADE,
        related_name="submitted_leave_requests",
    )
    live_class = models.ForeignKey(
        "liveclasses.LiveClass",
        on_delete=models.PROTECT,
        related_name="leave_requests",
    )
    reason = models.TextField(max_length=1000)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_leave_requests",
    )
    admin_note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=("student", "live_class"),
                name="unique_student_class_leave_request",
            )
        ]
        indexes = [
            models.Index(fields=("organization", "status"), name="leave_org_status_idx"),
            models.Index(fields=("parent", "created_at"), name="leave_parent_created_idx"),
        ]

    def __str__(self):
        return f"{self.student} - {self.live_class} - {self.status}"
