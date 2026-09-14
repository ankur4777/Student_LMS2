from django.urls import path
from .views import TeacherAttendanceSetupAPIView

from .views import (
    StudentAttendanceAPIView,
    StudentAttendanceSummaryAPIView,
)
from .views import (
    TeacherAttendanceSetupAPIView,
    TeacherSaveAttendanceAPIView,
    TeacherAttendanceSessionAPIView,
    ParentStudentAttendanceAPIView,
)


urlpatterns = [
    path(
        'student/',
        StudentAttendanceAPIView.as_view(),
        name='student-attendance'
    ),

    path(
        'student/summary/',
        StudentAttendanceSummaryAPIView.as_view(),
        name='student-attendance-summary'
    ),
    path(
    'teacher/setup/',
    TeacherAttendanceSetupAPIView.as_view(),
    name='teacher-attendance-setup'
),
    path(
    'teacher/save/',
    TeacherSaveAttendanceAPIView.as_view(),
    name='teacher-save-attendance'
),
    path(
    'teacher/session/',
    TeacherAttendanceSessionAPIView.as_view(),
    name='teacher-attendance-session'
),
    path(
        "parent/student/<int:student_id>/",
        ParentStudentAttendanceAPIView.as_view(),
        name="parent-student-attendance",
    ),
]