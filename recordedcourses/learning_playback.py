"""Signed playback tickets plus server-bounded heartbeat milestones.

Client media position and duration are untrusted claims. This records
plausible active playback intervals; it does not prove attentive viewing.
"""
import math
import uuid
from datetime import datetime, timedelta

from django.core import signing
from django.db import transaction
from django.utils import timezone

from .models import LessonPlaybackSession

PLAYBACK_TICKET_SALT = "mysls.recorded-learning.playback.v1"
PLAYBACK_TICKET_MAX_AGE = 4 * 60 * 60
MIN_VIEW_SECONDS = 10
MIN_HEARTBEATS = 2
HEARTBEAT_MIN_INTERVAL = 3
HEARTBEAT_MAX_GAP = 15


class PlaybackTicketError(Exception):
    pass


def create_playback_ticket(student, lesson):
    issued_at = timezone.now()
    with transaction.atomic():
        session, _ = LessonPlaybackSession.objects.select_for_update().get_or_create(
            student=student, lesson=lesson,
        )
        session.session_id = uuid.uuid4()
        session.started_at = issued_at
        session.last_heartbeat_at = issued_at
        session.last_position_seconds = 0
        session.duration_seconds = None
        session.credited_seconds = 0
        session.heartbeat_count = 0
        session.completed_at = None
        session.save()
    ticket = signing.dumps({
        "student": student.pk, "lesson": lesson.pk,
        "course": lesson.course_id,
        "organization": lesson.course.organization_id,
        "session_id": str(session.session_id),
        "issued_at": issued_at.isoformat(),
    }, salt=PLAYBACK_TICKET_SALT, compress=True)
    return {
        "ticket": ticket,
        "minimum_seconds": MIN_VIEW_SECONDS,
        "verified_duration_seconds": lesson.verified_duration_seconds,
        "heartbeat_interval_seconds": 5,
        "expires_in_seconds": PLAYBACK_TICKET_MAX_AGE,
    }


def verify_playback_ticket(ticket, student, lesson, require_minimum=True):
    if not isinstance(ticket, str) or not ticket or len(ticket) > 2500:
        raise PlaybackTicketError("Start playback before completing this lesson.")
    try:
        payload = signing.loads(
            ticket, salt=PLAYBACK_TICKET_SALT,
            max_age=PLAYBACK_TICKET_MAX_AGE,
        )
    except signing.SignatureExpired as exc:
        raise PlaybackTicketError("Playback session expired. Start the lesson again.") from exc
    except (signing.BadSignature, TypeError, ValueError) as exc:
        raise PlaybackTicketError("Invalid playback session.") from exc
    if not isinstance(payload, dict) or any(
        type(payload.get(k)) is not int or payload[k] != v
        for k, v in (
            ("student", student.pk), ("lesson", lesson.pk),
            ("course", lesson.course_id),
            ("organization", lesson.course.organization_id),
        )
    ):
        raise PlaybackTicketError("This session belongs to another student or lesson.")
    try:
        started_at = datetime.fromisoformat(payload["issued_at"])
        session_id = uuid.UUID(payload["session_id"])
    except (KeyError, TypeError, ValueError, AttributeError) as exc:
        raise PlaybackTicketError("Invalid playback session.") from exc
    now = timezone.now()
    if started_at.tzinfo is None or started_at > now + timedelta(seconds=5):
        raise PlaybackTicketError("Invalid session timestamp.")
    if require_minimum and (now - started_at).total_seconds() < MIN_VIEW_SECONDS:
        raise PlaybackTicketError(
            "Play the lesson for at least %s seconds before completion." % MIN_VIEW_SECONDS
        )
    session = LessonPlaybackSession.objects.filter(
        student=student, lesson=lesson, session_id=session_id,
    ).first()
    if session is None:
        raise PlaybackTicketError("Playback session was restarted. Play this lesson again.")
    return session


def record_playback_milestone(ticket, student, lesson, position, duration):
    if (type(position) not in (float, int) or type(duration) not in (float, int)
            or not math.isfinite(position) or not math.isfinite(duration)
            or not 1 <= duration <= 86400 or not 0 <= position <= duration + 2):
        raise PlaybackTicketError("Provide valid video position and duration.")
    verified = lesson.verified_duration_seconds
    if verified is not None:
        tolerance = max(0.5, verified * 0.03)
        if abs(duration - verified) > tolerance or position > verified + 2:
            raise PlaybackTicketError(
                "Playback duration does not match this server-verified video."
            )
    effective_duration = verified if verified is not None else duration
    session = verify_playback_ticket(ticket, student, lesson, require_minimum=False)
    with transaction.atomic():
        current = LessonPlaybackSession.objects.select_for_update().get(pk=session.pk)
        if current.session_id != session.session_id or current.completed_at is not None:
            raise PlaybackTicketError("This playback session is no longer active.")
        if current.duration_seconds is not None and abs(current.duration_seconds - effective_duration) > 0.5:
            raise PlaybackTicketError("Video duration changed; start playback again.")
        now = timezone.now()
        elapsed = max(0, (now - current.last_heartbeat_at).total_seconds())
        # A very short clip may only provide one reporting event before end.
        interval = min(HEARTBEAT_MIN_INTERVAL, effective_duration * .75)
        if elapsed < interval:
            raise PlaybackTicketError("Playback updates are too frequent.")
        # A pause, hidden tab or lost connection cannot credit a long idle gap.
        proposed = position - current.last_position_seconds
        plausible = (
            0 < proposed <= elapsed * 1.25 + 2
            and elapsed <= HEARTBEAT_MAX_GAP
        )
        credited = min(proposed, elapsed * 1.1, 12) if plausible else 0
        current.last_position_seconds = position
        current.last_heartbeat_at = now
        current.duration_seconds = effective_duration if current.duration_seconds is None else current.duration_seconds
        if credited > 0:
            current.heartbeat_count += 1
            current.credited_seconds = min(
                current.duration_seconds, current.credited_seconds + credited,
            )
        current.save(update_fields=[
            "last_position_seconds", "last_heartbeat_at", "duration_seconds",
            "heartbeat_count", "credited_seconds",
        ])
    return {
        "heartbeats": current.heartbeat_count,
        "credited_seconds": round(current.credited_seconds, 2),
        "duration_seconds": current.duration_seconds,
        "milestone_percent": min(100, round(
            100 * current.credited_seconds / current.duration_seconds,
        )),
        "accepted": credited > 0,
    }


def require_playback_completion(ticket, student, lesson):
    session = verify_playback_ticket(
        ticket, student, lesson, require_minimum=False,
    )
    duration = session.duration_seconds
    verified = lesson.verified_duration_seconds
    if verified is not None and duration is not None and abs(duration - verified) > 0.5:
        raise PlaybackTicketError("Video duration was updated. Restart playback.")
    needed_heartbeats = MIN_HEARTBEATS if duration and duration >= MIN_VIEW_SECONDS else 1
    if not duration or session.heartbeat_count < needed_heartbeats:
        raise PlaybackTicketError("Watch the lesson with progress tracking enabled.")
    # Allow short clips to count after their reported near-complete playback;
    # normal clips still require >=10 server seconds and multiple heartbeats.
    elapsed = (timezone.now() - session.started_at).total_seconds()
    required_elapsed = min(MIN_VIEW_SECONDS, duration * .8)
    if elapsed < required_elapsed:
        raise PlaybackTicketError("Keep playing before marking this lesson complete.")
    # Duration is reported by the browser, not independently verified.
    required = duration * .8 if duration < MIN_VIEW_SECONDS else max(MIN_VIEW_SECONDS, duration * .8)
    if session.credited_seconds + .2 < required:
        raise PlaybackTicketError(
            "Watch more of the lesson before marking it complete."
        )
    return session
