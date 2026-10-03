from django.db.models import Q

from .models import StudentEnrollment, Subject


def student_studies_subject(student, subject):
    override = subject.student_access_overrides.filter(
        student=student
    ).first()

    if override is not None:
        return override.is_enrolled

    return (
        subject.student_assignment_mode
        == Subject.StudentAssignmentMode.ALL
    )


def eligible_enrollments_for_subject(
    subject,
    *,
    section=None,
    organization=None,
):
    enrollments = StudentEnrollment.objects.filter(
        is_active=True,
        section__classroom=subject.classroom,
    )

    if section is not None:
        enrollments = enrollments.filter(section=section)

    if organization is not None:
        enrollments = enrollments.filter(
            section__organization=organization,
            student__user__organization=organization,
        )

    overrides = subject.student_access_overrides

    if subject.student_assignment_mode == Subject.StudentAssignmentMode.ALL:
        excluded_ids = overrides.filter(
            is_enrolled=False
        ).values_list(
            "student_id",
            flat=True,
        )
        enrollments = enrollments.exclude(
            student_id__in=excluded_ids
        )
    else:
        included_ids = overrides.filter(
            is_enrolled=True
        ).values_list(
            "student_id",
            flat=True,
        )
        enrollments = enrollments.filter(
            student_id__in=included_ids
        )

    return enrollments


def subject_access_filter(prefix, student):
    all_mode = Q(
        **{
            f"{prefix}__student_assignment_mode":
                Subject.StudentAssignmentMode.ALL
        }
    ) & ~Q(
        **{
            f"{prefix}__student_access_overrides__student": student,
            f"{prefix}__student_access_overrides__is_enrolled": False,
        }
    )

    selected_mode = Q(
        **{
            f"{prefix}__student_assignment_mode":
                Subject.StudentAssignmentMode.SELECTED,
            f"{prefix}__student_access_overrides__student": student,
            f"{prefix}__student_access_overrides__is_enrolled": True,
        }
    )

    return all_mode | selected_mode
