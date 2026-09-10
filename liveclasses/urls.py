from django.urls import path

from .views import (
    StudentLiveClassesAPIView,
    StudentTodayClassesAPIView,
    StudentUpcomingClassesAPIView,
    StudentCompletedClassesAPIView,
    StudentRecordedClassesAPIView,
    StudentRecordingPlaybackAPIView,
    TeacherRecordingUploadAPIView,
    TeacherRecordingEligibleClassesAPIView,
    TeacherRecordingsAPIView,
    TeacherRecordingDetailAPIView,
    TeacherLiveClassesAPIView,
)


urlpatterns = [
    path(
        'student/classes/',
        StudentLiveClassesAPIView.as_view(),
        name='student-live-classes'
    ),

    path(
        'student/today/',
        StudentTodayClassesAPIView.as_view(),
        name='student-today-classes'
    ),
    path(
    'student/upcoming/',
    StudentUpcomingClassesAPIView.as_view(),
    name='student-upcoming-classes'
),
    path(
    'student/completed/',
    StudentCompletedClassesAPIView.as_view(),
    name='student-completed-classes'
),
    path(
    'student/recorded/',
    StudentRecordedClassesAPIView.as_view(),
    name='student-recorded-classes'
),
    path(
    'student/recordings/<uuid:public_id>/play/',
    StudentRecordingPlaybackAPIView.as_view(),
    name='student-recording-play'
),
    path(
    'teacher/recordings/upload/',
    TeacherRecordingUploadAPIView.as_view(),
    name='teacher-recording-upload'
),
    path(
    'teacher/recordings/eligible-classes/',
    TeacherRecordingEligibleClassesAPIView.as_view(),
    name='teacher-recording-eligible-classes'
),
    path(
    'teacher/recordings/',
    TeacherRecordingsAPIView.as_view(),
    name='teacher-recordings'
),
    path(
    'teacher/recordings/<uuid:public_id>/',
    TeacherRecordingDetailAPIView.as_view(),
    name='teacher-recording-detail'
),
    path(
    'teacher/classes/',
    TeacherLiveClassesAPIView.as_view(),
    name='teacher-classes'
),
    
]