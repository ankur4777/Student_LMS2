from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from academics.models import AcademicSession, ClassRoom
from accounts.models import ParentProfile, StudentProfile, TeacherProfile
from institutions.models import Organization

from .models import FeeStructure


User = get_user_model()


class CollegeAdminFeeStructureAPITests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Org One",
            code="ORG1",
        )
        self.other_org = Organization.objects.create(
            name="Org Two",
            code="ORG2",
        )
        self.admin = User.objects.create_user(
            username="admin",
            password="pass",
            role="college_admin",
            organization=self.org,
        )
        self.other_admin = User.objects.create_user(
            username="other-admin",
            password="pass",
            role="college_admin",
            organization=self.other_org,
        )
        self.teacher_user = User.objects.create_user(
            username="teacher",
            password="pass",
            role="teacher",
            organization=self.org,
        )
        self.student_user = User.objects.create_user(
            username="student",
            password="pass",
            role="student",
            organization=self.org,
        )
        self.parent_user = User.objects.create_user(
            username="parent",
            password="pass",
            role="parent",
            organization=self.org,
        )
        TeacherProfile.objects.create(
            user=self.teacher_user,
            employee_id="T-1",
        )
        StudentProfile.objects.create(
            user=self.student_user,
            admission_number="S-1",
        )
        ParentProfile.objects.create(user=self.parent_user)

        self.session = AcademicSession.objects.create(
            organization=self.org,
            name="2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
        )
        self.classroom = ClassRoom.objects.create(
            organization=self.org,
            name="Class 10",
            academic_session=self.session,
        )
        self.other_session = AcademicSession.objects.create(
            organization=self.other_org,
            name="2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
        )
        self.other_classroom = ClassRoom.objects.create(
            organization=self.other_org,
            name="Other Class",
            academic_session=self.other_session,
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.admin)

    def structure_payload(self, **overrides):
        payload = {
            "academic_session_id": self.session.id,
            "class_room_id": self.classroom.id,
            "name": "Annual Fee",
            "description": "Annual class fee",
            "total_amount": "1500.00",
            "due_date": "2026-06-30",
            "is_active": True,
            "components": [
                {
                    "name": "Tuition Fee",
                    "amount": "1000.00",
                    "description": "Monthly tuition",
                },
                {
                    "name": "Exam Fee",
                    "amount": "500.00",
                    "description": "",
                },
            ],
        }
        payload.update(overrides)
        return payload

    def create_structure(self, **overrides):
        self.authenticate()
        return self.client.post(
            "/api/fees/college-admin/structures/",
            self.structure_payload(**overrides),
            format="json",
        )

    def test_authentication_required(self):
        response = self.client.get(
            "/api/fees/college-admin/structures/"
        )

        self.assertEqual(response.status_code, 401)

    def test_college_admin_role_required(self):
        for user in [
            self.teacher_user,
            self.student_user,
            self.parent_user,
        ]:
            with self.subTest(role=user.role):
                self.authenticate(user)
                response = self.client.get(
                    "/api/fees/college-admin/structures/"
                )
                self.assertEqual(response.status_code, 403)

    def test_setup_returns_same_organization_sessions_and_classes(self):
        self.authenticate()

        response = self.client.get(
            "/api/fees/college-admin/setup/"
        )

        self.assertEqual(response.status_code, 200)
        session_ids = [
            session["id"]
            for session in response.data["academic_sessions"]
        ]
        class_ids = [
            classroom["id"]
            for classroom in response.data["classes"]
        ]
        self.assertIn(self.session.id, session_ids)
        self.assertIn(self.classroom.id, class_ids)
        self.assertNotIn(self.other_session.id, session_ids)
        self.assertNotIn(self.other_classroom.id, class_ids)

    def test_fee_component_creation_and_structure_retrieval(self):
        create_response = self.create_structure()

        self.assertEqual(create_response.status_code, 201)
        structure = FeeStructure.objects.get(name="Annual Fee")
        self.assertEqual(structure.organization, self.org)
        self.assertEqual(structure.components.count(), 2)

        detail_response = self.client.get(
            f"/api/fees/college-admin/structures/{structure.id}/"
        )

        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(
            len(detail_response.data["structure"]["components"]),
            2,
        )

    def test_same_organization_listing_and_cross_college_isolation(self):
        self.create_structure()
        other_structure = FeeStructure.objects.create(
            organization=self.other_org,
            academic_session=self.other_session,
            class_room=self.other_classroom,
            name="Foreign Fee",
            total_amount=Decimal("500.00"),
        )
        self.authenticate()

        response = self.client.get(
            "/api/fees/college-admin/structures/"
        )

        ids = [
            structure["id"]
            for structure in response.data["structures"]
        ]
        self.assertNotIn(other_structure.id, ids)
        self.assertEqual(len(ids), 1)

    def test_foreign_academic_session_rejected(self):
        response = self.create_structure(
            academic_session_id=self.other_session.id,
            class_room_id=self.classroom.id,
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(FeeStructure.objects.exists())

    def test_foreign_class_rejected(self):
        response = self.create_structure(
            academic_session_id=self.session.id,
            class_room_id=self.other_classroom.id,
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(FeeStructure.objects.exists())

    def test_organization_payload_tampering_is_ignored(self):
        response = self.create_structure(
            organization=self.other_org.id,
            organization_id=self.other_org.id,
        )

        self.assertEqual(response.status_code, 201)
        structure = FeeStructure.objects.get(name="Annual Fee")
        self.assertEqual(structure.organization, self.org)

    def test_decimal_component_total_validation(self):
        response = self.create_structure(
            total_amount="1500.50",
            components=[
                {"name": "Tuition Fee", "amount": "1000.00"},
                {"name": "Exam Fee", "amount": "500.00"},
            ],
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(FeeStructure.objects.exists())

    def test_negative_amount_rejected(self):
        response = self.create_structure(total_amount="-1.00")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(FeeStructure.objects.exists())

    def test_cross_tenant_detail_access_blocked(self):
        other_structure = FeeStructure.objects.create(
            organization=self.other_org,
            academic_session=self.other_session,
            class_room=self.other_classroom,
            name="Foreign Fee",
            total_amount=Decimal("500.00"),
        )
        self.authenticate()

        response = self.client.get(
            f"/api/fees/college-admin/structures/{other_structure.id}/"
        )

        self.assertEqual(response.status_code, 404)

    def test_patch_updates_components_and_blocks_foreign_class(self):
        create_response = self.create_structure()
        structure_id = create_response.data["structure"]["id"]

        patch_response = self.client.patch(
            f"/api/fees/college-admin/structures/{structure_id}/",
            {
                "total_amount": "2000.00",
                "components": [
                    {"name": "Tuition Fee", "amount": "1500.00"},
                    {"name": "Library Fee", "amount": "500.00"},
                ],
            },
            format="json",
        )
        foreign_response = self.client.patch(
            f"/api/fees/college-admin/structures/{structure_id}/",
            {
                "class_room_id": self.other_classroom.id,
            },
            format="json",
        )

        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(foreign_response.status_code, 404)
        structure = FeeStructure.objects.get(id=structure_id)
        self.assertEqual(structure.components.count(), 2)
        self.assertEqual(structure.total_amount, Decimal("2000.00"))
