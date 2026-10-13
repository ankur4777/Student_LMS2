from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .student_context import get_authorized_student_context


class StudentAIContextAPIView(APIView):
    """Foundation endpoint. No model calls or unrestricted data tools yet."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        context, denial_reason = get_authorized_student_context(request.user)
        if denial_reason:
            return Response({"detail": denial_reason}, status=403)
        return Response(context)
