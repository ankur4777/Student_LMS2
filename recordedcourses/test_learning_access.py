"""Local API regression tests for master toggle and tenant isolation."""
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from institutions.models import Organization
from recordedcourses.models import OrganizationLearningSettings


class OrganizationLearningAccessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.org_a = Organization.objects.create(name="Local Learning A", code="LEARNING-A")
        cls.org_b = Organization.objects.create(name="Local Learning B", code="LEARNING-B")
        cls.platform = User.objects.create_user(
            username="learning-platform", password="test-only", role="platform_admin",
        )
        cls.admin_a = User.objects.create_user(
            username="learning-admin-a", password="test-only", role="college_admin", organization=cls.org_a,
        )
        cls.admin_b = User.objects.create_user(
            username="learning-admin-b", password="test-only", role="college_admin", organization=cls.org_b,
        )
        cls.teacher_a = User.objects.create_user(
            username="learning-teacher-a", password="test-only", role="teacher", organization=cls.org_a,
        )
        cls.parent_a = User.objects.create_user(
            username="learning-parent-a", password="test-only", role="parent", organization=cls.org_a,
        )

    def setUp(self):
        self.client = APIClient()
        self.url = f"/api/recorded-courses/platform-admin/organizations/{self.org_a.pk}/learning-access/"
        self.status_url = "/api/recorded-courses/learning-access/"

    def as_user(self, user):
        self.client.force_authenticate(user=user)

    def test_feature_defaults_off_without_creating_a_row(self):
        self.as_user(self.admin_a)
        result = self.client.get(self.status_url)
        self.assertEqual(result.status_code, 200)
        self.assertFalse(result.data["is_enabled"])
        self.assertFalse(result.data["can_use_learning_center"])
        self.assertEqual(OrganizationLearningSettings.objects.count(), 0)

    def test_platform_admin_can_enable_only_target_organization(self):
        self.as_user(self.platform)
        res = self.client.patch(self.url, {"is_enabled": True}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["is_enabled"])
        self.assertTrue(OrganizationLearningSettings.objects.get(organization=self.org_a).is_enabled)
        self.assertFalse(OrganizationLearningSettings.objects.filter(organization=self.org_b).exists())
        self.as_user(self.admin_a)
        own = self.client.get(self.status_url)
        self.assertTrue(own.data["can_use_learning_center"])
        self.as_user(self.admin_b)
        other = self.client.get(self.status_url)
        self.assertFalse(other.data["can_use_learning_center"])

    def test_college_admin_and_teacher_cannot_toggle(self):
        for user in (self.admin_a, self.admin_b, self.teacher_a):
            self.as_user(user)
            response = self.client.patch(self.url, {"is_enabled": True}, format="json")
            self.assertEqual(response.status_code, 403)
        self.assertEqual(OrganizationLearningSettings.objects.count(), 0)

    def test_platform_admin_cannot_set_string_instead_of_boolean(self):
        self.as_user(self.platform)
        result = self.client.patch(self.url, {"is_enabled": "true"}, format="json")
        self.assertEqual(result.status_code, 400)
        self.assertEqual(OrganizationLearningSettings.objects.count(), 0)

    def test_platform_admin_can_disable_without_deleting_setting(self):
        self.as_user(self.platform)
        self.assertEqual(self.client.patch(self.url, {"is_enabled": True}, format="json").status_code, 200)
        result = self.client.patch(self.url, {"is_enabled": False}, format="json")
        self.assertEqual(result.status_code, 200)
        self.assertFalse(OrganizationLearningSettings.objects.get(organization=self.org_a).is_enabled)

    def test_parent_does_not_gain_learning_center_without_child_access(self):
        OrganizationLearningSettings.objects.create(organization=self.org_a, is_enabled=True)
        self.as_user(self.parent_a)
        response = self.client.get(self.status_url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_enabled"])
        self.assertFalse(response.data["can_use_learning_center"])

    def test_disabled_organization_cannot_be_enabled(self):
        self.org_a.is_active = False
        self.org_a.save(update_fields=["is_active"])
        self.as_user(self.platform)
        result = self.client.patch(self.url, {"is_enabled": True}, format="json")
        self.assertEqual(result.status_code, 400)
        self.assertEqual(OrganizationLearningSettings.objects.count(), 0)

    def test_anonymous_cannot_toggle(self):
        response = self.client.patch(self.url, {"is_enabled": True}, format="json")
        self.assertIn(response.status_code, (401, 403))
