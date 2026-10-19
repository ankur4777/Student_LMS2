"""Parent-initiated single-class leave requests and college-admin approval.

Every queryset is scoped from the authenticated user's role and organization.
Never trust a browser-supplied student, teacher, organization, or decision-maker.
A leave approval does not automatically rewrite official attendance.
"""

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.feature_access import get_student_profile_active_enrollment
from academics.models import ParentStudent
from academics.subject_access import allowed_subject_ids_for_student
from accounts.models import User
from liveclasses.models import LiveClass
from notifications.models import Notification
from notifications.services import create_notification

from .models import LeaveRequest


def _authorized_user(request, role):
    user = request.user
    if (
        not user.is_authenticated
        or not user.is_active
        or user.role != role
        or not user.organization_id
        or not user.organization.is_active
    ):
        return None
    return user


def _profile_name(profile):
    user = profile.user
    return user.get_full_name().strip() or user.username


def _is_future_class(live_class):
    now = timezone.localtime()
    if live_class.class_date > now.date():
        return True
    if live_class.class_date < now.date():
        return False
    return live_class.start_time > now.time().replace(tzinfo=None)


def _parent_links(parent_user):
    return ParentStudent.objects.filter(
        parent__user=parent_user,
        parent__user__is_active=True,
        parent__user__organization=parent_user.organization,
        student__user__is_active=True,
        student__user__organization=parent_user.organization,
    ).select_related("student", "student__user")


def _eligible_classes(student, organization):
    """Classes scheduled for this student's active section and allowed subjects."""
    enrollment = get_student_profile_active_enrollment(student, organization)
    if not enrollment or not student.user.is_active:
        return LiveClass.objects.none()

    now = timezone.localtime()
    return (
        LiveClass.objects.filter(
            organization=organization,
            status=LiveClass.Status.SCHEDULED,
            teacher_assignment__is_active=True,
            teacher_assignment__section=enrollment.section,
            teacher_assignment__section__organization=organization,
            teacher_assignment__subject__classroom=enrollment.section.classroom,
            teacher_assignment__subject__organization=organization,
            teacher_assignment__teacher__user__organization=organization,
            teacher_assignment__teacher__user__is_active=True,
            teacher_assignment__subject_id__in=allowed_subject_ids_for_student(student),
        )
        .filter(
            Q(class_date__gt=now.date())
            | Q(class_date=now.date(), start_time__gt=now.time().replace(tzinfo=None))
        )
        .select_related(
            "teacher_assignment__teacher__user",
            "teacher_assignment__subject",
            "teacher_assignment__section",
        )
        .order_by("class_date", "start_time", "id")
    )


def _serialize_class(live_class, *, student_id=None):
    assignment = live_class.teacher_assignment
    details = {
        "id": live_class.id,
        "title": live_class.title,
        "class_date": live_class.class_date,
        "start_time": live_class.start_time,
        "end_time": live_class.end_time,
        "subject": assignment.subject.name,
        "section": assignment.section.name,
        "teacher": _profile_name(assignment.teacher),
    }
    if student_id is not None:
        details["student_id"] = student_id
    return details


def _serialize_request(leave):
    assignment = leave.live_class.teacher_assignment
    return {
        "id": leave.id,
        "student_id": leave.student_id,
        "student_name": _profile_name(leave.student),
        "parent_name": _profile_name(leave.parent),
        "live_class": _serialize_class(leave.live_class),
        "reason": leave.reason,
        "status": leave.status,
        "admin_note": leave.admin_note,
        "created_at": leave.created_at,
        "reviewed_at": leave.reviewed_at,
        "reviewed_by": (
            leave.reviewed_by.get_full_name().strip()
            or leave.reviewed_by.username
            if leave.reviewed_by_id else None
        ),
    }


def _request_queryset():
    return LeaveRequest.objects.select_related(
        "organization",
        "student__user",
        "parent__user",
        "live_class__teacher_assignment__teacher__user",
        "live_class__teacher_assignment__subject",
        "live_class__teacher_assignment__section",
        "reviewed_by",
    )


def _notify_created(leave):
    organization = leave.organization
    student_name = _profile_name(leave.student)
    class_name = leave.live_class.title
    when = leave.live_class.class_date.strftime("%d %b %Y")

    teacher_user = leave.live_class.teacher_assignment.teacher.user
    if (
        teacher_user.is_active
        and teacher_user.organization_id == organization.id
        and leave.live_class.teacher_assignment.is_active
    ):
        create_notification(
            organization=organization,
            user=teacher_user,
            title="Student Leave Request",
            message=f"{student_name} may miss {class_name} on {when}. A parent has requested leave.",
            notification_type=Notification.Type.GENERAL,
            related_url="/teacher/leave-requests",
        )

    for admin in User.objects.filter(
        role=User.Role.COLLEGE_ADMIN,
        is_active=True,
        organization=organization,
    ):
        create_notification(
            organization=organization,
            user=admin,
            title="Leave Approval Required",
            message=f"Please review the parent's request for {student_name} to miss {class_name} on {when}.",
            notification_type=Notification.Type.GENERAL,
            related_url="/college-admin/leave-requests",
        )


def _notify_review(leave):
    state = leave.get_status_display().lower()
    class_name = leave.live_class.title
    when = leave.live_class.class_date.strftime("%d %b %Y")
    message = f"Your leave request for {class_name} on {when} was {state} by the college admin."
    parent_user = leave.parent.user

    if parent_user.is_active and parent_user.organization_id == leave.organization_id:
        create_notification(
            organization=leave.organization,
            user=parent_user,
            title=f"Leave Request {leave.get_status_display()}",
            message=message,
            notification_type=Notification.Type.GENERAL,
            related_url="/parent/leave-requests",
        )
    teacher_user = leave.live_class.teacher_assignment.teacher.user
    if teacher_user.is_active and teacher_user.organization_id == leave.organization_id:
        create_notification(
            organization=leave.organization,
            user=teacher_user,
            title=f"Student Leave {leave.get_status_display()}",
            message=f"{_profile_name(leave.student)}: {message}",
            notification_type=Notification.Type.GENERAL,
            related_url="/teacher/leave-requests",
        )


class ParentLeaveRequestsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = _authorized_user(request, User.Role.PARENT)
        if not user:
            return Response({"detail": "Parent access required."}, status=403)

        links = list(_parent_links(user))
        children = []
        available = []
        for link in links:
            enrollment = get_student_profile_active_enrollment(link.student, user.organization)
            if not enrollment:
                continue
            children.append({
                "id": link.student_id,
                "name": _profile_name(link.student),
                "classroom": enrollment.section.classroom.name,
                "section": enrollment.section.name,
            })
            # Limit output size and avoid exposing unrelated students/classes.
            for live_class in _eligible_classes(link.student, user.organization)[:40]:
                available.append(_serialize_class(live_class, student_id=link.student_id))

        linked_student_ids = [child["id"] for child in children]
        existing = _request_queryset().filter(
            parent__user=user,
            organization=user.organization,
            student_id__in=linked_student_ids,
            student__user__organization=user.organization,
        )[:100]

        return Response({
            "children": children,
            "upcoming_classes": available,
            "requests": [_serialize_request(item) for item in existing],
        })

    def post(self, request):
        user = _authorized_user(request, User.Role.PARENT)
        if not user:
            return Response({"detail": "Parent access required."}, status=403)

        try:
            student_id = int(request.data.get("student_id", 0))
            class_id = int(request.data.get("live_class_id", 0))
        except (TypeError, ValueError):
            return Response({"detail": "Choose a valid student and class."}, status=400)
        if student_id < 1 or class_id < 1:
            return Response({"detail": "Choose a valid student and class."}, status=400)

        reason = request.data.get("reason", "")
        if not isinstance(reason, str) or not 10 <= len(reason.strip()) <= 1000:
            return Response({"detail": "Provide a reason of 10 to 1000 characters."}, status=400)
        reason = reason.strip()

        link = _parent_links(user).filter(student_id=student_id).first()
        if not link:
            return Response({"detail": "Linked student not found."}, status=404)

        live_class = _eligible_classes(link.student, user.organization).filter(id=class_id).first()
        if not live_class or not _is_future_class(live_class):
            return Response({"detail": "Upcoming class not found for this student."}, status=404)

        try:
            with transaction.atomic():
                leave = LeaveRequest.objects.create(
                    organization=user.organization,
                    student=link.student,
                    parent=link.parent,
                    live_class=live_class,
                    reason=reason,
                )
                _notify_created(leave)
        except IntegrityError:
            return Response({"detail": "A leave request already exists for this student and class."}, status=409)

        leave = _request_queryset().get(id=leave.id)
        return Response({"request": _serialize_request(leave)}, status=status.HTTP_201_CREATED)


class TeacherLeaveRequestsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = _authorized_user(request, User.Role.TEACHER)
        if not user:
            return Response({"detail": "Teacher access required."}, status=403)

        records = _request_queryset().filter(
            organization=user.organization,
            live_class__organization=user.organization,
            live_class__teacher_assignment__teacher__user=user,
            live_class__teacher_assignment__is_active=True,
            live_class__teacher_assignment__section__organization=user.organization,
            student__user__organization=user.organization,
        )[:100]
        return Response({"requests": [_serialize_request(item) for item in records]})


class CollegeAdminLeaveRequestsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = _authorized_user(request, User.Role.COLLEGE_ADMIN)
        if not user:
            return Response({"detail": "College admin access required."}, status=403)
        records = _request_queryset().filter(
            organization=user.organization,
            live_class__organization=user.organization,
            student__user__organization=user.organization,
        )[:200]
        return Response({"requests": [_serialize_request(item) for item in records]})


class CollegeAdminLeaveReviewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, request_id):
        user = _authorized_user(request, User.Role.COLLEGE_ADMIN)
        if not user:
            return Response({"detail": "College admin access required."}, status=403)

        action = request.data.get("action")
        if action not in (LeaveRequest.Status.APPROVED, LeaveRequest.Status.REJECTED):
            return Response({"detail": "Action must be approved or rejected."}, status=400)
        note = request.data.get("admin_note", "")
        if not isinstance(note, str) or len(note.strip()) > 500:
            return Response({"detail": "Admin note must be 500 characters or less."}, status=400)

        with transaction.atomic():
            leave = (
                _request_queryset().select_for_update()
                .filter(
                    id=request_id,
                    organization=user.organization,
                    live_class__organization=user.organization,
                    student__user__organization=user.organization,
                )
                .first()
            )
            if not leave:
                return Response({"detail": "Leave request not found."}, status=404)
            if leave.status != LeaveRequest.Status.PENDING:
                return Response({"detail": "This leave request has already been reviewed."}, status=409)
            if leave.live_class.status == LiveClass.Status.CANCELLED:
                return Response({"detail": "This class was cancelled."}, status=409)

            leave.status = action
            leave.admin_note = note.strip()
            leave.reviewed_by = user
            leave.reviewed_at = timezone.now()
            leave.save(update_fields=["status", "admin_note", "reviewed_by", "reviewed_at"])
            _notify_review(leave)

        return Response({"request": _serialize_request(leave)})
