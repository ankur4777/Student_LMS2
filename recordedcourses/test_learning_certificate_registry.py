"""Certificate registry, filtered audit export and tenant isolation regressions."""
import csv
import io
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITransactionTestCase

from accounts.models import User, StudentProfile
from institutions.models import Organization
from recordedcourses.models import (
    RecordedCourse, OrganizationLearningSettings,
    CourseFinalExam, CourseFinalAttempt, CourseCertificate,
)


class CertificateRegistryTests(APITransactionTestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Certificate Registry A", code="P16-A")
        self.other_org = Organization.objects.create(name="Certificate Registry B", code="P16-B")
        self.admin = User.objects.create_user(
            username="p16-admin", password="local", role="college_admin", organization=self.org,
        )
        self.other_admin = User.objects.create_user(
            username="p16-other-admin", password="local", role="college_admin", organization=self.other_org,
        )
        self.teacher = User.objects.create_user(
            username="p16-teacher", password="local", role="teacher", organization=self.org,
        )
        self.student_user = User.objects.create_user(
            username="p16-student", password="local", role="student",
            organization=self.org, first_name="First", last_name="Learner",
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user, admission_number="P16-001",
        )
        self.course = RecordedCourse.objects.create(
            organization=self.org, title="Certificate Program", price=Decimal("0.00"),
        )
        self.exam = CourseFinalExam.objects.create(course=self.course, title="Final Exam")
        OrganizationLearningSettings.objects.create(organization=self.org, is_enabled=True)
        OrganizationLearningSettings.objects.create(organization=self.other_org, is_enabled=True)
        self.list_url = (
            f"/api/recorded-courses/learning/manage/courses/{self.course.pk}/certificates/"
        )
        self.export_url = self.list_url + "export.csv"

    def login(self, user):
        self.client.force_authenticate(user=user)

    def issue(self, student=None, name=None):
        student = student or self.student
        attempt = CourseFinalAttempt.objects.create(
            exam=self.exam, student=student,
            attempt_number=1, answers={}, correct_count=1,
            question_count=1, score_percent=95, passed=True,
        )
        return CourseCertificate.objects.create(
            course=self.course, organization=self.org, student=student,
            final_attempt=attempt, course_title_at_issue=self.course.title,
            organization_name_at_issue=self.org.name,
            student_name_at_issue=name or student.user.get_full_name() or student.user.username,
            score_percent=95, module_count_at_issue=1,
        )

    def test_registry_is_admin_only_and_organization_scoped(self):
        self.issue()
        self.login(self.teacher)
        self.assertEqual(self.client.get(self.list_url).status_code, 403)
        self.assertEqual(self.client.get(self.export_url).status_code, 403)
        self.login(self.student_user)
        self.assertEqual(self.client.get(self.list_url).status_code, 403)
        self.assertEqual(self.client.get(self.export_url).status_code, 403)
        self.login(self.other_admin)
        self.assertEqual(self.client.get(self.list_url).status_code, 404)
        self.assertEqual(self.client.get(self.export_url).status_code, 404)
        self.login(self.admin)
        self.assertEqual(self.client.get(self.list_url).status_code, 200)
        self.assertEqual(self.client.get(self.export_url).status_code, 200)
        OrganizationLearningSettings.objects.filter(organization=self.org).update(is_enabled=False)
        self.assertEqual(self.client.get(self.list_url).status_code, 403)
        self.assertEqual(self.client.get(self.export_url).status_code, 403)

    def test_registry_pagination_search_and_status_filter(self):
        first = self.issue()
        first.revoked_at = timezone.now()
        first.revocation_reason = "Administrative correction"
        first.save(update_fields=["revoked_at", "revocation_reason"])
        for i in range(26):
            user = User.objects.create(
                username=f"p16-learner-{i:02}", role="student", organization=self.org,
                first_name="New", last_name=f"Learner {i:02}",
            )
            profile = StudentProfile.objects.create(
                user=user, admission_number=f"P16-{i+100:03}",
            )
            self.issue(profile)
        self.login(self.admin)
        listing = self.client.get(self.list_url)
        self.assertEqual(listing.status_code, 200, listing.data)
        self.assertEqual(listing.data["total"], 27)
        self.assertEqual(len(listing.data["certificates"]), 25)
        self.assertTrue(listing.data["has_next"])
        last_page = self.client.get(self.list_url, {"page": "2"})
        self.assertEqual(last_page.status_code, 200, last_page.data)
        self.assertEqual(len(last_page.data["certificates"]), 2)
        self.assertFalse(last_page.data["has_next"])
        match = self.client.get(self.list_url, {"search": "P16-125"})
        self.assertEqual(match.status_code, 200, match.data)
        self.assertEqual(match.data["total"], 1)
        self.assertEqual(match.data["certificates"][0]["admission_number"], "P16-125")
        revoked = self.client.get(self.list_url, {"status": "revoked"})
        self.assertEqual(revoked.data["total"], 1)
        self.assertEqual(revoked.data["certificates"][0]["id"], str(first.public_id))
        issued = self.client.get(self.list_url, {"status": "issued"})
        self.assertEqual(issued.data["total"], 26)
        exported = self.client.get(self.export_url)
        self.assertEqual(exported.status_code, 200)
        rows = list(csv.reader(io.StringIO(exported.content.decode("utf-8-sig"))))
        self.assertEqual(len(rows), 28)
        self.assertEqual({row[0] for row in rows[1:]}, {
            x["id"] for x in listing.data["certificates"] + last_page.data["certificates"]
        })
        filtered = self.client.get(self.export_url, {"status": "revoked"})
        filtered_rows = list(csv.reader(io.StringIO(filtered.content.decode("utf-8-sig"))))
        self.assertEqual(len(filtered_rows), 2)
        self.assertEqual(filtered_rows[1][7], "revoked")
        self.assertEqual(filtered_rows[1][9], "Administrative correction")

    def test_validation_and_export_limit(self):
        self.issue()
        self.login(self.admin)
        for bad_page in ("0", "-2", "abc", "1000001"):
            self.assertEqual(self.client.get(self.list_url, {"page": bad_page}).status_code, 400)
        for url in (self.list_url, self.export_url):
            self.assertEqual(self.client.get(url, {"search": "x" * 81}).status_code, 400)
            self.assertEqual(self.client.get(url, {"status": "invalid"}).status_code, 400)
        from recordedcourses.learning_certificate_exports import ManagedCertificateCSVAPIView
        with patch.object(ManagedCertificateCSVAPIView, "MAX_CERTIFICATES", 0):
            self.assertEqual(self.client.get(self.export_url).status_code, 413)

    def test_csv_formula_injection_and_private_cache_headers(self):
        cert = self.issue(name='=HYPERLINK("https://example.test", "Open")')
        self.student.admission_number = "@untrusted"
        self.student.save(update_fields=["admission_number"])
        cert.revoked_at = timezone.now()
        cert.revocation_reason = "+2+3"
        cert.save(update_fields=["revoked_at", "revocation_reason"])
        self.login(self.admin)
        response = self.client.get(self.export_url, {"status": "revoked"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertIn("attachment", response["Content-Disposition"])
        rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
        self.assertEqual(len(rows), 2)
        self.assertTrue(rows[1][3].startswith("'=HYPERLINK"))
        self.assertEqual(rows[1][4], "'@untrusted")
        self.assertEqual(rows[1][9], "'+2+3")
