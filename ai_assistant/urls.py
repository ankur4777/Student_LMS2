from django.urls import path

from .views import StudentAIContextAPIView

urlpatterns = [
    path("context/", StudentAIContextAPIView.as_view(), name="student-ai-context"),
]
