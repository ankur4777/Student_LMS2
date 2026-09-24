from django.urls import path

from .views import CollegeAdminOverviewAPIView


urlpatterns = [
    path(
        "college-admin/overview/",
        CollegeAdminOverviewAPIView.as_view(),
        name="college-admin-reports-overview",
    ),
]
