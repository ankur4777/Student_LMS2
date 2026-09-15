from django.test import TestCase
from rest_framework.test import APIClient

from academics.models import ParentStudent
from institutions.models import Organization

from .models import ParentProfile, StudentProfile, User


class CollegeAdminParentManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org_a = Organization.objects.create(
            name="College A",
            code="college-a",
        )
        self.org_b = Organization.objects.create(
            name="College B",
            code="college-b",
        )
        self.admin_a = User.objects.create_user(
            username="admin-a",
            password="pass",
            role="college_admin",
            organization=self.org_a,
        )
        self.admin_b = User.objects.create_user(
            username="admin-b",
            password="pass",
            role="college_admin",
            organization=self.org_b,
        )
        self.platform_admin = User.objects.create_user(
            username="platform",
            password="pass",
            role="platform_admin",
        )
        self.parent_a_user = User.objects.create_user(
            username="parent-a",
            password="pass",
            role="parent",
            organization=self.org_a,
        )
        self.parent_a = ParentProfile.objects.create(
            user=self.parent_a_user,
            phone="111",
        )
        self.parent_b_user = User.objects.create_user(
            username="parent-b",
            password="pass",
            role="parent",
            organization=self.org_b,
        )
        self.parent_b = ParentProfile.objects.create(
            user=self.parent_b_user,
            phone="222",
        )
        self.student_a_user = User.objects.create_user(
            username="student-a",
            password="pass",
            role="student",
            organization=self.org_a,
        )
        self.student_a = StudentProfile.objects.create(
            user=self.student_a_user,
            admission_number="A001",
        )
        self.student_b_user = User.objects.create_user(
            username="student-b",
            password="pass",
            role="student",
            organization=self.org_b,
        )
        self.student_b = StudentProfile.objects.create(
            user=self.student_b_user,
            admission_number="B001",
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_college_admin_lists_only_own_organization_parents(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            "/api/accounts/college-admin/parents/"
        )

        self.assertEqual(response.status_code, 200)
        usernames = [
            parent["username"]
            for parent in response.data["parents"]
        ]
        self.assertIn("parent-a", usernames)
        self.assertNotIn("parent-b", usernames)

    def test_college_admin_cannot_view_or_edit_other_college_parent(self):
        self.authenticate(self.admin_a)
        url = (
            f"/api/accounts/college-admin/parents/"
            f"{self.parent_b_user.id}/"
        )

        get_response = self.client.get(url)
        patch_response = self.client.patch(
            url,
            {"first_name": "Changed"},
            format="json",
        )

        self.assertEqual(get_response.status_code, 404)
        self.assertEqual(patch_response.status_code, 404)
        self.parent_b_user.refresh_from_db()
        self.assertEqual(self.parent_b_user.first_name, "")

    def test_college_admin_cannot_link_cross_college_student(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            (
                f"/api/accounts/college-admin/parents/"
                f"{self.parent_a_user.id}/student-links/"
            ),
            {
                "student_profile_id": self.student_b.id,
                "relationship": ParentStudent.Relationship.GUARDIAN,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(
            ParentStudent.objects.filter(
                parent=self.parent_a,
                student=self.student_b,
            ).exists()
        )

    def test_duplicate_parent_student_relationship_is_rejected(self):
        ParentStudent.objects.create(
            parent=self.parent_a,
            student=self.student_a,
            relationship=ParentStudent.Relationship.FATHER,
        )
        self.authenticate(self.admin_a)

        response = self.client.post(
            (
                f"/api/accounts/college-admin/parents/"
                f"{self.parent_a_user.id}/student-links/"
            ),
            {
                "student_profile_id": self.student_a.id,
                "relationship": ParentStudent.Relationship.FATHER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            ParentStudent.objects.filter(
                parent=self.parent_a,
                student=self.student_a,
            ).count(),
            1,
        )

    def test_unlink_removes_only_parent_student_relationship(self):
        link = ParentStudent.objects.create(
            parent=self.parent_a,
            student=self.student_a,
            relationship=ParentStudent.Relationship.MOTHER,
        )
        user_count = User.objects.count()
        parent_count = ParentProfile.objects.count()
        student_count = StudentProfile.objects.count()
        self.authenticate(self.admin_a)

        response = self.client.delete(
            (
                f"/api/accounts/college-admin/parents/"
                f"{self.parent_a_user.id}/student-links/{link.id}/"
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            ParentStudent.objects.filter(id=link.id).exists()
        )
        self.assertEqual(User.objects.count(), user_count)
        self.assertEqual(ParentProfile.objects.count(), parent_count)
        self.assertEqual(StudentProfile.objects.count(), student_count)

    def test_other_roles_cannot_use_college_admin_parent_endpoint(self):
        self.authenticate(self.platform_admin)

        response = self.client.get(
            "/api/accounts/college-admin/parents/"
        )

        self.assertEqual(response.status_code, 403)

    def test_parent_create_assigns_role_and_organization_server_side(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            "/api/accounts/college-admin/parents/",
            {
                "username": "new-parent",
                "password": "pass",
                "first_name": "New",
                "last_name": "Parent",
                "email": "new@example.com",
                "phone": "333",
                "occupation": "Engineer",
                "role": "teacher",
                "organization": self.org_b.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="new-parent")
        self.assertEqual(user.role, "parent")
        self.assertEqual(user.organization, self.org_a)
        self.assertTrue(
            ParentProfile.objects.filter(user=user).exists()
        )

    def test_link_options_show_only_same_organization_students(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            (
                f"/api/accounts/college-admin/parents/"
                f"{self.parent_a_user.id}/link-options/"
            )
        )

        self.assertEqual(response.status_code, 200)
        student_profile_ids = [
            student["student_profile_id"]
            for student in response.data["students"]
        ]
        self.assertIn(self.student_a.id, student_profile_ids)
        self.assertNotIn(self.student_b.id, student_profile_ids)


class CollegeAdminProfileTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(
            name="College",
            code="college",
            email="office@example.com",
            phone="123",
            address="Main Road",
            website="https://example.com",
        )
        self.other_org = Organization.objects.create(
            name="Other College",
            code="other",
        )
        self.admin = User.objects.create_user(
            username="college-admin",
            password="pass",
            role="college_admin",
            organization=self.org,
            first_name="College",
            last_name="Admin",
            email="admin@example.com",
        )
        self.student = User.objects.create_user(
            username="student",
            password="pass",
            role="student",
            organization=self.org,
        )
        self.teacher = User.objects.create_user(
            username="teacher",
            password="pass",
            role="teacher",
            organization=self.org,
        )
        self.parent = User.objects.create_user(
            username="parent",
            password="pass",
            role="parent",
            organization=self.org,
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_college_admin_profile_get_returns_account_and_organization(self):
        self.authenticate(self.admin)

        response = self.client.get(
            "/api/accounts/college-admin/profile/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["account"]["username"],
            "college-admin",
        )
        self.assertEqual(
            response.data["organization"]["code"],
            "college",
        )

    def test_college_admin_profile_patch_updates_only_allowed_fields(self):
        self.authenticate(self.admin)

        response = self.client.patch(
            "/api/accounts/college-admin/profile/",
            {
                "first_name": "Updated",
                "last_name": "Name",
                "email": "updated@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.first_name, "Updated")
        self.assertEqual(self.admin.last_name, "Name")
        self.assertEqual(self.admin.email, "updated@example.com")

    def test_protected_fields_cannot_be_modified(self):
        self.authenticate(self.admin)

        response = self.client.patch(
            "/api/accounts/college-admin/profile/",
            {
                "username": "changed",
                "role": "platform_admin",
                "organization": self.other_org.id,
                "organization_id": self.other_org.id,
                "is_staff": True,
                "is_superuser": True,
                "is_active": False,
                "first_name": "Safe",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.username, "college-admin")
        self.assertEqual(self.admin.role, "college_admin")
        self.assertEqual(self.admin.organization, self.org)
        self.assertFalse(self.admin.is_staff)
        self.assertFalse(self.admin.is_superuser)
        self.assertTrue(self.admin.is_active)
        self.assertEqual(self.admin.first_name, "Safe")

    def test_organization_is_read_only_and_server_side(self):
        self.authenticate(self.admin)

        self.client.patch(
            "/api/accounts/college-admin/profile/",
            {
                "organization": self.other_org.id,
                "organization_id": self.other_org.id,
                "code": "changed",
                "is_active": False,
            },
            format="json",
        )

        self.admin.refresh_from_db()
        self.org.refresh_from_db()
        self.assertEqual(self.admin.organization, self.org)
        self.assertEqual(self.org.code, "college")
        self.assertTrue(self.org.is_active)

    def test_other_roles_are_denied(self):
        for user in [self.student, self.teacher, self.parent]:
            self.authenticate(user)
            response = self.client.get(
                "/api/accounts/college-admin/profile/"
            )
            self.assertEqual(response.status_code, 403)

    def test_unauthenticated_request_is_denied(self):
        response = self.client.get(
            "/api/accounts/college-admin/profile/"
        )

        self.assertEqual(response.status_code, 401)
