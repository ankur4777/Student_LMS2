from django.urls import path

from .views import (
    CollegeAdminAcademicSessionDetailAPIView,
    CollegeAdminAcademicSessionsAPIView,
    CollegeAdminClassDetailAPIView,
    CollegeAdminClassesAPIView,
    CollegeAdminSectionDetailAPIView,
    CollegeAdminSectionsAPIView,
    CollegeAdminSubjectDetailAPIView,
    CollegeAdminSubjectsAPIView,
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
    path(
        "college-admin/classes/",
        CollegeAdminClassesAPIView.as_view(),
        name="college-admin-classes",
    ),
    path(
        "college-admin/classes/<int:classroom_id>/",
        CollegeAdminClassDetailAPIView.as_view(),
        name="college-admin-class-detail",
    ),
    path(
        "college-admin/sections/",
        CollegeAdminSectionsAPIView.as_view(),
        name="college-admin-sections",
    ),
    path(
        "college-admin/sections/<int:section_id>/",
        CollegeAdminSectionDetailAPIView.as_view(),
        name="college-admin-section-detail",
    ),
    path(
        "college-admin/subjects/",
        CollegeAdminSubjectsAPIView.as_view(),
        name="college-admin-subjects",
    ),
    path(
        "college-admin/subjects/<int:subject_id>/",
        CollegeAdminSubjectDetailAPIView.as_view(),
        name="college-admin-subject-detail",
    ),
]
