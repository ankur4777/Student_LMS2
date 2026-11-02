"""Organization-wide Recorded Learning analytics and tenant isolation tests."""
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITransactionTestCase

from accounts.models import StudentProfile, User
from institutions.models import Organization
from recordedcourses.models import (
    CourseCertificate, CourseFinalAttempt, CourseFinalExam, CourseModule,
    ModuleAssignment, ModuleAssignmentSubmission, OrganizationLearningSettings,
    RecordedCourse, RecordedCourseAccess,
)


class OrganizationLearningAnalyticsTests(APITransactionTestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Analytics Campus A", code="P17-A")
        self.other = Organization.objects.create(name="Analytics Campus B", code="P17-B")
        self.admin = User.objects.create_user(
            username="p17-admin", password="local",
            role="college_admin", organization=self.org,
        )
        self.other_admin = User.objects.create_user(
            username="p17-other-admin", password="local",
            role="college_admin", organization=self.other,
        )
        self.teacher = User.objects.create_user(
            username="p17-teacher", password="local",
            role="teacher", organization=self.org,
        )
        self.user = User.objects.create_user(
            username="p17-student", password="local",
            role="student", organization=self.org, first_name="Demo", last_name="Student",
        )
        self.student = StudentProfile.objects.create(
            user=self.user, admission_number="P17-S",
        )
        self.course = RecordedCourse.objects.create(
            organization=self.org, title="Accounting Basics",
            price=Decimal("0.00"),
        )
        self.other_course = RecordedCourse.objects.create(
            organization=self.other, title="Other College Secret",
            price=Decimal("0.00"),
        )
        OrganizationLearningSettings.objects.create(organization=self.org, is_enabled=True)
        OrganizationLearningSettings.objects.create(organization=self.other, is_enabled=True)
        self.url = "/api/recorded-courses/learning/manage/analytics/"

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def test_college_admin_only_and_org_isolation(self):
        self.auth(self.teacher)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.auth(self.user)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.auth(self.admin)
        reply = self.client.get(self.url)
        self.assertEqual(reply.status_code, 200, reply.data)
        self.assertEqual(reply.data["totals"]["courses"], 1)
        self.assertEqual(reply.data["courses"][0]["title"], "Accounting Basics")
        self.assertNotIn("Other College Secret", str(reply.data))
        self.assertNotIn("Demo Student", str(reply.data))
        self.assertNotIn("P17-S", str(reply.data))
        self.auth(self.other_admin)
        outside = self.client.get(self.url)
        self.assertEqual(outside.status_code, 200, outside.data)
        self.assertEqual(outside.data["totals"]["courses"], 1)
        self.assertEqual(outside.data["courses"][0]["title"], "Other College Secret")
        self.assertNotIn("Accounting Basics", str(outside.data))

    def test_empty_analytics_and_disabled_feature(self):
        self.auth(self.admin)
        reply = self.client.get(self.url)
        self.assertEqual(reply.status_code, 200, reply.data)
        totals = reply.data["totals"]
        self.assertEqual(totals["courses"], 1)
        self.assertEqual(totals["active_enrollments"], 0)
        self.assertEqual(totals["graduation_percent"], 0)
        self.assertIsNone(reply.data["courses"][0]["average_attempt_score"])
        OrganizationLearningSettings.objects.filter(organization=self.org).update(
            is_enabled=False,
        )
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_aggregation_of_grading_final_exam_and_certificates(self):
        now = timezone.now()
        RecordedCourseAccess.objects.create(
            course=self.course, organization=self.org, student=self.student,
        )
        second_user = User.objects.create_user(
            username="p17-second-student", password="local",
            role="student", organization=self.org,
        )
        second = StudentProfile.objects.create(
            user=second_user, admission_number="P17-SECOND",
        )
        RecordedCourseAccess.objects.create(
            course=self.course, organization=self.org, student=second,
            starts_at=now - timedelta(days=40),
            expires_at=now - timedelta(days=1),
        )
        module = CourseModule.objects.create(
            course=self.course, title="Module 1", position=1, is_published=True,
        )
        assignment = ModuleAssignment.objects.create(
            module=module, title="Work", instructions="Submit work",
            is_published=True,
        )
        ModuleAssignmentSubmission.objects.create(
            assignment=assignment, student=self.student,
            attempt_number=1, answer_text="Waiting for grading",
        )
        exam = CourseFinalExam.objects.create(course=self.course, title="Final", is_published=True)
        passed = CourseFinalAttempt.objects.create(
            exam=exam, student=self.student, attempt_number=1,
            answers={"1": 0}, question_count=1, correct_count=1,
            score_percent=95, passed=True,
        )
        CourseFinalAttempt.objects.create(
            exam=exam, student=second, attempt_number=1,
            answers={"1": 1}, question_count=1, correct_count=0,
            score_percent=45, passed=False,
        )
        cert = CourseCertificate.objects.create(
            course=self.course, organization=self.org, student=self.student,
            final_attempt=passed, student_name_at_issue="Demo Student",
            course_title_at_issue=self.course.title,
            organization_name_at_issue=self.org.name,
            module_count_at_issue=1, score_percent=95,
        )
        self.auth(self.admin)
        result = self.client.get(self.url)
        self.assertEqual(result.status_code, 200, result.data)
        data = result.data["courses"][0]
        self.assertEqual(data["enrolled_students"], 2)
        self.assertEqual(data["active_enrollments"], 1)
        self.assertEqual(data["manual_active"], 1)
        self.assertEqual(data["expired_enrollments"], 1)
        self.assertEqual(data["published_modules"], 1)
        self.assertEqual(data["pending_assignment_grading"], 1)
        self.assertEqual(data["final_attempts"], 2)
        self.assertEqual(data["students_attempted_final"], 2)
        self.assertEqual(data["students_passed_final"], 1)
        self.assertEqual(data["average_attempt_score"], 70.0)
        self.assertEqual(data["graduated_students"], 1)
        self.assertEqual(data["graduation_percent"], 50)
        self.assertEqual(data["valid_certificates"], 1)
        self.assertEqual(result.data["totals"]["graduation_percent"], 50)
        cert.revoked_at = now
        cert.revocation_reason = "Test revocation"
        cert.save(update_fields=["revoked_at", "revocation_reason"])
        after = self.client.get(self.url)
        self.assertEqual(after.status_code, 200, after.data)
        row = after.data["courses"][0]
        self.assertEqual(row["graduated_students"], 1)
        self.assertEqual(row["valid_certificates"], 0)
        self.assertEqual(row["revoked_certificates"], 1)

    def test_course_limit_is_explicit_not_partially_silent(self):
        self.auth(self.admin)
        from recordedcourses.learning_analytics import OrganizationLearningAnalyticsAPIView
        with patch.object(OrganizationLearningAnalyticsAPIView, "MAX_COURSES", 0):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 413, response.data)


    def test_analytics_csv_admin_only_and_organization_isolation(self):
        import csv
        import io

        url = self.url + "export.csv"
        self.auth(self.teacher)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.auth(self.user)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.auth(self.admin)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertIn("attachment;", response["Content-Disposition"])
        rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
        self.assertEqual(len(rows), 3)  # header, total and one course
        self.assertEqual(rows[2][1], "Accounting Basics")
        self.assertNotIn("Other College Secret", response.content.decode("utf-8-sig"))
        self.assertNotIn("Demo Student", response.content.decode("utf-8-sig"))
        self.assertNotIn("P17-S", response.content.decode("utf-8-sig"))
        self.auth(self.other_admin)
        outside = self.client.get(url)
        self.assertEqual(outside.status_code, 200)
        self.assertIn("Other College Secret", outside.content.decode("utf-8-sig"))
        self.assertNotIn("Accounting Basics", outside.content.decode("utf-8-sig"))
        OrganizationLearningSettings.objects.filter(organization=self.other).update(
            is_enabled=False,
        )
        self.assertEqual(self.client.get(url).status_code, 403)

    def test_analytics_csv_filter_totals_and_csv_formula_escaping(self):
        import csv
        import io

        also = RecordedCourse.objects.create(
            organization=self.org, title="Accounting Advanced",
            price=Decimal("0.00"),
        )
        unsafe = RecordedCourse.objects.create(
            organization=self.org, title="=1+1", price=Decimal("0.00"),
        )
        RecordedCourseAccess.objects.create(
            organization=self.org, course=self.course, student=self.student,
        )
        self.auth(self.admin)
        url = self.url + "export.csv"
        filtered = self.client.get(url, {"search": "ACCOUNTING"})
        self.assertEqual(filtered.status_code, 200)
        rows = list(csv.reader(io.StringIO(filtered.content.decode("utf-8-sig"))))
        headers = rows[0]
        self.assertEqual(len(rows), 4)  # header, totals, two matching courses
        self.assertEqual(rows[1][headers.index("Course")], "TOTAL (matching courses)")
        self.assertEqual(rows[1][headers.index("Enrolled Students (per course)")], "1")
        self.assertEqual(
            {r[headers.index("Course")] for r in rows[2:]},
            {"Accounting Basics", "Accounting Advanced"},
        )
        self.assertEqual(rows[1][headers.index("Average Attempt Score (%)")], "")
        whole = self.client.get(url)
        all_rows = list(csv.reader(io.StringIO(whole.content.decode("utf-8-sig"))))
        self.assertEqual(len(all_rows), 5)  # header, total and three courses
        self.assertIn("'=1+1", [r[headers.index("Course")] for r in all_rows[2:]])
        self.assertEqual(
            all_rows[1][headers.index("Enrolled Students (per course)")], "1",
        )

    def test_analytics_csv_empty_filtered_results_and_validation(self):
        import csv
        import io

        self.auth(self.admin)
        url = self.url + "export.csv"
        response = self.client.get(url, {"search": "not-present"})
        self.assertEqual(response.status_code, 200)
        rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
        self.assertEqual(len(rows), 2)  # header and zero totals
        self.assertEqual(rows[1][4], "0")
        self.assertEqual(rows[1][-1], "0")
        self.assertEqual(self.client.get(url, {"search": "x" * 81}).status_code, 400)
        from recordedcourses.learning_analytics import OrganizationLearningAnalyticsAPIView
        with patch.object(OrganizationLearningAnalyticsAPIView, "MAX_COURSES", 0):
            too_many = self.client.get(url)
        self.assertEqual(too_many.status_code, 413)
