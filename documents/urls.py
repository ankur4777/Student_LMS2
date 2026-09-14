from django.urls import path

from .views import (
    StudentDocumentDownloadAPIView,
    StudentDocumentListAPIView,
    TeacherDocumentDetailAPIView,
    TeacherDocumentDownloadAPIView,
    TeacherDocumentListAPIView,
    TeacherDocumentSetupAPIView,
    TeacherDocumentUploadAPIView,
)


urlpatterns = [
    path(
        "student/",
        StudentDocumentListAPIView.as_view(),
        name="student-document-list",
    ),
    path(
        "student/<int:document_id>/download/",
        StudentDocumentDownloadAPIView.as_view(),
        name="student-document-download",
    ),
    path(
        "teacher/setup/",
        TeacherDocumentSetupAPIView.as_view(),
        name="teacher-document-setup",
    ),
    path(
        "teacher/",
        TeacherDocumentListAPIView.as_view(),
        name="teacher-document-list",
    ),
    path(
        "teacher/upload/",
        TeacherDocumentUploadAPIView.as_view(),
        name="teacher-document-upload",
    ),
    path(
        "teacher/<int:document_id>/",
        TeacherDocumentDetailAPIView.as_view(),
        name="teacher-document-detail",
    ),
    path(
        "teacher/<int:document_id>/download/",
        TeacherDocumentDownloadAPIView.as_view(),
        name="teacher-document-download",
    ),
]
