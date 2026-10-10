"""Focused tests for the public tutor application email workflow."""

from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="Student LMS <noreply@example.com>",
    TUTOR_APPLICATION_NOTIFICATION_EMAIL="recruitment@example.com",
    REST_FRAMEWORK={"DEFAULT_THROTTLE_RATES": {"tutor_application": "100/hour"}},
)
class TutorApplicationAPITests(TestCase):
    url = "/api/accounts/tutor-applications/"

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.application = {
            "full_name": "Ayesha Sharma",
            "email": "ayesha@example.com",
            "phone": "+91 98765 43210",
            "city": "New Delhi",
            "subjects": "Mathematics and Science",
            "qualification": "M.Sc. Mathematics",
            "teaching_level": "secondary",
            "experience_years": "2-3",
            "teaching_mode": "online",
            "introduction": "I enjoy making mathematics approachable and explaining concepts clearly.",
            "portfolio_url": "https://example.com/resume",
            "consent": True,
            "website": "",
        }

    def test_anonymous_application_sends_email_to_configured_recipient(self):
        response = self.client.post(self.url, self.application, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertIn("sent", response.data["detail"].lower())
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["recruitment@example.com"])
        self.assertEqual(message.reply_to, ["ayesha@example.com"])
        self.assertIn("Ayesha Sharma", message.body)
        self.assertIn("Mathematics and Science", message.body)
        self.assertIn("Secondary school", message.body)
        self.assertIn("https://example.com/resume", message.body)

    def test_required_fields_must_be_present(self):
        payload = {**self.application}
        payload.pop("subjects")
        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("subjects", response.data)
        self.assertEqual(len(mail.outbox), 0)

    def test_consent_is_required(self):
        payload = {**self.application, "consent": False}
        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("consent", response.data)
        self.assertEqual(len(mail.outbox), 0)

    def test_invalid_email_is_rejected(self):
        payload = {**self.application, "email": "not-an-email"}
        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(len(mail.outbox), 0)

    def test_honeypot_ignores_bot_without_sending_email(self):
        payload = {**self.application, "website": "spam-site.example"}
        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(TUTOR_APPLICATION_NOTIFICATION_EMAIL="")
    def test_missing_recruitment_email_returns_service_unavailable(self):
        response = self.client.post(self.url, self.application, format="json")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(len(mail.outbox), 0)

    def test_email_delivery_failure_does_not_report_success(self):
        with patch("accounts.tutor_applications.EmailMessage.send", side_effect=RuntimeError("SMTP unavailable")):
            response = self.client.post(self.url, self.application, format="json")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(REST_FRAMEWORK={"DEFAULT_THROTTLE_RATES": {"tutor_application": "2/hour"}})
    def test_repeated_submissions_are_rate_limited(self):
        responses = [
            self.client.post(self.url, self.application, format="json", REMOTE_ADDR="203.0.113.71")
            for _ in range(3)
        ]

        self.assertEqual([response.status_code for response in responses], [200, 200, 429])
        self.assertEqual(len(mail.outbox), 2)
