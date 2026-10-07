import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

from academics.feature_access import parent_child_feature_is_enabled
from academics.models import ParentStudent, StudentEnrollment
from academics.subject_access import eligible_enrollments_for_subject
from accounts.models import User
from studentresults.models import StudentResult

from .models import Notification


LOGGER = logging.getLogger(__name__)


def _format_time_12_hour(value):
    if not value:
        return "-"
    return value.strftime("%I:%M %p").lstrip("0")


def _notification_link(notification):
    related_url = str(notification.related_url or "").strip()
    if not related_url:
        return ""

    if related_url.startswith("http://") or related_url.startswith("https://"):
        return related_url

    frontend_base = getattr(
        settings,
        "LMS_FRONTEND_URL",
        getattr(settings, "PASSWORD_RESET_FRONTEND_URL", ""),
    ).rstrip("/")

    if not frontend_base:
        return related_url

    if not related_url.startswith("/"):
        related_url = f"/{related_url}"

    return f"{frontend_base}{related_url}"


def _send_notification_email(notification):
    email = str(notification.user.email or "").strip()
    if not email:
        return

    recipient_name = (
        notification.user.get_full_name().strip()
        or notification.user.username
    )
    link = _notification_link(notification)

    message_lines = [
        f"Hello {recipient_name},",
        "",
        notification.message,
    ]

    if link:
        message_lines.extend(
            [
                "",
                f"Open Student LMS: {link}",
            ]
        )

    message_lines.extend(
        [
            "",
            "This is an automatic notification from Student LMS.",
        ]
    )

    send_mail(
        subject=f"Student LMS - {notification.title}",
        message="\n".join(message_lines),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )


def _send_notification_email_safely(notification_id):
    try:
        notification = Notification.objects.select_related("user").get(
            id=notification_id
        )
        _send_notification_email(notification)
    except Exception:
        LOGGER.exception(
            "Unable to send notification email for notification id %s",
            notification_id,
        )


def create_notification(
    *,
    organization,
    user,
    title,
    message,
    notification_type,
    related_url=None,
):
    if not organization or not user:
        return None

    notification, created = Notification.objects.get_or_create(
        organization=organization,
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        related_url=related_url,
        defaults={
            "is_read": False,
        },
    )

    if created and str(user.email or "").strip():
        transaction.on_commit(
            lambda notification_id=notification.id: (
                _send_notification_email_safely(notification_id)
            )
        )

    return notification


def notify_notice_user(notice, user):
    related_urls = {
        "student": "/student/dashboard",
        "teacher": "/teacher/dashboard",
        "parent": "/parent/dashboard",
    }

    related_url = related_urls.get(user.role)
    if not related_url:
        return None

    return create_notification(
        organization=notice.organization,
        user=user,
        title="New Notice",
        message=f'New notice "{notice.title}": {notice.message}',
        notification_type=Notification.Type.GENERAL,
        related_url=related_url,
    )


def notify_notice_published(notice):
    organization = notice.organization

    students = User.objects.filter(
        role="student",
        organization=organization,
        is_active=True,
    )
    teachers = User.objects.filter(
        role="teacher",
        organization=organization,
        is_active=True,
    )
    parents = User.objects.filter(
        role="parent",
        organization=organization,
        is_active=True,
    )

    recipients = []

    if notice.audience == "everyone":
        recipients.extend((user, "/student/dashboard") for user in students)
        recipients.extend((user, "/teacher/dashboard") for user in teachers)
        recipients.extend((user, "/parent/dashboard") for user in parents)

    elif notice.audience == "students":
        recipients.extend((user, "/student/dashboard") for user in students)

    elif notice.audience == "teachers":
        recipients.extend((user, "/teacher/dashboard") for user in teachers)

    elif notice.audience == "parents":
        recipients.extend((user, "/parent/dashboard") for user in parents)

    elif notice.audience in {"class", "section"}:
        enrollment_filters = {
            "is_active": True,
            "student__user__organization": organization,
        }

        if notice.audience == "class":
            enrollment_filters["section__classroom"] = notice.classroom
        else:
            enrollment_filters["section"] = notice.section

        enrollments = StudentEnrollment.objects.filter(
            **enrollment_filters
        ).select_related(
            "student",
            "student__user",
        )

        targeted_students = [enrollment.student for enrollment in enrollments]

        recipients.extend(
            (student.user, "/student/dashboard")
            for student in targeted_students
            if student.user.is_active
        )

        parent_links = ParentStudent.objects.filter(
            student__in=targeted_students,
            parent__user__organization=organization,
            parent__user__is_active=True,
        ).select_related(
            "parent",
            "parent__user",
        )

        recipients.extend(
            (link.parent.user, "/parent/dashboard")
            for link in parent_links
        )

    seen_user_ids = set()

    for user, related_url in recipients:
        if user.id in seen_user_ids:
            continue

        seen_user_ids.add(user.id)

        notify_notice_user(notice, user)


def notify_assignment_published(assignment):
    teacher_assignment = assignment.teacher_assignment
    organization = assignment.organization

    enrollments = eligible_enrollments_for_subject(
        teacher_assignment.subject,
        section=teacher_assignment.section,
        organization=organization,
    ).select_related(
        "student",
        "student__user",
    )

    students = [enrollment.student for enrollment in enrollments]

    for student in students:
        create_notification(
            organization=organization,
            user=student.user,
            title="New Assignment",
            message=(
                f'A new assignment "{assignment.title}" has been '
                f"published for {teacher_assignment.subject.name}."
            ),
            notification_type=Notification.Type.ASSIGNMENT,
            related_url="/student/assignments",
        )

    parent_links = ParentStudent.objects.filter(
        student__in=students,
        student__user__organization=organization,
        parent__user__organization=organization,
    ).select_related(
        "parent",
        "parent__user",
    )

    for link in parent_links:
        create_notification(
            organization=organization,
            user=link.parent.user,
            title="New Assignment",
            message=(
                f'A new assignment "{assignment.title}" has been '
                "published for your child."
            ),
            notification_type=Notification.Type.ASSIGNMENT,
            related_url="/parent/assignments",
        )


def notify_assignment_submitted(submission):
    assignment = submission.assignment
    teacher_assignment = assignment.teacher_assignment
    organization = assignment.organization
    teacher_user = teacher_assignment.teacher.user
    student_user = submission.student.user

    if teacher_user.organization_id != organization.id:
        return None

    if student_user.organization_id != organization.id:
        return None

    student_name = (
        student_user.get_full_name().strip()
        or student_user.username
    )

    return create_notification(
        organization=organization,
        user=teacher_user,
        title="Assignment Submitted",
        message=(
            f'{student_name} submitted "{assignment.title}" '
            f"for {teacher_assignment.subject.name}."
        ),
        notification_type=Notification.Type.ASSIGNMENT,
        related_url=(
            f"/teacher/assignments/{assignment.id}/submissions"
        ),
    )


def notify_assignment_graded(submission):
    assignment = submission.assignment
    organization = assignment.organization
    student_user = submission.student.user

    if student_user.organization_id != organization.id:
        return None

    create_notification(
        organization=organization,
        user=student_user,
        title="Assignment Graded",
        message=(
            f'Your assignment "{assignment.title}" has been graded.'
        ),
        notification_type=Notification.Type.ASSIGNMENT,
        related_url="/student/assignments",
    )

    parent_links = ParentStudent.objects.filter(
        student=submission.student,
        student__user__organization=organization,
        parent__user__organization=organization,
    ).select_related(
        "parent",
        "parent__user",
    )

    for link in parent_links:
        create_notification(
            organization=organization,
            user=link.parent.user,
            title="Assignment Graded",
            message=(
                f'Your child\'s assignment "{assignment.title}" '
                "has been graded."
            ),
            notification_type=Notification.Type.ASSIGNMENT,
            related_url="/parent/assignments",
        )

    return None


def notify_document_published(document):
    teacher_assignment = document.teacher_assignment
    organization = document.organization

    enrollments = eligible_enrollments_for_subject(
        teacher_assignment.subject,
        section=teacher_assignment.section,
        organization=organization,
    ).select_related(
        "student",
        "student__user",
    )

    students = [enrollment.student for enrollment in enrollments]

    for student in students:
        create_notification(
            organization=organization,
            user=student.user,
            title="New Document",
            message=(
                f'A new document "{document.title}" has been '
                f"published for {teacher_assignment.subject.name}."
            ),
            notification_type=Notification.Type.GENERAL,
            related_url="/student/documents",
        )

    parent_links = ParentStudent.objects.filter(
        student__in=students,
        student__user__organization=organization,
        parent__user__organization=organization,
    ).select_related(
        "parent",
        "parent__user",
    )

    for link in parent_links:
        if not parent_child_feature_is_enabled(
            link.parent.user,
            link.student_id,
            "documents",
        ):
            continue

        if not parent_child_feature_is_enabled(
            link.parent.user,
            link.student_id,
            "notifications",
        ):
            continue

        create_notification(
            organization=organization,
            user=link.parent.user,
            title="New Document",
            message=(
                f'A new document "{document.title}" has been '
                "published for your child."
            ),
            notification_type=Notification.Type.GENERAL,
            related_url="/parent/documents",
        )

    college_admins = User.objects.filter(
        role="college_admin",
        organization=organization,
    )

    for admin in college_admins:
        create_notification(
            organization=organization,
            user=admin,
            title="Document Published",
            message=(
                f'"{document.title}" was published by '
                f"{teacher_assignment.teacher}."
            ),
            notification_type=Notification.Type.GENERAL,
            related_url=f"/college-admin/documents/{document.id}",
        )


def notify_exam_created(exam, teacher_assignment=None):
    organization = exam.organization

    if teacher_assignment is not None:
        enrollments = eligible_enrollments_for_subject(
            teacher_assignment.subject,
            section=exam.section,
            organization=organization,
        ).select_related(
            "student",
            "student__user",
        )
    else:
        enrollments = StudentEnrollment.objects.filter(
            section=exam.section,
            is_active=True,
            section__organization=organization,
            student__user__organization=organization,
        ).select_related(
            "student",
            "student__user",
        )

    students = [enrollment.student for enrollment in enrollments]

    subject_suffix = ""
    if teacher_assignment is not None:
        subject_suffix = f" for {teacher_assignment.subject.name}"

    for student in students:
        create_notification(
            organization=organization,
            user=student.user,
            title="New Exam Scheduled",
            message=(
                f'Exam "{exam.name}"{subject_suffix} is scheduled '
                f"for {exam.exam_date}."
            ),
            notification_type=Notification.Type.GENERAL,
            related_url="/student/dashboard",
        )

    parent_links = ParentStudent.objects.filter(
        student__in=students,
        student__user__organization=organization,
        parent__user__organization=organization,
    ).select_related(
        "parent",
        "parent__user",
    )

    for link in parent_links:
        create_notification(
            organization=organization,
            user=link.parent.user,
            title="New Exam Scheduled",
            message=(
                f'Exam "{exam.name}"{subject_suffix} is scheduled '
                f"for your child on {exam.exam_date}."
            ),
            notification_type=Notification.Type.GENERAL,
            related_url="/parent/dashboard",
        )


def notify_exam_published(exam):
    organization = exam.organization

    results = StudentResult.objects.filter(
        exam=exam,
        exam__organization=organization,
        student__user__organization=organization,
    ).select_related(
        "student",
        "student__user",
    )

    students_by_id = {
        result.student_id: result.student
        for result in results
    }

    students = list(students_by_id.values())

    for student in students:
        create_notification(
            organization=organization,
            user=student.user,
            title="Result Published",
            message=(
                f'Your result for "{exam.name}" has been published.'
            ),
            notification_type=Notification.Type.RESULT,
            related_url="/student/results",
        )

    parent_links = ParentStudent.objects.filter(
        student__in=students,
        student__user__organization=organization,
        parent__user__organization=organization,
    ).select_related(
        "parent",
        "parent__user",
    )

    for link in parent_links:
        create_notification(
            organization=organization,
            user=link.parent.user,
            title="Result Published",
            message=(
                f'Your child\'s result for "{exam.name}" '
                "has been published."
            ),
            notification_type=Notification.Type.RESULT,
            related_url="/parent/results",
        )


def notify_live_class_scheduled(live_class):
    teacher_assignment = live_class.teacher_assignment
    organization = live_class.organization
    start_time = _format_time_12_hour(live_class.start_time)

    teacher_user = teacher_assignment.teacher.user
    if teacher_user.organization_id == organization.id:
        create_notification(
            organization=organization,
            user=teacher_user,
            title="Live Class Scheduled",
            message=(
                f'Live class "{live_class.title}" has been scheduled '
                f"for {teacher_assignment.subject.name} on "
                f"{live_class.class_date} at {start_time}."
            ),
            notification_type=Notification.Type.LIVE_CLASS,
            related_url="/teacher/classes",
        )

    enrollments = eligible_enrollments_for_subject(
        teacher_assignment.subject,
        section=teacher_assignment.section,
        organization=organization,
    ).select_related(
        "student",
        "student__user",
    )

    students = []

    for enrollment in enrollments:
        students.append(enrollment.student)
        create_notification(
            organization=organization,
            user=enrollment.student.user,
            title="Live Class Scheduled",
            message=(
                f'A live class "{live_class.title}" has been '
                f"scheduled for {teacher_assignment.subject.name} "
                f"on {live_class.class_date} at "
                f"{start_time}."
            ),
            notification_type=Notification.Type.LIVE_CLASS,
            related_url="/student/dashboard",
        )

    parent_links = ParentStudent.objects.filter(
        student__in=students,
        student__user__organization=organization,
        parent__user__organization=organization,
    ).select_related(
        "parent",
        "parent__user",
    )

    for link in parent_links:
        create_notification(
            organization=organization,
            user=link.parent.user,
            title="Live Class Scheduled",
            message=(
                f'A live class "{live_class.title}" has been '
                f"scheduled for your child on {live_class.class_date} "
                f"at {live_class.start_time}."
            ),
            notification_type=Notification.Type.LIVE_CLASS,
            related_url="/parent/dashboard",
        )


def notify_recording_available(recording):
    live_class = recording.live_class
    teacher_assignment = live_class.teacher_assignment
    organization = live_class.organization

    enrollments = eligible_enrollments_for_subject(
        teacher_assignment.subject,
        section=teacher_assignment.section,
        organization=organization,
    ).select_related(
        "student",
        "student__user",
    )

    students = []

    for enrollment in enrollments:
        students.append(enrollment.student)
        create_notification(
            organization=organization,
            user=enrollment.student.user,
            title="Class Recording Uploaded",
            message=(
                f'The recording for "{live_class.title}" - '
                f"{teacher_assignment.subject.name} has been uploaded. "
                "Open Recorded Classes to check purchase availability."
            ),
            notification_type=Notification.Type.LIVE_CLASS,
            related_url="/student/recorded-classes",
        )

    parent_links = ParentStudent.objects.filter(
        student__in=students,
        student__user__organization=organization,
        parent__user__organization=organization,
    ).select_related(
        "parent",
        "parent__user",
    )

    for link in parent_links:
        create_notification(
            organization=organization,
            user=link.parent.user,
            title="Class Recording Uploaded",
            message=(
                f'The recording for "{live_class.title}" has been '
                "uploaded for your child."
            ),
            notification_type=Notification.Type.LIVE_CLASS,
            related_url="/parent/dashboard",
        )
