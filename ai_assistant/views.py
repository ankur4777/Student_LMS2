from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from academics.feature_access import get_active_student_enrollment

from .dashboard_data import student_dashboard_facts, teacher_materials
from .dashboard_answers import answer_portal_question
from .provider import AIProviderUnavailable, generate_reply
from .account_help import get_student_account_help
from .student_context import get_authorized_student_context


class StudentAIContextAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        context, denial_reason = get_authorized_student_context(request.user)
        if denial_reason:
            return Response({"detail": denial_reason}, status=403)
        return Response(context)


def validate_history(raw):
    if raw is None:
        return []
    if not isinstance(raw, list) or len(raw) > 8:
        raise ValueError("History must contain at most 8 messages.")
    cleaned = []
    for message in raw:
        if (
            not isinstance(message, dict)
            or message.get("role") not in ("user", "assistant")
            or not isinstance(message.get("content"), str)
            or not 1 <= len(message["content"]) <= 1500
        ):
            raise ValueError("Invalid chat history.")
        cleaned.append({
            "role": message["role"],
            "content": message["content"],
        })
    return cleaned


class StudentAIChatAPIView(APIView):
    """Read-only AI chat: permissions are evaluated for every message."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "student_ai_chat"

    def post(self, request):
        context, denial_reason = get_authorized_student_context(request.user)
        if denial_reason:
            return Response({"detail": denial_reason}, status=403)

        message = request.data.get("message")
        mode = request.data.get("mode")
        if not isinstance(message, str) or not 1 <= len(message.strip()) <= 1500:
            return Response(
                {"detail": "Message must contain 1–1500 characters."},
                status=400,
            )
        message = message.strip()

        if mode not in ("dashboard", "tutor"):
            return Response({"detail": "Choose Dashboard or Subject Tutor."}, status=400)

        try:
            history = validate_history(request.data.get("history"))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        enrollment = get_active_student_enrollment(request.user)
        if enrollment is None:
            return Response({"detail": "Active student enrollment required."}, status=403)

        features = context["feature_access"]
        subject = None
        if mode == "tutor":
            supplied_id = request.data.get("subject_id")
            if type(supplied_id) is not int:
                return Response({"detail": "Select an enrolled subject."}, status=400)
            subject = next(
                (item for item in context["subjects"] if item["id"] == supplied_id),
                None,
            )
            if subject is None:
                return Response(
                    {"detail": "You are not enrolled in this subject."},
                    status=403,
                )

            data = {
                "study_materials": teacher_materials(
                    request.user, enrollment, subject["id"], features
                ),
                "source_notice": (
                    "Study materials contain published document titles and "
                    "descriptions only; no document file content has been indexed."
                ),
            }
        else:
            # Account navigation and recovery steps are official LMS help,
            # not academic teaching. Answer from verified routes without
            # depending on a small local model's intent classification.
            account_help = get_student_account_help(message)
            if account_help is not None:
                return Response({
                    **account_help,
                    "mode": "dashboard",
                    "subject_id": None,
                })

            data = student_dashboard_facts(
                request.user,
                enrollment,
                {item["id"] for item in context["subjects"]},
                features,
            )
            portal_answer = answer_portal_question(message, data)
            if portal_answer is not None:
                return Response({
                    **portal_answer,
                    "mode": "dashboard",
                    "subject_id": None,
                })

        try:
            reply = generate_reply(
                message=message,
                history=history,
                mode=mode,
                student_context=context,
                data=data,
                subject=subject,
            )
        except AIProviderUnavailable as exc:
            return Response({"detail": str(exc)}, status=503)

        return Response({
            "reply": reply,
            "mode": mode,
            "subject_id": subject["id"] if subject else None,
        })
