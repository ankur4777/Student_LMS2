"""Permission-filtered, read-only LMS facts for the student's AI chat.

Do not accept student IDs, organization IDs, class IDs or sections from the
chat client. All records are derived from the authenticated enrollment.
"""

from decimal import Decimal

from django.utils import timezone

from assignments.models import Assignment, AssignmentSubmission
from attendance.models import StudentAttendance
from documents.models import Document
from fees.models import StudentFee
from liveclasses.models import LiveClass
from studentresults.models import StudentResult


def teacher_materials(user, enrollment, subject_id, features):
    """Only metadata for currently published documents, never private file bytes."""
    if not features.get("documents"):
        return []

    documents = Document.objects.filter(
        organization_id=user.organization_id,
        is_published=True,
        teacher_assignment__is_active=True,
        teacher_assignment__section=enrollment.section,
        teacher_assignment__section__organization_id=user.organization_id,
        teacher_assignment__subject_id=subject_id,
        teacher_assignment__subject__organization_id=user.organization_id,
    ).order_by("-published_at", "-created_at")[:8]

    return [
        {
            "title": doc.title,
            "description": doc.description[:500],
            "type": doc.document_type,
        }
        for doc in documents
    ]


def student_dashboard_facts(user, enrollment, allowed_subject_ids, features):
    """Only data already available to this student in enabled LMS modules."""
    student = enrollment.student
    organization_id = user.organization_id
    section = enrollment.section
    ids = list(allowed_subject_ids)
    facts = {
        "as_of": timezone.localdate().isoformat(),
        "student": {
            "name": user.get_full_name().strip() or user.username,
            "classroom": section.classroom.name,
            "section": section.name,
            "roll_number": enrollment.roll_number,
        },
        "visible_modules": [
            key for key, enabled in features.items()
            if enabled and key != "ai_assistant"
        ],
    }

    if features.get("attendance"):
        records = StudentAttendance.objects.filter(
            student=student,
            attendance_session__organization_id=organization_id,
            attendance_session__section=section,
            attendance_session__subject_id__in=ids,
        )
        counts = {
            status: records.filter(status=status).count()
            for status in (
                StudentAttendance.Status.PRESENT,
                StudentAttendance.Status.LATE,
                StudentAttendance.Status.ABSENT,
                StudentAttendance.Status.EXCUSED,
            )
        }
        counted = counts["present"] + counts["late"] + counts["absent"]
        facts["attendance"] = {
            **counts,
            "total_records": sum(counts.values()),
            "percentage": round(
                (counts["present"] + counts["late"]) / counted * 100, 2
            ) if counted else 0,
        }

    if features.get("assignments"):
        assignments = list(Assignment.objects.filter(
            organization_id=organization_id,
            teacher_assignment__section=section,
            teacher_assignment__section__organization_id=organization_id,
            teacher_assignment__subject_id__in=ids,
            teacher_assignment__is_active=True,
            is_published=True,
        ).select_related("teacher_assignment__subject").order_by(
            "due_date", "due_time", "-created_at"
        )[:12])
        submissions = {
            submission.assignment_id: submission
            for submission in AssignmentSubmission.objects.filter(
                student=student, assignment__in=assignments
            )
        }
        facts["assignments"] = [
            {
                "title": a.title,
                "subject": a.teacher_assignment.subject.name,
                "due_date": a.due_date.isoformat(),
                "due_time": a.due_time.isoformat() if a.due_time else None,
                "submitted": a.id in submissions,
                "status": submissions[a.id].status if a.id in submissions else "pending",
            }
            for a in assignments
        ]

    if features.get("results"):
        results = StudentResult.objects.filter(
            student=student,
            exam__organization_id=organization_id,
            exam__section=section,
            exam__is_published=True,
            subject_id__in=ids,
            subject__organization_id=organization_id,
        ).select_related("exam", "subject").order_by(
            "-exam__exam_date", "subject__name"
        )[:12]
        facts["published_results"] = [
            {
                "exam": result.exam.name,
                "date": result.exam.exam_date.isoformat(),
                "subject": result.subject.name,
                "marks": str(result.marks_obtained),
                "maximum": str(result.maximum_marks),
            }
            for result in results
        ]

    if features.get("classes"):
        classes = LiveClass.objects.filter(
            organization_id=organization_id,
            teacher_assignment__section=section,
            teacher_assignment__section__organization_id=organization_id,
            teacher_assignment__subject_id__in=ids,
            class_date__gte=timezone.localdate(),
            status__in=[LiveClass.Status.SCHEDULED, LiveClass.Status.LIVE],
        ).select_related("teacher_assignment__subject").order_by(
            "class_date", "start_time"
        )[:10]
        facts["upcoming_classes"] = [
            {
                "title": item.title,
                "subject": item.teacher_assignment.subject.name,
                "date": item.class_date.isoformat(),
                "starts_at": item.start_time.isoformat(timespec="minutes"),
                "status": item.status,
            }
            for item in classes
        ]

    if features.get("fees"):
        assigned_fees = StudentFee.objects.filter(
            organization_id=organization_id,
            student=student,
            academic_session=section.classroom.academic_session,
            fee_structure__organization_id=organization_id,
        ).select_related("fee_structure").prefetch_related("payments")[:8]
        facts["fees"] = []
        for fee in assigned_fees:
            paid = sum((p.amount for p in fee.payments.all()), Decimal("0"))
            facts["fees"].append({
                "name": fee.fee_structure.name,
                "payable": str(fee.payable_amount),
                "paid": str(paid),
                "outstanding": str(fee.payable_amount - paid),
                "due_date": fee.due_date.isoformat(),
                "status": fee.status,
            })

    return facts
