from django.urls import path

from .views import (
    StudentAIChatAPIView, StudentAIContextAPIView,
    StudentAIConversationsAPIView, StudentAIConversationDetailAPIView,
)

urlpatterns = [
    path("context/", StudentAIContextAPIView.as_view(), name="student-ai-context"),
    path("chat/", StudentAIChatAPIView.as_view(), name="student-ai-chat"),
    path("conversations/", StudentAIConversationsAPIView.as_view(), name="student-ai-conversations"),
    path("conversations/<uuid:conversation_id>/", StudentAIConversationDetailAPIView.as_view(), name="student-ai-conversation-detail"),
]
