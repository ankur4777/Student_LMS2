from django.urls import path

from .views import (
    StudentDashboardAPIView,
    StudentLoginAPIView,
    TeacherDashboardView,
    TeacherLoginAPIView,
    ParentLoginAPIView,
    ParentChildrenAPIView,
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
    path(
    "parent/login/",
    ParentLoginAPIView.as_view(),
    name="parent-login",
),  
    path(
    "parent/children/",
    ParentChildrenAPIView.as_view(),
    name="parent-children",
),
]