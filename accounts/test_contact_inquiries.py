"""Tests for public service enquiries, anti-spam and delivery failures."""

from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="Student LMS <noreply@example.com>",
    CONTACT_INQUIRY_NOTIFICATION_EMAIL="team@example.com",
    REST_FRAMEWORK={"DEFAULT_THROTTLE_RATES": {"contact_inquiry": "100/hour"}},
)
class ContactInquiryAPITests(TestCase):
    url = "/api/accounts/contact-inquiries/"

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.payload = {
            "full_name": "Samira Kumar",
            "email": "samira@example.com",
            "phone": "+1 604 555 0110",
            "region": "canada",
            "service": "one_to_one",
            "message": "I'd like to learn more about one-to-one Grade 10 tutoring sessions.",
            "consent": True,
            "website": "",
        }

    def test_anonymous_inquiry_delivers_to_configured_recipient(self):
        response = self.client.post(self.url, self.payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.to, ["team@example.com"])
        self.assertEqual(email.reply_to, ["samira@example.com"])
        self.assertIn("One-to-one online tutoring", email.subject)
        self.assertIn("Canada", email.body)
        self.assertIn("Grade 10", email.body)

    def test_school_lms_inquiry_uses_correct_service(self):
        payload = {**self.payload, "service": "lms", "region": "australia"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("LMS for a school or college", mail.outbox[0].subject)
        self.assertIn("Australia", mail.outbox[0].body)

    def test_invalid_fields_and_missing_consent_block_delivery(self):
        cases = [
            {**self.payload, "email": "bad"},
            {**self.payload, "service": "unknown"},
            {**self.payload, "region": "nowhere"},
            {**self.payload, "consent": False},
            {**self.payload, "message": "short"},
            {**self.payload, "full_name": "A\nB"},
        ]
        for payload in cases:
            with self.subTest(payload=payload):
                cache.clear()
                response = self.client.post(self.url, payload, format="json")
                self.assertEqual(response.status_code, 400)
        self.assertEqual(len(mail.outbox), 0)

    def test_honeypot_discards_spam(self):
        response = self.client.post(
            self.url,
            {**self.payload, "website": "spam.example"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(CONTACT_INQUIRY_NOTIFICATION_EMAIL="")
    def test_missing_email_configuration_is_not_falsely_successful(self):
        response = self.client.post(self.url, self.payload, format="json")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(len(mail.outbox), 0)

    def test_email_transport_failure_is_reported(self):
        with patch("accounts.contact_inquiries.EmailMessage.send", side_effect=RuntimeError("SMTP down")):
            response = self.client.post(self.url, self.payload, format="json")
        self.assertEqual(response.status_code, 503)

    def test_throttled_after_two_submissions(self):
        # DRF caches throttle rates at import time. Patch the live class settings,
        # not REST_FRAMEWORK via override_settings, to test the actual limiter.
        cache.clear()
        with patch.dict(ScopedRateThrottle.THROTTLE_RATES, {"contact_inquiry": "2/hour"}):
            status_codes = [
                self.client.post(
                    self.url, self.payload, format="json", REMOTE_ADDR="203.0.113.81"
                ).status_code
                for _ in range(3)
            ]
        self.assertEqual(status_codes, [200, 200, 429])
        self.assertEqual(len(mail.outbox), 2)
