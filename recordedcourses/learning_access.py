"""Organization-level access to the new MySLS learning & certification feature.

This entitlement is deliberately independent of the pre-existing purchased
recorded-course catalog. A disabled setting does not revoke historic purchases
or alter legacy recorded video playback.
"""

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.feature_access import student_feature_is_enabled
from institutions.models import Organization
from .models import OrganizationLearningSettings


def learning_enabled_for_org(organization):
    """Fail closed if settings are missing or the organization is inactive."""
    if organization is None or not organization.is_active:
        return False
    return OrganizationLearningSettings.objects.filter(
        organization=organization, is_enabled=True,
    ).exists()


class OrganizationLearningEnabled(BasePermission):
    """Use on all NEW course learning, assessment and certificate APIs.

    The parent flow must also enforce linked-child access in each specific view.
    Do not apply to legacy recorded-course purchases/playback.
    """
    message = "Learning & Certification is not enabled for this organization."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if user.role not in ("college_admin", "teacher", "student", "parent"):
            return False
        if not learning_enabled_for_org(getattr(user, "organization", None)):
            return False
        if user.role == "student":
            return student_feature_is_enabled(user, "recorded_courses")
        if user.role == "parent":
            # Parent endpoints require a linked-child, class-aware permission,
            # which will be added with the Parent Learning Center phase.
            return False
        return True


class CurrentOrganizationLearningSettingsAPIView(APIView):
    """Read-only status used to decide whether new learning UI may be shown."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.is_active or user.role not in (
            "college_admin", "teacher", "student", "parent",
        ):
            return Response({"detail": "This account cannot view learning settings."}, status=403)
        org = user.organization
        if org is None or not org.is_active:
            return Response({"detail": "No active organization is linked to this account."}, status=403)
        enabled = learning_enabled_for_org(org)
        if user.role == "student":
            effective = enabled and student_feature_is_enabled(user, "recorded_courses")
        elif user.role == "parent":
            # This status is informational only for parents until per-child APIs.
            effective = False
        else:
            effective = enabled
        return Response({
            "organization_id": org.pk,
            "organization_name": org.name,
            "is_enabled": enabled,
            "can_use_learning_center": effective,
            "feature": "recorded_learning_certification",
        })


class PlatformAdminOrganizationLearningSettingsAPIView(APIView):
    """Only a MySLS platform admin may change organization entitlements."""
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _is_allowed(user):
        return user.is_active and (user.is_superuser or user.role == "platform_admin")

    def get(self, request, organization_id):
        if not self._is_allowed(request.user):
            return Response({"detail": "Platform admin permission required."}, status=403)
        org = get_object_or_404(Organization, pk=organization_id)
        return Response({
            "organization_id": org.pk,
            "organization_name": org.name,
            "is_enabled": learning_enabled_for_org(org),
            "organization_active": org.is_active,
        })

    def patch(self, request, organization_id):
        if not self._is_allowed(request.user):
            return Response({"detail": "Platform admin permission required."}, status=403)
        if not isinstance(request.data, dict) or type(request.data.get("is_enabled")) is not bool:
            return Response({"detail": "is_enabled must be true or false."}, status=400)
        org = get_object_or_404(Organization, pk=organization_id)
        desired = request.data["is_enabled"]
        if desired and not org.is_active:
            return Response({"detail": "An inactive organization cannot enable learning."}, status=400)
        with transaction.atomic():
            obj, _ = OrganizationLearningSettings.objects.select_for_update().get_or_create(
                organization=org,
                defaults={"is_enabled": desired, "updated_by": request.user},
            )
            if obj.is_enabled != desired or obj.updated_by_id != request.user.pk:
                obj.is_enabled = desired
                obj.updated_by = request.user
                obj.save(update_fields=["is_enabled", "updated_by", "updated_at"])
        return Response({
            "organization_id": org.pk,
            "organization_name": org.name,
            "is_enabled": obj.is_enabled,
            "message": "Organization learning access updated.",
        })
