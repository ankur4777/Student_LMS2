from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import StudentProfile, User
from academics.models import (
    AcademicSession, ClassFeatureAccess, ClassRoom, Section,
    StudentEnrollment, Subject, SubjectStudentAccess,
)
from institutions.models import Organization


CONTEXT_URL = "/api/ai-assistant/context/"
ADMIN_ACCESS_URL = "/api/academics/college-admin/class-feature-access/"
STUDENT_ACCESS_URL = "/api/academics/student/feature-access/"


class StudentAIContextSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="College A", code="ai-a")
        self.foreign_org = Organization.objects.create(
            name="College B", code="ai-b"
        )
        self.admin = User.objects.create_user(
            username="ai-admin", password="pass", role="college_admin",
            organization=self.org,
        )
        self.student = User.objects.create_user(
            username="ai-student", password="pass", role="student",
            organization=self.org, first_name="Test", last_name="Student",
        )
        self.student_profile = StudentProfile.objects.create(
            user=self.student, admission_number="AI-1"
        )
        self.session = AcademicSession.objects.create(
            organization=self.org, name="2026", start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31), is_active=True,
        )
        self.classroom = ClassRoom.objects.create(
            organization=self.org, academic_session=self.session, name="8"
        )
        self.section = Section.objects.create(
            organization=self.org, classroom=self.classroom, name="A"
        )
        self.enrollment = StudentEnrollment.objects.create(
            student=self.student_profile, section=self.section,
            is_active=True, roll_number="AI-100",
        )
        self.science = Subject.objects.create(
            organization=self.org, classroom=self.classroom,
            name="Science", student_assignment_mode="all",
        )
        self.math = Subject.objects.create(
            organization=self.org, classroom=self.classroom,
            name="Mathematics", student_assignment_mode="all",
        )
        SubjectStudentAccess.objects.create(
            subject=self.math, student=self.student_profile, is_enrolled=False
        )
        self.history = Subject.objects.create(
            organization=self.org, classroom=self.classroom,
            name="History", student_assignment_mode="selected",
        )
        SubjectStudentAccess.objects.create(
            subject=self.history, student=self.student_profile, is_enrolled=True
        )
        Subject.objects.create(
            organization=self.org, classroom=self.classroom,
            name="Geography", student_assignment_mode="selected",
        )
        other_classroom = ClassRoom.objects.create(
            organization=self.org, academic_session=self.session, name="9"
        )
        Subject.objects.create(
            organization=self.org, classroom=other_classroom,
            name="Class 9 Science",
        )
        foreign_session = AcademicSession.objects.create(
            organization=self.foreign_org, name="2026",
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
            is_active=True,
        )
        self.foreign_classroom = ClassRoom.objects.create(
            organization=self.foreign_org,
            academic_session=foreign_session, name="8",
        )
        self.foreign_subject = Subject.objects.create(
            organization=self.foreign_org, classroom=self.foreign_classroom,
            name="Foreign Science",
        )
        # Deliberately malformed cross-college access override:
        # the chatbot must not trust it or expose the foreign subject.
        SubjectStudentAccess.objects.create(
            subject=self.foreign_subject, student=self.student_profile,
            is_enrolled=True,
        )

    def enable(self):
        ClassFeatureAccess.objects.update_or_create(
            organization=self.org, classroom=self.classroom,
            feature_key=ClassFeatureAccess.Feature.AI_ASSISTANT,
            defaults={"is_enabled": True},
        )

    def test_ai_feature_is_disabled_by_default(self):
        self.client.force_authenticate(user=self.student)
        features = self.client.get(STUDENT_ACCESS_URL)
        self.assertEqual(features.status_code, 200)
        self.assertFalse(features.data["features"]["ai_assistant"])
        self.assertEqual(self.client.get(CONTEXT_URL).status_code, 403)

        self.client.force_authenticate(user=self.admin)
        settings = self.client.get(
            ADMIN_ACCESS_URL, {"class_id": self.classroom.pk}
        )
        self.assertEqual(settings.status_code, 200)
        ai_feature = next(
            f for f in settings.data["features"] if f["key"] == "ai_assistant"
        )
        self.assertFalse(ai_feature["student_enabled"])
        self.assertFalse(ai_feature["parent_supported"])

    def test_college_admin_toggle_allows_only_enrolled_subjects(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(ADMIN_ACCESS_URL, {
            "class_id": self.classroom.id,
            "features": {"ai_assistant": {"student_enabled": True}},
        }, format="json")
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.student)
        response = self.client.get(CONTEXT_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["student"]["name"], "Test Student")
        self.assertEqual(response.data["student"]["section"], "A")
        self.assertEqual(response.data["student"]["roll_number"], "AI-100")
        self.assertEqual(
            {item["name"] for item in response.data["subjects"]},
            {"Science", "History"},
        )
        self.assertTrue(response.data["feature_access"]["ai_assistant"])
        self.assertNotIn("Foreign Science", str(response.data))

    def test_revoke_feature_blocks_existing_student(self):
        self.enable()
        self.client.force_authenticate(user=self.student)
        self.assertEqual(self.client.get(CONTEXT_URL).status_code, 200)
        ClassFeatureAccess.objects.filter(
            organization=self.org, classroom=self.classroom,
            feature_key="ai_assistant",
        ).update(is_enabled=False)
        self.assertEqual(self.client.get(CONTEXT_URL).status_code, 403)

    def test_foreign_college_class_cannot_be_enabled_by_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(ADMIN_ACCESS_URL, {
            "class_id": self.foreign_classroom.id,
            "features": {"ai_assistant": True},
        }, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertFalse(ClassFeatureAccess.objects.filter(
            classroom=self.foreign_classroom, feature_key="ai_assistant"
        ).exists())

    def test_requires_auth_and_student_role(self):
        self.assertEqual(self.client.get(CONTEXT_URL).status_code, 401)
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.get(CONTEXT_URL).status_code, 403)

    def test_rejects_inactive_user_and_organization(self):
        self.enable()
        self.client.force_authenticate(user=self.student)
        self.student.is_active = False
        self.student.save(update_fields=["is_active"])
        self.assertEqual(self.client.get(CONTEXT_URL).status_code, 403)
        self.student.is_active = True
        self.student.save(update_fields=["is_active"])
        self.org.is_active = False
        self.org.save(update_fields=["is_active"])
        self.assertEqual(self.client.get(CONTEXT_URL).status_code, 403)

    def test_rejects_missing_active_enrollment(self):
        self.enable()
        self.enrollment.is_active = False
        self.enrollment.save(update_fields=["is_active"])
        self.client.force_authenticate(user=self.student)
        self.assertEqual(self.client.get(CONTEXT_URL).status_code, 403)
