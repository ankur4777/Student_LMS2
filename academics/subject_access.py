from django.db.models import Q

from .models import StudentEnrollment, Subject, SubjectStudentAccess


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


def allowed_subject_ids_for_student(student):
    excluded_subject_ids = SubjectStudentAccess.objects.filter(
        student=student,
        is_enrolled=False,
    ).values_list(
        "subject_id",
        flat=True,
    )

    all_mode_ids = list(
        Subject.objects.filter(
            student_assignment_mode=Subject.StudentAssignmentMode.ALL
        ).exclude(
            id__in=excluded_subject_ids,
        ).values_list(
            "id",
            flat=True,
        )
    )

    selected_mode_ids = list(
        SubjectStudentAccess.objects.filter(
            student=student,
            is_enrolled=True,
            subject__student_assignment_mode=(
                Subject.StudentAssignmentMode.SELECTED
            ),
        ).values_list(
            "subject_id",
            flat=True,
        )
    )

    return set(all_mode_ids + selected_mode_ids)


def subject_access_filter(prefix, student):
    allowed_ids = allowed_subject_ids_for_student(student)
    return Q(**{f"{prefix}_id__in": allowed_ids})
