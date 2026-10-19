"""Public Student LMS service enquiries (not tenant/student records)."""

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


class ContactInquirySerializer(serializers.Serializer):
    full_name = serializers.CharField(min_length=2, max_length=120, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    phone = serializers.RegexField(
        regex=r"^\+?[0-9][0-9 ()\-]{7,19}$",
        max_length=24,
        required=False,
        allow_blank=True,
    )
    region = serializers.ChoiceField(choices=[
        ("canada", "Canada"),
        ("australia", "Australia"),
        ("other", "Other"),
    ])
    service = serializers.ChoiceField(choices=[
        ("lms", "LMS for a school or college"),
        ("one_to_one", "One-to-one online tutoring"),
        ("group", "Group online tutoring"),
        ("general", "Other question"),
    ])
    message = serializers.CharField(min_length=15, max_length=2000, trim_whitespace=True)
    consent = serializers.BooleanField(required=True)
    website = serializers.CharField(required=False, allow_blank=True, max_length=200, write_only=True)

    def validate_full_name(self, value):
        if "\n" in value or "\r" in value:
            raise serializers.ValidationError("Enter your name on one line.")
        return value

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError("Consent to receive a response is required.")
        return value


class ContactInquiryAPIView(APIView):
    """Send an enquiry to the configured site-wide team email, no public DB records."""

    permission_classes = [AllowAny]
    authentication_classes = []
    parser_classes = [JSONParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "contact_inquiry"

    def post(self, request):
        serializer = ContactInquirySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        details = serializer.validated_data

        # Do not reveal spam mitigation to automated submitters.
        if details.get("website"):
            return Response(
                {"detail": "Thank you! Your enquiry has been received."},
                status=status.HTTP_200_OK,
            )

        recipient = getattr(settings, "CONTACT_INQUIRY_NOTIFICATION_EMAIL", "").strip()
        if not recipient:
            return Response(
                {"detail": "The contact service is not configured yet. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        service_label = dict(ContactInquirySerializer().fields["service"].choices).get(
            details["service"], details["service"]
        )
        region_label = dict(ContactInquirySerializer().fields["region"].choices).get(
            details["region"], details["region"]
        )
        body = "\n".join([
            "New enquiry from Student LMS public website",
            "",
            f"Name: {details['full_name']}",
            f"Email: {details['email']}",
            f"Phone: {details.get('phone') or 'Not supplied'}",
            f"Region: {region_label}",
            f"Interest: {service_label}",
            "",
            "Message:",
            details["message"],
            "",
            "The sender agreed to be contacted about this enquiry.",
        ])
        mail = EmailMessage(
            subject=f"Student LMS enquiry | {service_label}",
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient],
            reply_to=[details["email"]],
        )
        try:
            sent = mail.send(fail_silently=False)
        except Exception:
            # Do not log the enquiry or private contact information.
            logger.exception("Contact enquiry email delivery failed")
            sent = 0
        if sent != 1:
            return Response(
                {"detail": "We couldn't send your enquiry right now. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {"detail": "Thank you! Your enquiry has been sent. Our team will review it."},
            status=status.HTTP_200_OK,
        )
