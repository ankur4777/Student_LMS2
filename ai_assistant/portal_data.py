"""Additional read-only Student Portal modules for authorized AI Dashboard chat.

Each query is bound to the authenticated student, organization, enrollment,
enabled class features and authorized subject IDs. Private videos, answer
keys, file paths, authentication material and unpublished grades are excluded.
"""

from django.db.models import Q
from django.utils import timezone

from academics.models import Subject
from documents.models import Document
from liveclasses.models import LiveClass
from notices.models import Notice
from notifications.models import Notification
from recordedcourses.models import (
    RecordedClassAccess, RecordedClassPurchase,
    RecordedCourse, RecordedCourseAccess, RecordedCoursePurchase,
)
from studentresults.models import Exam, ExamAttempt


def student_portal_module_facts(user, enrollment, allowed_subject_ids, features):
    student = enrollment.student
    org_id = user.organization_id
    section = enrollment.section
    subject_ids = list(allowed_subject_ids)
    now = timezone.now()
    facts = {
        "enrolled_subjects": list(
            Subject.objects.filter(
                organization_id=org_id,
                classroom=section.classroom,
                id__in=subject_ids,
            ).order_by("name").values_list("name", flat=True)
        ),
    }

    if features.get("recorded_classes"):
        classes = list(
            LiveClass.objects.filter(
                organization_id=org_id,
                teacher_assignment__section=section,
                teacher_assignment__subject_id__in=subject_ids,
                teacher_assignment__subject__organization_id=org_id,
                status=LiveClass.Status.COMPLETED,
                recording__is_available=True,
            ).exclude(recording__video="").select_related(
                "recording", "teacher_assignment__subject",
            ).order_by("-class_date", "-start_time")[:12]
        )
        recording_ids = [item.recording.id for item in classes]
        accesses = {
            access.recording_id: access
            for access in RecordedClassAccess.objects.filter(
                organization_id=org_id,
                student=student,
                recording_id__in=recording_ids,
                is_active=True,
                revoked_at__isnull=True,
            )
        }
        purchases = {}
        for purchase in RecordedClassPurchase.objects.filter(
            organization_id=org_id,
            student=student,
            recording_id__in=recording_ids,
        ).order_by("-created_at"):
            purchases.setdefault(purchase.recording_id, purchase.status)

        facts["recorded_classes"] = []
        for item in classes:
            recording = item.recording
            access = accesses.get(recording.id)
            authorized = bool(access and access.has_access)
            facts["recorded_classes"].append({
                "title": recording.title or item.title,
                "class_title": item.title,
                "subject": item.teacher_assignment.subject.name,
                "class_date": item.class_date.isoformat(),
                "price": str(recording.price) if recording.price is not None else None,
                "has_access": authorized,
                "purchase_status": purchases.get(recording.id),
                "access_expires_at": (
                    access.expires_at.isoformat()
                    if authorized and access.expires_at else None
                ),
            })

    if features.get("recorded_courses"):
        courses = list(RecordedCourse.objects.filter(
            organization_id=org_id, is_active=True,
        ).order_by("-created_at")[:12])
        access_by_course = {
            access.course_id: access
            for access in RecordedCourseAccess.objects.filter(
                organization_id=org_id, student=student,
                course_id__in=[course.id for course in courses],
                is_active=True, revoked_at__isnull=True,
            )
        }
        purchase_by_course = {}
        for purchase in RecordedCoursePurchase.objects.filter(
            organization_id=org_id,
            student=student,
            course_id__in=[course.id for course in courses],
        ).order_by("-created_at"):
            purchase_by_course.setdefault(purchase.course_id, purchase.status)

        facts["recorded_courses"] = []
        for course in courses:
            access = access_by_course.get(course.id)
            authorized = bool(access and access.has_access)
            facts["recorded_courses"].append({
                "title": course.title,
                "description": course.description[:350],
                "price": str(course.price),
                "has_access": authorized,
                "purchase_status": purchase_by_course.get(course.id),
                "access_expires_at": (
                    access.expires_at.isoformat()
                    if authorized and access.expires_at else None
                ),
                # Lesson titles are only listed for students with current access.
                "lesson_titles": (
                    list(course.lessons.filter(
                        is_active=True,
                    ).order_by("position").values_list("title", flat=True)[:10])
                    if authorized else []
                ),
            })

    if features.get("results"):
        exams = list(Exam.objects.filter(
            organization_id=org_id,
            section=section,
            online_is_open=True,
            online_teacher_assignment__isnull=False,
            online_teacher_assignment__subject_id__in=subject_ids,
            online_teacher_assignment__subject__organization_id=org_id,
            online_teacher_assignment__section=section,
        ).select_related(
            "online_teacher_assignment__subject",
        ).order_by("-online_starts_at")[:12])
        attempts = {
            attempt.exam_id: attempt
            for attempt in ExamAttempt.objects.filter(
                student=student, exam__in=exams,
            )
        }
        facts["online_exams"] = []
        for exam in exams:
            attempt = attempts.get(exam.id)
            published_final = bool(
                attempt
                and exam.is_published
                and attempt.state == ExamAttempt.State.GRADED
            )
            facts["online_exams"].append({
                "title": exam.name,
                "subject": exam.online_teacher_assignment.subject.name,
                "starts_at": (
                    exam.online_starts_at.isoformat()
                    if exam.online_starts_at else None
                ),
                "ends_at": (
                    exam.online_ends_at.isoformat()
                    if exam.online_ends_at else None
                ),
                "duration_minutes": exam.online_duration_minutes,
                "attempt_status": attempt.state if attempt else "not_started",
                "result_published": published_final,
                "final_marks": (
                    str(attempt.objective_marks + attempt.subjective_marks)
                    if published_final else None
                ),
            })

    if features.get("documents"):
        documents = Document.objects.filter(
            organization_id=org_id,
            teacher_assignment__section=section,
            teacher_assignment__subject_id__in=subject_ids,
            teacher_assignment__subject__organization_id=org_id,
            teacher_assignment__is_active=True,
            is_published=True,
        ).select_related("teacher_assignment__subject").order_by(
            "-published_at", "-created_at"
        )[:12]
        facts["documents"] = [
            {
                "title": doc.title,
                "subject": doc.teacher_assignment.subject.name,
                "type": doc.document_type,
                "description": doc.description[:250],
            }
            for doc in documents
        ]

    # Notices are visible to all students by their audience, and not governed
    # by a separate ClassFeatureAccess key. Match the Student Notices API.
    notices = Notice.objects.filter(
        organization_id=org_id,
        is_active=True,
        publish_at__lte=now,
    ).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=now)
    ).filter(
        Q(audience=Notice.Audience.EVERYONE)
        | Q(audience=Notice.Audience.STUDENTS)
        | Q(audience=Notice.Audience.CLASS, classroom=section.classroom)
        | Q(audience=Notice.Audience.SECTION, section=section)
    ).order_by("-publish_at")[:8]
    facts["notices"] = [
        {"title": n.title, "message": n.message[:350],
         "published_at": n.publish_at.isoformat()}
        for n in notices
    ]

    if features.get("notifications"):
        notifications = Notification.objects.filter(
            organization_id=org_id, user=user
        ).order_by("-created_at")[:10]
        facts["notifications"] = [
            {
                "title": n.title,
                "message": n.message[:300],
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifications
        ]

    return facts
