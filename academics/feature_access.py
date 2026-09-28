from rest_framework.permissions import BasePermission

from .models import ClassFeatureAccess, StudentEnrollment


FEATURE_DEFINITIONS = [
    {"key": key, "label": label}
    for key, label in ClassFeatureAccess.Feature.choices
]


def get_active_student_enrollment(user):
    if (
        not user
        or not getattr(user, "is_authenticated", False)
        or user.role != "student"
        or not user.is_active
        or not user.organization
        or not user.organization.is_active
    ):
        return None

    return (
        StudentEnrollment.objects.filter(
            student__user=user,
            student__user__organization=user.organization,
            is_active=True,
            section__organization=user.organization,
            section__classroom__organization=user.organization,
            section__classroom__academic_session__organization=user.organization,
        )
        .select_related(
            "section",
            "section__classroom",
            "section__classroom__academic_session",
        )
        .order_by(
            "-section__classroom__academic_session__is_active",
            "-enrolled_at",
            "-id",
        )
        .first()
    )


def get_student_feature_map(user):
    feature_map = {
        definition["key"]: False
        for definition in FEATURE_DEFINITIONS
    }

    enrollment = get_active_student_enrollment(user)

    if not enrollment:
        return feature_map, None

    classroom = enrollment.section.classroom

    feature_map = {
        definition["key"]: True
        for definition in FEATURE_DEFINITIONS
    }

    overrides = ClassFeatureAccess.objects.filter(
        organization=user.organization,
        classroom=classroom,
        feature_key__in=feature_map.keys(),
    ).values_list("feature_key", "is_enabled")

    for feature_key, is_enabled in overrides:
        feature_map[feature_key] = is_enabled

    return feature_map, classroom


def student_feature_is_enabled(user, feature_key):
    valid_keys = {
        definition["key"]
        for definition in FEATURE_DEFINITIONS
    }

    if feature_key not in valid_keys:
        return False

    if getattr(user, "role", None) != "student":
        return True

    feature_map, classroom = get_student_feature_map(user)

    if not classroom:
        return False

    return feature_map.get(feature_key, False)


class StudentClassFeaturePermission(BasePermission):
    message = "This feature has been restricted for your class."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if getattr(user, "role", None) != "student":
            return True

        feature_key = getattr(view, "student_feature_key", None)

        if not feature_key:
            return True

        return student_feature_is_enabled(user, feature_key)
