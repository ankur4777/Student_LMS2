from django.urls import path

from .views import (
    CollegeAdminAcademicSessionDetailAPIView,
    CollegeAdminAcademicSessionsAPIView,
)

urlpatterns = [
    path(
        "college-admin/academic-sessions/",
        CollegeAdminAcademicSessionsAPIView.as_view(),
        name="college-admin-academic-sessions",
    ),
    path(
        "college-admin/academic-sessions/<int:session_id>/",
        CollegeAdminAcademicSessionDetailAPIView.as_view(),
        name="college-admin-academic-session-detail",
    ),
]
