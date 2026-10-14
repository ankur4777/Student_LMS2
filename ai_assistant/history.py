"""Read-only conversation lookup and safe persistence for the AI Tutor.

The browser never chooses student, college, section, or AI prompt history.
All previous dialogue is loaded from authenticated student-specific records.
"""

import uuid

from django.db import transaction
from django.utils import timezone

from .models import StudentAIConversation, StudentAIMessage


def conversation_queryset(user, enrollment, context):
    enabled = {
        key for key, allowed in context["feature_access"].items() if allowed
    }
    allowed_subject_ids = {subject["id"] for subject in context["subjects"]}
    rows = StudentAIConversation.objects.filter(
        organization_id=user.organization_id,
        student=enrollment.student,
        section=enrollment.section,
    ).select_related("subject")
    # Never redisplay a historical response for a revoked class feature,
    # subject or enrollment. Queries are bounded by one enrolled student.
    return [
        row for row in rows
        if set(row.enabled_features_at_creation).issubset(enabled)
        and (row.mode != "tutor" or row.subject_id in allowed_subject_ids)
    ]


def get_conversation(user, enrollment, context, raw_id):
    try:
        conversation_id = uuid.UUID(str(raw_id))
    except (TypeError, ValueError, AttributeError):
        return None
    return next(
        (row for row in conversation_queryset(user, enrollment, context)
         if row.id == conversation_id),
        None,
    )


def serialize_conversation(row):
    return {
        "id": str(row.id),
        "title": row.title,
        "mode": row.mode,
        "subject_id": row.subject_id,
        "subject_name": row.subject.name if row.subject_id else None,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


def serialize_message(row):
    return {
        "id": row.id,
        "role": row.role,
        "content": row.content,
        "links": row.links,
        "created_at": row.created_at.isoformat(),
    }


def trusted_links(links):
    valid = {
        "/student/profile", "/student/forgot-password", "/student/recorded-classes",
        "/student/recorded-courses", "/student/online-exams", "/student/results",
        "/student/attendance", "/student/assignments", "/student/classes",
        "/student/documents", "/student/fees", "/student/notifications",
        "/student/dashboard",
    }
    if not isinstance(links, list):
        return []
    return [
        {"label": item["label"][:80], "href": item["href"]}
        for item in links if isinstance(item, dict)
        and isinstance(item.get("label"), str)
        and isinstance(item.get("href"), str)
        and item["href"] in valid
    ][:5]


def persist_exchange(*, existing, user, enrollment, context,
                     mode, subject, question, answer, links=None):
    """Create new conversation lazily, only after obtaining a successful reply."""
    with transaction.atomic():
        row = existing
        if row is None:
            row = StudentAIConversation.objects.create(
                organization_id=user.organization_id,
                student=enrollment.student,
                section=enrollment.section,
                subject_id=subject["id"] if subject else None,
                mode=mode,
                title=question[:100],
                enabled_features_at_creation=[
                    key for key, allowed in context["feature_access"].items()
                    if allowed
                ],
            )
        StudentAIMessage.objects.create(
            conversation=row, role="user", content=question,
        )
        StudentAIMessage.objects.create(
            conversation=row, role="assistant", content=answer,
            links=trusted_links(links),
        )
        StudentAIConversation.objects.filter(pk=row.pk).update(
            updated_at=timezone.now()
        )
        row.refresh_from_db(fields=["updated_at"])
    return row


def prompt_history(conversation):
    if conversation is None:
        return []
    recent = list(conversation.messages.order_by("-id")[:8])
    return [
        {"role": row.role, "content": row.content[:1500]}
        for row in reversed(recent)
    ]
