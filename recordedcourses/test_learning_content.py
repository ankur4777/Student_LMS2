"""Local integration tests for new course authoring routes and isolation."""
import tempfile
from decimal import Decimal
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import FileSystemStorage
from rest_framework.test import APITestCase

from accounts.models import TeacherProfile, User
from institutions.models import Organization
from recordedcourses.models import (
    CourseModule, ModuleResource, OrganizationLearningSettings,
    RecordedCourse, RecordedLesson, TeacherCourseAssignment,
)


class LearningModuleAPITests(APITestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name="Learning College A", code="P3-A")
        self.org_b = Organization.objects.create(name="Learning College B", code="P3-B")
        self.admin_a = User.objects.create_user(username="p3-admin-a", password="test-password", role="college_admin", organization=self.org_a)
        self.admin_b = User.objects.create_user(username="p3-admin-b", password="test-password", role="college_admin", organization=self.org_b)
        t_a = User.objects.create_user(username="p3-teacher-a", password="test-password", role="teacher", organization=self.org_a)
        t_b = User.objects.create_user(username="p3-teacher-b", password="test-password", role="teacher", organization=self.org_b)
        self.teacher_a = TeacherProfile.objects.create(user=t_a, employee_id="P3-TA")
        self.teacher_b = TeacherProfile.objects.create(user=t_b, employee_id="P3-TB")
        self.student_a = User.objects.create_user(username="p3-student", password="test-password", role="student", organization=self.org_a)
        self.course_a = RecordedCourse.objects.create(organization=self.org_a, title="Course A", price=Decimal("0.00"))
        self.course_b = RecordedCourse.objects.create(organization=self.org_b, title="Course B", price=Decimal("0.00"))
        self.module_url = f"/api/recorded-courses/learning/manage/courses/{self.course_a.pk}/modules/"
        self.list_url = "/api/recorded-courses/learning/manage/courses/"

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def enable(self):
        OrganizationLearningSettings.objects.update_or_create(organization=self.org_a, defaults={"is_enabled": True})

    def assign(self):
        return TeacherCourseAssignment.objects.create(course=self.course_a, teacher=self.teacher_a, assigned_by=self.admin_a)

    def test_disabled_org_cannot_list_or_create_modules(self):
        self.auth(self.admin_a)
        self.assertEqual(self.client.get(self.list_url).status_code, 403)
        self.assertEqual(self.client.post(self.module_url, {"title": "Hidden", "position": 1}).status_code, 403)
        self.assertFalse(CourseModule.objects.exists())

    def test_admin_creates_and_publishes_module(self):
        self.enable()
        self.auth(self.admin_a)
        result = self.client.post(self.module_url, {"title": "Module One", "position": 1}, format="json")
        self.assertEqual(result.status_code, 201, getattr(result, "data", None))
        self.assertFalse(result.data["module"]["is_published"])
        module_id = result.data["module"]["id"]
        update = self.client.patch(f"/api/recorded-courses/learning/manage/modules/{module_id}/", {"is_published": True}, format="json")
        self.assertEqual(update.status_code, 200)
        self.assertTrue(CourseModule.objects.get(pk=module_id).is_published)

    def test_teacher_requires_assignment_and_cannot_publish(self):
        self.enable()
        self.auth(self.teacher_a.user)
        self.assertEqual(self.client.post(self.module_url, {"title": "No access", "position": 1}).status_code, 404)
        self.auth(self.admin_a)
        self.assign()
        self.auth(self.teacher_a.user)
        result = self.client.post(self.module_url, {"title": "Draft", "position": 1}, format="json")
        self.assertEqual(result.status_code, 201)
        module_id = result.data["module"]["id"]
        denied = self.client.patch(f"/api/recorded-courses/learning/manage/modules/{module_id}/", {"is_published": True}, format="json")
        self.assertEqual(denied.status_code, 403)
        self.assertFalse(CourseModule.objects.get(pk=module_id).is_published)

    def test_admin_cannot_access_another_org_and_student_cannot_manage(self):
        self.enable()
        self.auth(self.admin_b)
        self.assertEqual(self.client.get(self.module_url).status_code, 403)  # org B not enabled
        OrganizationLearningSettings.objects.create(organization=self.org_b, is_enabled=True)
        self.assertEqual(self.client.get(self.module_url).status_code, 404)
        self.auth(self.student_a)
        self.assertEqual(self.client.get(self.list_url).status_code, 403)

    def test_teacher_assignment_cannot_cross_organizations(self):
        self.enable()
        self.auth(self.admin_a)
        url = f"/api/recorded-courses/learning/manage/courses/{self.course_a.pk}/teachers/"
        response = self.client.post(url, {"teacher_id": self.teacher_b.pk}, format="json")
        self.assertEqual(response.status_code, 404)
        allowed = self.client.post(url, {"teacher_id": self.teacher_a.pk}, format="json")
        self.assertEqual(allowed.status_code, 200)
        self.assertTrue(TeacherCourseAssignment.objects.filter(course=self.course_a, teacher=self.teacher_a, is_active=True).exists())
        off = self.client.post(url, {"teacher_id": self.teacher_a.pk, "is_active": False}, format="json")
        self.assertEqual(off.status_code, 200)
        self.assertFalse(TeacherCourseAssignment.objects.get(course=self.course_a, teacher=self.teacher_a).is_active)

    def test_duplicate_module_position_rejected(self):
        self.enable()
        self.auth(self.admin_a)
        self.assertEqual(self.client.post(self.module_url, {"title": "One", "position": 1}, format="json").status_code, 201)
        result = self.client.post(self.module_url, {"title": "Two", "position": 1}, format="json")
        self.assertEqual(result.status_code, 400)
        self.assertEqual(CourseModule.objects.count(), 1)

    def test_private_resource_upload_and_download_authorization(self):
        self.enable()
        self.auth(self.admin_a)
        m = CourseModule.objects.create(course=self.course_a, title="Notes", position=1)
        resource_url = f"/api/recorded-courses/learning/manage/modules/{m.pk}/resources/"
        with tempfile.TemporaryDirectory() as temp:
            from recordedcourses.models import private_recorded_course_storage
            field = ModuleResource._meta.get_field("file")
            previous_storage = field.storage
            field.storage = FileSystemStorage(location=temp)
            try:
                upload = SimpleUploadedFile("lesson-notes.pdf", b"%PDF-1.4\ncontent", content_type="application/pdf")
                response = self.client.post(resource_url, {"title": "Study Notes", "kind": "notes", "file": upload}, format="multipart")
                self.assertEqual(response.status_code, 201, getattr(response, "data", None))
                resource_id = response.data["resource"]["id"]
                self.assertNotIn("file", response.data["resource"])
                download_url = f"/api/recorded-courses/learning/manage/resources/{resource_id}/download/"
                download = self.client.get(download_url)
                self.assertEqual(download.status_code, 200)
                self.assertIn("attachment", download["Content-Disposition"])
                self.assertNotIn("recorded_course_resources", download["Content-Disposition"])
                download.close()
                self.auth(self.student_a)
                self.assertEqual(self.client.get(download_url).status_code, 403)
                self.auth(self.admin_b)
                self.assertEqual(self.client.get(download_url).status_code, 403)
            finally:
                field.storage = previous_storage

    def test_existing_recordings_remain_without_module(self):
        # Additive migration: recorded courses retain their old lessons.
        self.assertTrue(RecordedLesson._meta.get_field("module").null)
