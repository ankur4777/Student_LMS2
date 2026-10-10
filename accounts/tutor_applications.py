"""Public tutor recruitment form. Not linked to tenant-owned LMS accounts."""

import logging

from django.conf import settings
from django.core.mail import EmailMessage
from rest_framework import serializers, status
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView


logger = logging.getLogger(__name__)


class TutorApplicationSerializer(serializers.Serializer):
    full_name = serializers.CharField(min_length=2, max_length=120)
    email = serializers.EmailField(max_length=254)
    phone = serializers.RegexField(
        regex=r"^\+?[0-9][0-9 ()\-]{7,19}$",
        max_length=24,
        error_messages={"invalid": "Enter a valid contact phone number."},
    )
    city = serializers.CharField(min_length=2, max_length=100)
    subjects = serializers.CharField(min_length=2, max_length=200)
    qualification = serializers.CharField(min_length=2, max_length=200)
    teaching_level = serializers.ChoiceField(
        choices=[
            ("primary", "Primary school"),
            ("secondary", "Secondary school"),
            ("senior_secondary", "Senior secondary"),
            ("college", "College / university"),
            ("competitive", "Competitive exams"),
        ]
    )
    experience_years = serializers.ChoiceField(
        choices=[
            ("0-1", "0–1 years"),
            ("2-3", "2–3 years"),
            ("4-6", "4–6 years"),
            ("7-plus", "7+ years"),
        ]
    )
    introduction = serializers.CharField(min_length=20, max_length=1200)
    portfolio_url = serializers.URLField(required=False, allow_blank=True, max_length=300)
    consent = serializers.BooleanField(required=True)
    website = serializers.CharField(required=False, allow_blank=True, max_length=200, write_only=True)

    def validate_full_name(self, value):
        if "\n" in value or "\r" in value:
            raise serializers.ValidationError("Enter your full name on one line.")
        return value

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError("Please agree to the application data notice.")
        return value


class TutorApplicationAPIView(APIView):
    """Email site-wide tutor applications to a separately configured recipient."""

    permission_classes = [AllowAny]
    authentication_classes = []
    parser_classes = [JSONParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "tutor_application"

    def post(self, request):
        serializer = TutorApplicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # A hidden field traps basic automated form submissions; do not mail these.
        if data.get("website"):
            return Response(
                {"detail": "Thank you. Your application has been received."},
                status=status.HTTP_200_OK,
            )

        recipient = getattr(settings, "TUTOR_APPLICATION_NOTIFICATION_EMAIL", "").strip()
        if not recipient:
            return Response(
                {"detail": "Applications are temporarily unavailable. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        level = dict(TutorApplicationSerializer().fields["teaching_level"].choices).get(
            data["teaching_level"], data["teaching_level"]
        )
        experience = dict(TutorApplicationSerializer().fields["experience_years"].choices).get(
            data["experience_years"], data["experience_years"]
        )
        body = "\n".join(
            [
                "New tutor application received from the Student LMS public homepage.",
                "",
                f"Full name: {data['full_name']}",
                f"Email: {data['email']}",
                f"Phone: {data['phone']}",
                f"City / location: {data['city']}",
                f"Subjects: {data['subjects']}",
                f"Highest qualification: {data['qualification']}",
                f"Teaching level: {level}",
                f"Teaching experience: {experience}",
                f"Portfolio / resume link: {data.get('portfolio_url') or 'Not provided'}",
                "",
                "About the applicant:",
                data["introduction"],
                "",
                "The applicant agreed to have these details used for tutor recruitment.",
            ]
        )

        message = EmailMessage(
            subject="New tutor application | Student LMS",
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient],
            reply_to=[data["email"]],
        )
        try:
            delivered = message.send(fail_silently=False)
        except Exception:
            # Avoid logging the applicant's personal details or submitted text.
            logger.exception("Tutor application email delivery failed")
            delivered = 0

        if delivered != 1:
            return Response(
                {"detail": "We could not send your application right now. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {"detail": "Thank you! Your tutor application has been sent successfully."},
            status=status.HTTP_200_OK,
        )
