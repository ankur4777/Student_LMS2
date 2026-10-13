from django.urls import path

from .views import StudentAIChatAPIView, StudentAIContextAPIView

urlpatterns = [
    path("context/", StudentAIContextAPIView.as_view(), name="student-ai-context"),
    path("chat/", StudentAIChatAPIView.as_view(), name="student-ai-chat"),
]
