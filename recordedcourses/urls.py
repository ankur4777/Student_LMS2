from django.urls import path

from .views import (
    CollegeAdminRecordedCourseDetailAPIView,
    CollegeAdminRecordedCourseLessonsAPIView,
    CollegeAdminRecordedCoursesAPIView,
    CollegeAdminRecordedLessonDetailAPIView,
)

urlpatterns = [
    path("college-admin/courses/", CollegeAdminRecordedCoursesAPIView.as_view(), name="college-admin-recorded-courses"),
    path("college-admin/courses/<int:course_id>/", CollegeAdminRecordedCourseDetailAPIView.as_view(), name="college-admin-recorded-course-detail"),
    path("college-admin/courses/<int:course_id>/lessons/", CollegeAdminRecordedCourseLessonsAPIView.as_view(), name="college-admin-recorded-course-lessons"),
    path("college-admin/lessons/<int:lesson_id>/", CollegeAdminRecordedLessonDetailAPIView.as_view(), name="college-admin-recorded-lesson-detail"),
]
