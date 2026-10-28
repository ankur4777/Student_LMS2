"""Local-only regression tests for recorded-learning Phase 1 models."""

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase

from accounts.models import TeacherProfile, User
from institutions.models import Organization
from recordedcourses.models import (
    CourseModule,
    ModuleResource,
    OrganizationLearningSettings,
    RecordedCourse,
    TeacherCourseAssignment,
)


class RecordedLearningFoundationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="Local Training College", code="LOCAL-LEARN")
        cls.other_org = Organization.objects.create(name="Other College", code="OTHER-LEARN")
        cls.admin = User.objects.create_user(
            username="learning-admin", password="test-only-password", role="college_admin",
            organization=cls.org,
        )
        teacher_user = User.objects.create_user(
            username="learning-teacher", password="test-only-password", role="teacher",
            organization=cls.org,
        )
        cls.teacher = TeacherProfile.objects.create(user=teacher_user, employee_id="LOCAL-T001")
        other_user = User.objects.create_user(
            username="other-learning-teacher", password="test-only-password", role="teacher",
            organization=cls.other_org,
        )
        cls.other_teacher = TeacherProfile.objects.create(user=other_user, employee_id="OTHER-T001")
        cls.course = RecordedCourse.objects.create(
            organization=cls.org, title="Local Python Course", price=Decimal("0.00"),
            access_duration_days=180,
        )
        cls.module = CourseModule.objects.create(
            course=cls.course, position=1, title="Getting started",
        )

    def test_organization_master_switch_defaults_off(self):
        settings = OrganizationLearningSettings.objects.create(organization=self.org)
        self.assertFalse(settings.is_enabled)
        self.assertIsNone(settings.updated_by)

    def test_module_defaults_unpublished_and_is_ordered(self):
        self.assertFalse(self.module.is_published)
        later = CourseModule.objects.create(course=self.course, position=2, title="More Python")
        self.assertEqual(list(self.course.modules.values_list("id", flat=True)), [self.module.id, later.id])

    def test_duplicate_course_module_position_rejected(self):
        with self.assertRaises(ValidationError):
            CourseModule.objects.create(course=self.course, position=1, title="Duplicate")

    def test_teacher_cannot_be_assigned_across_organizations(self):
        with self.assertRaises(ValidationError):
            TeacherCourseAssignment.objects.create(
                course=self.course, teacher=self.other_teacher, assigned_by=self.admin,
            )

    def test_admin_can_assign_teacher_to_own_course(self):
        assignment = TeacherCourseAssignment.objects.create(
            course=self.course, teacher=self.teacher, assigned_by=self.admin,
        )
        self.assertTrue(assignment.is_active)

    def test_teacher_must_be_assigned_to_upload_resources(self):
        resource = ModuleResource(
            module=self.module, title="Notes", uploaded_by=self.teacher.user,
        )
        with self.assertRaises(ValidationError):
            resource.full_clean()

    def test_resource_storage_uses_private_media(self):
        field = ModuleResource._meta.get_field("file")
        from recordedcourses.models import private_recorded_course_storage
        self.assertIs(field.storage, private_recorded_course_storage)
