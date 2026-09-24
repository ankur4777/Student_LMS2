from django.urls import path
from .views import (
    CollegeAdminDetailedAnalyticsAPIView,
    CollegeAdminFilterOptionsAPIView,
    CollegeAdminOverviewAPIView,
)

urlpatterns = [
    path("college-admin/overview/", CollegeAdminOverviewAPIView.as_view(), name="college-admin-reports-overview"),
    path("college-admin/filters/", CollegeAdminFilterOptionsAPIView.as_view(), name="college-admin-reports-filters"),
    path("college-admin/details/", CollegeAdminDetailedAnalyticsAPIView.as_view(), name="college-admin-reports-details"),
]
