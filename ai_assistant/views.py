from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from academics.feature_access import get_active_student_enrollment

from .dashboard_data import student_dashboard_facts, teacher_materials
from .dashboard_answers import answer_portal_question
from .provider import AIProviderUnavailable, generate_reply
from .account_help import get_student_account_help
from .history import (
    conversation_queryset, get_conversation, persist_exchange, prompt_history,
    serialize_conversation, serialize_message,
)
from .student_context import get_authorized_student_context


class StudentAIContextAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        context, denial_reason = get_authorized_student_context(request.user)
        if denial_reason:
            return Response({"detail": denial_reason}, status=403)
        return Response(context)


class StudentAIConversationsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        context, denial = get_authorized_student_context(request.user)
        if denial:
            return Response({"detail": denial}, status=403)
        enrollment = get_active_student_enrollment(request.user)
        conversations = conversation_queryset(request.user, enrollment, context)[:30]
        return Response({
            "conversations": [serialize_conversation(row) for row in conversations],
        })


class StudentAIConversationDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id):
        context, denial = get_authorized_student_context(request.user)
        if denial:
            return Response({"detail": denial}, status=403)
        enrollment = get_active_student_enrollment(request.user)
        row = get_conversation(request.user, enrollment, context, conversation_id)
        if row is None:
            return Response({"detail": "Chat not found."}, status=404)
        return Response({
            "conversation": serialize_conversation(row),
            "messages": [serialize_message(message) for message in row.messages.all()],
        })


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
                    request.user, enrollment, subject["id"], features,
                    question=message,
                ),
                "source_notice": (
                    "Published teacher PDF excerpts are included when available "
                    "and question-relevant. Other file types and unreadable PDFs "
                    "have metadata only. Never claim full-document access."
                ),
            }
        raw_conversation_id = request.data.get("conversation_id")
        conversation = None
        if raw_conversation_id is not None:
            conversation = get_conversation(
                request.user, enrollment, context, raw_conversation_id
            )
            if conversation is None:
                return Response({"detail": "Chat not found."}, status=404)
            if conversation.mode != mode or conversation.subject_id != (
                subject["id"] if subject else None
            ):
                return Response(
                    {"detail": "This chat belongs to another mode or subject. "
                     "Choose New Chat instead."},
                    status=400,
                )

        def saved_reply(reply, links=None):
            row = persist_exchange(
                existing=conversation, user=request.user, enrollment=enrollment,
                context=context, mode=mode, subject=subject,
                question=message, answer=reply, links=links,
            )
            return Response({
                "reply": reply,
                "links": links or [],
                "mode": mode,
                "subject_id": subject["id"] if subject else None,
                "conversation_id": str(row.pk),
            })

        if mode == "dashboard":
            # Account navigation and recovery steps are official LMS help,
            # not academic teaching. Answer from verified routes without
            # depending on a small local model's intent classification.
            account_help = get_student_account_help(message)
            if account_help is not None:
                return saved_reply(
                    account_help["reply"], account_help.get("links", [])
                )

            data = student_dashboard_facts(
                request.user,
                enrollment,
                {item["id"] for item in context["subjects"]},
                features,
            )
            portal_answer = answer_portal_question(message, data)
            if portal_answer is not None:
                return saved_reply(
                    portal_answer["reply"], portal_answer.get("links", [])
                )

        try:
            reply = generate_reply(
                message=message,
                history=prompt_history(conversation),
                mode=mode,
                student_context=context,
                data=data,
                subject=subject,
            )
        except AIProviderUnavailable as exc:
            return Response({"detail": str(exc)}, status=503)

        return saved_reply(reply)
