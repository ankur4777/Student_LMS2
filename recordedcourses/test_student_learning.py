"""Tenant, entitlement, purchase and private-document regression tests."""
import tempfile
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITransactionTestCase

from accounts.models import StudentProfile, User
from institutions.models import Organization
from recordedcourses.models import (
    CourseModule, LessonLearningProgress, ModuleResource,
    OrganizationLearningSettings, RecordedCourse, RecordedCourseAccess,
    RecordedLesson,
)


class StudentLearningTests(APITransactionTestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Local student learning", code="P4-A")
        self.other_org = Organization.objects.create(name="Other student learning", code="P4-B")
        self.user = User.objects.create_user(username="student-p4-a", password="test-password", role="student", organization=self.org)
        self.other_user = User.objects.create_user(username="student-p4-b", password="test-password", role="student", organization=self.org)
        self.stranger_user = User.objects.create_user(username="student-p4-other", password="test-password", role="student", organization=self.other_org)
        self.student = StudentProfile.objects.create(user=self.user, admission_number="P4-A-1")
        self.other_student = StudentProfile.objects.create(user=self.other_user, admission_number="P4-A-2")
        self.stranger_student = StudentProfile.objects.create(user=self.stranger_user, admission_number="P4-B-1")
        self.course = RecordedCourse.objects.create(organization=self.org, title="Physics Part One", price=Decimal("0"))
        self.module = CourseModule.objects.create(course=self.course, title="First Chapter", position=1, is_published=True)
        self.draft = CourseModule.objects.create(course=self.course, title="Not Ready", position=2, is_published=False)
        self.lesson = RecordedLesson.objects.create(course=self.course, module=self.module, title="Lesson One", position=1)
        self.draft_lesson = RecordedLesson.objects.create(course=self.course, module=self.draft, title="Draft lesson", position=2)
        self.unassigned = RecordedLesson.objects.create(course=self.course, title="Legacy lecture", position=3)
        self.access = RecordedCourseAccess.objects.create(organization=self.org, course=self.course, student=self.student)
        OrganizationLearningSettings.objects.create(organization=self.org, is_enabled=True)
        self.list_url = "/api/recorded-courses/learning/student/courses/"
        self.detail_url = f"/api/recorded-courses/learning/student/courses/{self.course.pk}/"
        self.complete_url = f"/api/recorded-courses/learning/student/lessons/{self.lesson.pk}/complete/"
        self.session_url = f"/api/recorded-courses/learning/student/lessons/{self.lesson.pk}/viewing-session/"
        # Class-feature behavior is separately covered by existing academics tests.
        self.feature_patch = patch("recordedcourses.learning_access.student_feature_is_enabled", return_value=True)
        self.feature_patch.start()
        self.addCleanup(self.feature_patch.stop)
        self.client.force_authenticate(user=self.user)

    def test_purchased_course_lists_published_modules_only(self):
        result = self.client.get(self.detail_url)
        self.assertEqual(result.status_code, 200)
        data = result.data["course"]
        self.assertEqual(data["total_lessons"], 1)
        self.assertEqual(len(data["modules"]), 1)
        self.assertEqual(data["modules"][0]["lessons"][0]["id"], self.lesson.id)
        self.assertEqual(self.client.get(self.list_url).data["courses"][0]["total_lessons"], 1)

    def test_access_required_even_for_same_organization(self):
        self.client.force_authenticate(user=self.other_user)
        self.assertEqual(self.client.get(self.detail_url).status_code, 403)
        self.assertEqual(self.client.post(self.complete_url).status_code, 403)
        self.assertEqual(self.client.get(self.list_url).data["courses"], [])

    def test_master_switch_off_blocks_everything(self):
        OrganizationLearningSettings.objects.filter(organization=self.org).update(is_enabled=False)
        self.assertEqual(self.client.get(self.detail_url).status_code, 403)
        self.assertEqual(self.client.post(self.complete_url).status_code, 403)

    def test_expired_course_access_blocks_learning(self):
        RecordedCourseAccess.objects.filter(pk=self.access.pk).update(
            expires_at=timezone.now() - timedelta(minutes=5)
        )
        self.assertEqual(self.client.get(self.detail_url).status_code, 403)
        self.assertEqual(self.client.get(self.list_url).data["courses"], [])

    def test_unpublished_and_legacy_lessons_cannot_be_completed(self):
        hidden_url = f"/api/recorded-courses/learning/student/lessons/{self.draft_lesson.pk}/complete/"
        legacy_url = f"/api/recorded-courses/learning/student/lessons/{self.unassigned.pk}/complete/"
        self.assertEqual(self.client.post(hidden_url).status_code, 404)
        self.assertEqual(self.client.post(legacy_url).status_code, 404)

    def test_reported_completion_is_idempotent_and_student_specific(self):
        # A signed ticket must be issued first; tests bypass only the elapsed
        # wait, never signature, student, lesson or entitlement checks.
        started = self.client.post(self.session_url)
        self.assertEqual(started.status_code, 200, started.data)
        with patch("recordedcourses.learning_playback.MIN_VIEW_SECONDS", 0):
            saved = self.client.post(
                self.complete_url, {"playback_ticket": started.data["ticket"]}, format="json",
            )
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(self.client.post(self.complete_url).status_code, 200)
        self.assertEqual(LessonLearningProgress.objects.count(), 1)
        self.assertEqual(self.client.get(self.detail_url).data["course"]["completed_lessons"], 1)
        self.assertIsNotNone(LessonLearningProgress.objects.get(student=self.student, lesson=self.lesson).completed_at)
        self.client.force_authenticate(user=self.other_user)
        self.assertEqual(self.client.get(self.list_url).data["courses"], [])

    def test_cross_tenant_isolation(self):
        OrganizationLearningSettings.objects.create(organization=self.other_org, is_enabled=True)
        self.client.force_authenticate(user=self.stranger_user)
        self.assertEqual(self.client.get(self.detail_url).status_code, 403)
        self.assertEqual(self.client.post(self.complete_url).status_code, 404)

    def test_student_can_download_only_published_purchased_resource(self):
        with tempfile.TemporaryDirectory() as temp:
            field = ModuleResource._meta.get_field("file")
            original = field.storage
            field.storage = FileSystemStorage(location=temp)
            try:
                resource = ModuleResource.objects.create(
                    module=self.module, title="Lesson PDF",
                    uploaded_by=User.objects.create_user(
                        username="admin-p4", password="test-password", role="college_admin", organization=self.org,
                    ), file=SimpleUploadedFile("lecture.pdf", b"%PDF-1.4\nnotes", content_type="application/pdf"),
                )
                url = f"/api/recorded-courses/learning/student/resources/{resource.pk}/download/"
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertIn("attachment", response["Content-Disposition"])
                self.assertNotIn("recorded_course_resources/", response["Content-Disposition"])
                response.close()
                self.client.force_authenticate(user=self.other_user)
                self.assertEqual(self.client.get(url).status_code, 403)
                self.client.force_authenticate(user=self.stranger_user)
                self.assertEqual(self.client.get(url).status_code, 403)
            finally:
                field.storage = original


    def test_completion_requires_signed_playback_ticket(self):
        attempt = self.client.post(self.complete_url)
        self.assertEqual(attempt.status_code, 400, attempt.data)
        self.assertFalse(LessonLearningProgress.objects.exists())
        started = self.client.post(self.session_url)
        self.assertEqual(started.status_code, 200, started.data)
        self.assertEqual(started.data["minimum_seconds"], 10)
        # A signed ticket is issued, but the server rejects immediate completion.
        early = self.client.post(
            self.complete_url, {"playback_ticket": started.data["ticket"]}, format="json",
        )
        self.assertEqual(early.status_code, 400, early.data)
        self.assertFalse(LessonLearningProgress.objects.exists())

    def test_tampered_or_wrong_lesson_ticket_does_not_complete(self):
        started = self.client.post(self.session_url)
        self.assertEqual(started.status_code, 200, started.data)
        ticket = started.data["ticket"]
        with patch("recordedcourses.learning_playback.MIN_VIEW_SECONDS", 0):
            tampered = self.client.post(
                self.complete_url, {"playback_ticket": ticket + "-changed"}, format="json",
            )
            self.assertEqual(tampered.status_code, 400)
            another_lesson = RecordedLesson.objects.create(
                course=self.course, module=self.module, title="Second Lecture", position=4,
            )
            wrong = self.client.post(
                f"/api/recorded-courses/learning/student/lessons/{another_lesson.pk}/complete/",
                {"playback_ticket": ticket}, format="json",
            )
            self.assertEqual(wrong.status_code, 400)
        self.assertFalse(LessonLearningProgress.objects.exists())

    def test_playback_session_is_student_and_course_access_scoped(self):
        ticket = self.client.post(self.session_url)
        self.assertEqual(ticket.status_code, 200, ticket.data)
        # Another user of the same organization with no course access cannot
        # start a session or reuse a signed ticket.
        self.client.force_authenticate(user=self.other_user)
        self.assertEqual(self.client.post(self.session_url).status_code, 403)
        self.assertEqual(self.client.post(
            self.complete_url, {"playback_ticket": ticket.data["ticket"]}, format="json",
        ).status_code, 403)
        RecordedCourseAccess.objects.create(
            organization=self.org, course=self.course, student=self.other_student,
        )
        with patch("recordedcourses.learning_playback.MIN_VIEW_SECONDS", 0):
            self.assertEqual(self.client.post(
                self.complete_url, {"playback_ticket": ticket.data["ticket"]}, format="json",
            ).status_code, 400)
        self.assertFalse(LessonLearningProgress.objects.exists())

    def test_playback_sessions_respect_unpublished_lessons_and_toggle(self):
        draft_url = f"/api/recorded-courses/learning/student/lessons/{self.draft_lesson.pk}/viewing-session/"
        legacy_url = f"/api/recorded-courses/learning/student/lessons/{self.unassigned.pk}/viewing-session/"
        self.assertEqual(self.client.post(draft_url).status_code, 404)
        self.assertEqual(self.client.post(legacy_url).status_code, 404)
        OrganizationLearningSettings.objects.filter(organization=self.org).update(is_enabled=False)
        self.assertEqual(self.client.post(self.session_url).status_code, 403)
