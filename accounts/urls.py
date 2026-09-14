from django.urls import path

from .views import (
    StudentDashboardAPIView,
    StudentProfileAPIView,
    StudentLoginAPIView,
    TeacherDashboardView,
    TeacherLoginAPIView,
    ParentLoginAPIView,
    ParentChildrenAPIView,
    ParentProfileAPIView,
)

urlpatterns = [
    path(
        'student/dashboard/',
        StudentDashboardAPIView.as_view(),
        name='student-dashboard'
    ),
    path(
    'student/profile/',
    StudentProfileAPIView.as_view(),
    name='student-profile'
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
    path(
    "parent/profile/",
    ParentProfileAPIView.as_view(),
    name="parent-profile",
),
]
