from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from academics.models import AcademicSession, ClassRoom, Section, StudentEnrollment
from accounts.models import ParentProfile, StudentProfile, TeacherProfile
from institutions.models import Organization

from .models import FeeInstallment, FeePayment, FeeStructure, StudentFee


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
        self.student = StudentProfile.objects.create(
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
        self.section = Section.objects.create(
            organization=self.org,
            name="A",
            classroom=self.classroom,
        )
        self.enrollment = StudentEnrollment.objects.create(
            student=self.student,
            section=self.section,
            roll_number="1",
        )
        self.other_student_user = User.objects.create_user(
            username="other-student",
            password="pass",
            role="student",
            organization=self.other_org,
        )
        self.other_student = StudentProfile.objects.create(
            user=self.other_student_user,
            admission_number="OS-1",
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
        self.other_section = Section.objects.create(
            organization=self.other_org,
            name="B",
            classroom=self.other_classroom,
        )
        self.other_enrollment = StudentEnrollment.objects.create(
            student=self.other_student,
            section=self.other_section,
            roll_number="2",
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

    def make_structure(self, organization=None):
        organization = organization or self.org
        if organization == self.org:
            session = self.session
            classroom = self.classroom
        else:
            session = self.other_session
            classroom = self.other_classroom

        return FeeStructure.objects.create(
            organization=organization,
            academic_session=session,
            class_room=classroom,
            name=f"{organization.code} Fee",
            total_amount=Decimal("1500.00"),
            due_date=date(2026, 6, 30),
        )

    def student_fee_payload(self, structure=None, **overrides):
        structure = structure or self.make_structure()
        payload = {
            "student_profile_id": self.student.id,
            "enrollment_id": self.enrollment.id,
            "academic_session_id": self.session.id,
            "fee_structure_id": structure.id,
            "discount_amount": "0.00",
            "fine_amount": "0.00",
            "due_date": "2026-06-30",
        }
        payload.update(overrides)
        return payload

    def assign_student_fee(self, structure=None, **overrides):
        self.authenticate()
        return self.client.post(
            "/api/fees/college-admin/student-fees/",
            self.student_fee_payload(structure, **overrides),
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

    def test_assignment_setup_includes_org_students_enrollments_and_structures(self):
        structure = self.make_structure()
        other_structure = self.make_structure(self.other_org)
        self.authenticate()

        response = self.client.get("/api/fees/college-admin/setup/")

        self.assertEqual(response.status_code, 200)
        student_ids = [
            student["student_profile_id"]
            for student in response.data["students"]
        ]
        enrollment_ids = [
            enrollment["id"]
            for enrollment in response.data["enrollments"]
        ]
        structure_ids = [
            item["id"]
            for item in response.data["fee_structures"]
        ]
        self.assertIn(self.student.id, student_ids)
        self.assertIn(self.enrollment.id, enrollment_ids)
        self.assertIn(structure.id, structure_ids)
        self.assertNotIn(self.other_student.id, student_ids)
        self.assertNotIn(self.other_enrollment.id, enrollment_ids)
        self.assertNotIn(other_structure.id, structure_ids)

    def test_student_fee_creation_and_payable_calculation(self):
        response = self.assign_student_fee(
            discount_amount="100.00",
            fine_amount="25.00",
            organization=self.other_org.id,
            organization_id=self.other_org.id,
        )

        self.assertEqual(response.status_code, 201)
        student_fee = StudentFee.objects.get()
        self.assertEqual(student_fee.organization, self.org)
        self.assertEqual(student_fee.original_amount, Decimal("1500.00"))
        self.assertEqual(student_fee.discount_amount, Decimal("100.00"))
        self.assertEqual(student_fee.fine_amount, Decimal("25.00"))
        self.assertEqual(student_fee.payable_amount, Decimal("1425.00"))
        self.assertEqual(response.data["student_fee"]["status"], "pending")

    def test_student_fee_authentication_and_role_required(self):
        response = self.client.get("/api/fees/college-admin/student-fees/")
        self.assertEqual(response.status_code, 401)

        for user in [self.teacher_user, self.student_user, self.parent_user]:
            self.authenticate(user)
            response = self.client.get("/api/fees/college-admin/student-fees/")
            self.assertEqual(response.status_code, 403)

    def test_cross_college_student_enrollment_and_structure_rejected(self):
        own_structure = self.make_structure()
        foreign_structure = self.make_structure(self.other_org)

        foreign_student_response = self.assign_student_fee(
            own_structure,
            student_profile_id=self.other_student.id,
            enrollment_id=self.enrollment.id,
        )
        foreign_enrollment_response = self.assign_student_fee(
            own_structure,
            enrollment_id=self.other_enrollment.id,
        )
        foreign_structure_response = self.assign_student_fee(
            foreign_structure,
            fee_structure_id=foreign_structure.id,
        )

        self.assertEqual(foreign_student_response.status_code, 404)
        self.assertEqual(foreign_enrollment_response.status_code, 404)
        self.assertEqual(foreign_structure_response.status_code, 404)

    def test_duplicate_student_fee_assignment_rejected(self):
        structure = self.make_structure()
        first = self.assign_student_fee(structure)
        second = self.assign_student_fee(structure)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(StudentFee.objects.count(), 1)

    def test_student_fee_detail_cross_tenant_blocked(self):
        foreign_structure = self.make_structure(self.other_org)
        foreign_fee = StudentFee.objects.create(
            organization=self.other_org,
            student=self.other_student,
            academic_session=self.other_session,
            fee_structure=foreign_structure,
            original_amount=Decimal("1500.00"),
            discount_amount=Decimal("0.00"),
            fine_amount=Decimal("0.00"),
            payable_amount=Decimal("1500.00"),
            due_date=date(2026, 6, 30),
        )
        self.authenticate()

        response = self.client.get(
            f"/api/fees/college-admin/student-fees/{foreign_fee.id}/"
        )

        self.assertEqual(response.status_code, 404)

    def test_installment_creation_and_invalid_total_rejected(self):
        response = self.assign_student_fee()
        student_fee_id = response.data["student_fee"]["id"]

        first = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/installments/",
            {
                "name": "First Term",
                "amount": "1000.00",
                "due_date": "2026-04-30",
                "sequence": 1,
            },
            format="json",
        )
        too_much = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/installments/",
            {
                "name": "Second Term",
                "amount": "600.00",
                "due_date": "2026-05-30",
                "sequence": 2,
            },
            format="json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(too_much.status_code, 400)
        self.assertEqual(FeeInstallment.objects.count(), 1)

    def test_payment_recording_partial_full_and_history_preserved(self):
        response = self.assign_student_fee()
        student_fee_id = response.data["student_fee"]["id"]

        partial = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "500.00",
                "payment_date": "2026-04-01",
                "payment_method": FeePayment.Method.CASH,
                "reference_number": "R1",
            },
            format="json",
        )
        detail_after_partial = self.client.get(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/"
        )
        full = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "1000.00",
                "payment_date": "2026-04-02",
                "payment_method": FeePayment.Method.UPI,
                "reference_number": "R2",
            },
            format="json",
        )
        detail_after_full = self.client.get(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/"
        )

        self.assertEqual(partial.status_code, 201)
        self.assertEqual(full.status_code, 201)
        self.assertEqual(
            detail_after_partial.data["student_fee"]["status"],
            "partially_paid",
        )
        self.assertEqual(
            detail_after_full.data["student_fee"]["status"],
            "paid",
        )
        self.assertEqual(
            len(detail_after_full.data["student_fee"]["payments"]),
            2,
        )

    def test_overdue_calculation(self):
        response = self.assign_student_fee(due_date="2000-01-01")
        student_fee_id = response.data["student_fee"]["id"]

        detail = self.client.get(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/"
        )

        self.assertEqual(detail.data["student_fee"]["status"], "overdue")

    def test_overpayment_rejected(self):
        response = self.assign_student_fee()
        student_fee_id = response.data["student_fee"]["id"]

        payment = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "1500.01",
                "payment_method": FeePayment.Method.CASH,
            },
            format="json",
        )

        self.assertEqual(payment.status_code, 400)
        self.assertEqual(FeePayment.objects.count(), 0)

    def test_installment_payment_and_overpayment_rules(self):
        response = self.assign_student_fee()
        student_fee_id = response.data["student_fee"]["id"]
        installment_response = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/installments/",
            {
                "name": "First Term",
                "amount": "500.00",
                "due_date": "2026-04-30",
                "sequence": 1,
            },
            format="json",
        )
        installment_id = installment_response.data["installment"]["id"]

        overpay = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "500.01",
                "payment_method": FeePayment.Method.CASH,
                "installment_id": installment_id,
            },
            format="json",
        )
        valid = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "500.00",
                "payment_method": FeePayment.Method.CASH,
                "installment_id": installment_id,
            },
            format="json",
        )

        self.assertEqual(overpay.status_code, 400)
        self.assertEqual(valid.status_code, 201)

    def test_foreign_installment_rejected_for_payment(self):
        response = self.assign_student_fee()
        student_fee_id = response.data["student_fee"]["id"]
        foreign_structure = self.make_structure(self.other_org)
        foreign_fee = StudentFee.objects.create(
            organization=self.other_org,
            student=self.other_student,
            academic_session=self.other_session,
            fee_structure=foreign_structure,
            original_amount=Decimal("1500.00"),
            discount_amount=Decimal("0.00"),
            fine_amount=Decimal("0.00"),
            payable_amount=Decimal("1500.00"),
            due_date=date(2026, 6, 30),
        )
        foreign_installment = FeeInstallment.objects.create(
            student_fee=foreign_fee,
            name="Foreign",
            amount=Decimal("500.00"),
            due_date=date(2026, 4, 30),
        )

        payment = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "100.00",
                "payment_method": FeePayment.Method.CASH,
                "installment_id": foreign_installment.id,
            },
            format="json",
        )

        self.assertEqual(payment.status_code, 404)

    def test_existing_payments_prevent_lowering_payable_amount_too_far(self):
        response = self.assign_student_fee()
        student_fee_id = response.data["student_fee"]["id"]
        self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "1000.00",
                "payment_method": FeePayment.Method.CASH,
            },
            format="json",
        )

        patch = self.client.patch(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/",
            {
                "discount_amount": "600.00",
            },
            format="json",
        )

        self.assertEqual(patch.status_code, 400)
        self.assertEqual(FeePayment.objects.count(), 1)
