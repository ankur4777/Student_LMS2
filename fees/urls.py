from django.urls import path

from .views import (
    CollegeAdminFeeSetupAPIView,
    CollegeAdminFeeStructureDetailAPIView,
    CollegeAdminFeeStructuresAPIView,
)


urlpatterns = [
    path(
        "college-admin/setup/",
        CollegeAdminFeeSetupAPIView.as_view(),
        name="college-admin-fee-setup",
    ),
    path(
        "college-admin/structures/",
        CollegeAdminFeeStructuresAPIView.as_view(),
        name="college-admin-fee-structures",
    ),
    path(
        "college-admin/structures/<int:structure_id>/",
        CollegeAdminFeeStructureDetailAPIView.as_view(),
        name="college-admin-fee-structure-detail",
    ),
]
