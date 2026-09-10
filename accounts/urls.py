from django.urls import path

from .views import (
    StudentDashboardAPIView,
    StudentLoginAPIView,
    TeacherDashboardView,
    TeacherLoginAPIView,
)

urlpatterns = [
    path(
        'student/dashboard/',
        StudentDashboardAPIView.as_view(),
        name='student-dashboard'
    ),
    path(
    'student/login/',
    StudentLoginAPIView.as_view(),
    name='student-login'
),
    path(
    "teacher/dashboard/",
    TeacherDashboardView.as_view(),
    name="teacher-dashboard",
),
    path(
    "teacher/login/",
    TeacherLoginAPIView.as_view(),
    name="teacher-login",
),
]