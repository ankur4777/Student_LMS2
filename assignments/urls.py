from django.urls import path

from .views import (
    TeacherAssignmentsAPIView,
    TeacherAssignmentCreateAPIView,
    TeacherAssignmentSetupAPIView,
    TeacherAssignmentDetailAPIView,
    StudentAssignmentsAPIView,
    StudentAssignmentSubmitAPIView,
    TeacherAssignmentSubmissionsAPIView,
    TeacherSubmissionAttachmentAPIView,
    TeacherGradeSubmissionAPIView,
)

urlpatterns = [
    path(
        "teacher/",
        TeacherAssignmentsAPIView.as_view(),
        name="teacher-assignments"
    ),

    path(
        "teacher/create/",
        TeacherAssignmentCreateAPIView.as_view(),
        name="teacher-assignment-create"
    ),
    path(
    "teacher/setup/",
    TeacherAssignmentSetupAPIView.as_view(),
    name="teacher-assignment-setup"
),
    path(
    "teacher/<int:assignment_id>/",
    TeacherAssignmentDetailAPIView.as_view(),
    name="teacher-assignment-detail"
),
    path(
    "student/",
    StudentAssignmentsAPIView.as_view(),
    name="student-assignments"
),
    path(
    "student/<int:assignment_id>/submit/",
    StudentAssignmentSubmitAPIView.as_view(),
    name="student-assignment-submit"
),
    path(
    "teacher/<int:assignment_id>/submissions/",
    TeacherAssignmentSubmissionsAPIView.as_view(),
    name="teacher-assignment-submissions"
),
    path(
    "teacher/submissions/<int:submission_id>/attachment/",
    TeacherSubmissionAttachmentAPIView.as_view(),
    name="teacher-submission-attachment"
),
    path(
    "teacher/submissions/<int:submission_id>/grade/",
    TeacherGradeSubmissionAPIView.as_view(),
    name="teacher-grade-submission"
),
]