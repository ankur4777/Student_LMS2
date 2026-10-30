"""Signed, time-bound playback sessions for new Recorded Learning modules.

A ticket shows that a logged-in student started an authorized learning
session. Client video events cannot prove attentive viewing; keep describing
completion as learner-reported. Server minimum time blocks immediate
completion without a session, but it is not anti-cheating evidence.
"""
from datetime import timedelta

from django.core import signing
from django.utils import timezone

PLAYBACK_TICKET_SALT = "mysls.recorded-learning.playback.v1"
PLAYBACK_TICKET_MAX_AGE = 4 * 60 * 60
MIN_VIEW_SECONDS = 10


class PlaybackTicketError(Exception):
    pass


def create_playback_ticket(student, lesson):
    issued_at = timezone.now()
    ticket = signing.dumps({
        "student": student.pk,
        "lesson": lesson.pk,
        "course": lesson.course_id,
        "organization": lesson.course.organization_id,
        "issued_at": issued_at.isoformat(),
    }, salt=PLAYBACK_TICKET_SALT, compress=True)
    return {
        "ticket": ticket,
        "minimum_seconds": MIN_VIEW_SECONDS,
        "expires_in_seconds": PLAYBACK_TICKET_MAX_AGE,
    }


def verify_playback_ticket(ticket, student, lesson):
    if not isinstance(ticket, str) or not ticket or len(ticket) > 2500:
        raise PlaybackTicketError("Start playback before completing this lesson.")
    try:
        payload = signing.loads(
            ticket,
            salt=PLAYBACK_TICKET_SALT,
            max_age=PLAYBACK_TICKET_MAX_AGE,
        )
    except signing.SignatureExpired as exc:
        raise PlaybackTicketError("This playback session has expired. Play the lesson again.") from exc
    except (signing.BadSignature, TypeError, ValueError) as exc:
        raise PlaybackTicketError("Invalid playback session.") from exc

    if not isinstance(payload, dict) or any(
        type(payload.get(key)) is not int or payload[key] != expected
        for key, expected in (
            ("student", student.pk),
            ("lesson", lesson.pk),
            ("course", lesson.course_id),
            ("organization", lesson.course.organization_id),
        )
    ):
        raise PlaybackTicketError("This playback session belongs to another student or lesson.")
    try:
        started_at = timezone.datetime.fromisoformat(payload["issued_at"])
    except (KeyError, TypeError, ValueError) as exc:
        raise PlaybackTicketError("Invalid session timestamp.") from exc
    now = timezone.now()
    if started_at.tzinfo is None or started_at > now + timedelta(seconds=5):
        raise PlaybackTicketError("Invalid session timestamp.")
    seconds = (now - started_at).total_seconds()
    if seconds < MIN_VIEW_SECONDS:
        raise PlaybackTicketError(
            "Play the lesson for at least %s seconds before marking it viewed."
            % MIN_VIEW_SECONDS
        )
    return True
