from django.urls import path

from .views import (
    CollegeAdminLeaveRequestsAPIView,
    CollegeAdminLeaveReviewAPIView,
    ParentLeaveRequestsAPIView,
    TeacherLeaveRequestsAPIView,
)

urlpatterns = [
    path("parent/", ParentLeaveRequestsAPIView.as_view(), name="parent-leave-requests"),
    path("teacher/", TeacherLeaveRequestsAPIView.as_view(), name="teacher-leave-requests"),
    path("college-admin/", CollegeAdminLeaveRequestsAPIView.as_view(), name="admin-leave-requests"),
    path("college-admin/<int:request_id>/review/", CollegeAdminLeaveReviewAPIView.as_view(), name="admin-leave-review"),
]
