"""Read-only student authorization and subject context for the AI assistant.

Never accept a student or organization ID supplied by a chat client.
The caller must be authenticated and its organization verified first.
"""

from academics.feature_access import get_active_student_enrollment, get_student_feature_map
from academics.models import Subject
from academics.subject_access import student_studies_subject


def get_authorized_student_context(user):
    """Return (context, denial_reason); no student data on denial."""
    enrollment = get_active_student_enrollment(user)
    if enrollment is None:
        return None, "An active student account and enrollment are required."

    feature_map, _ = get_student_feature_map(user)
    if not feature_map.get("ai_assistant", False):
        return None, "AI Assistant is not enabled for your class."

    classroom = enrollment.section.classroom
    student = enrollment.student

    # Both the college AND student's enrolled classroom must match.
    # student_studies_subject applies the existing individual overrides.
    candidates = Subject.objects.filter(
        organization_id=user.organization_id,
        classroom=classroom,
        classroom__organization_id=user.organization_id,
        classroom__academic_session__organization_id=user.organization_id,
    ).order_by("name", "id")

    subjects = [
        {"id": subject.id, "name": subject.name, "code": subject.code}
        for subject in candidates
        if student_studies_subject(student, subject)
    ]

    return {
        "student": {
            "name": user.get_full_name().strip() or user.username,
            "classroom": classroom.name,
            "section": enrollment.section.name,
            "roll_number": enrollment.roll_number,
        },
        "subjects": subjects,
        "feature_access": feature_map,
    }, None
