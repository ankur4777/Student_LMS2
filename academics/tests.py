from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import ParentProfile, StudentProfile, User
from institutions.models import Organization

from .models import (
    AcademicSession,
    ClassFeatureAccess,
    ClassRoom,
    ParentStudent,
    Section,
    StudentEnrollment,
    Subject,
    SubjectStudentAccess,
)


class CollegeAdminAcademicsSecurityTests(TestCase):
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
        self.student = User.objects.create_user(
            username="student-a",
            password="pass",
            role="student",
            organization=self.org_a,
        )
        self.teacher = User.objects.create_user(
            username="teacher-a",
            password="pass",
            role="teacher",
            organization=self.org_a,
        )
        self.parent = User.objects.create_user(
            username="parent-a",
            password="pass",
            role="parent",
            organization=self.org_a,
        )
        self.session_a = AcademicSession.objects.create(
            organization=self.org_a,
            name="A 2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
        )
        self.classroom_a = ClassRoom.objects.create(
            organization=self.org_a,
            academic_session=self.session_a,
            name="A Class",
        )
        self.section_a = Section.objects.create(
            organization=self.org_a,
            classroom=self.classroom_a,
            name="A Section",
        )
        self.subject_a = Subject.objects.create(
            organization=self.org_a,
            classroom=self.classroom_a,
            name="A Subject",
            code="AS",
        )
        self.session_b = AcademicSession.objects.create(
            organization=self.org_b,
            name="Foreign 2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
        )
        self.classroom_b = ClassRoom.objects.create(
            organization=self.org_b,
            academic_session=self.session_b,
            name="Foreign Class",
        )
        self.section_b = Section.objects.create(
            organization=self.org_b,
            classroom=self.classroom_b,
            name="Foreign Section",
        )
        self.subject_b = Subject.objects.create(
            organization=self.org_b,
            classroom=self.classroom_b,
            name="Foreign Subject",
            code="FS",
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_non_admin_roles_and_unauthenticated_are_denied(self):
        endpoints = [
            "/api/academics/college-admin/academic-sessions/",
            "/api/academics/college-admin/classes/",
            "/api/academics/college-admin/sections/",
            "/api/academics/college-admin/subjects/",
        ]

        for user in [self.student, self.teacher, self.parent]:
            self.authenticate(user)
            for endpoint in endpoints:
                response = self.client.get(endpoint)
                self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=None)
        for endpoint in endpoints:
            response = self.client.get(endpoint)
            self.assertEqual(response.status_code, 401)

    def test_lists_and_search_do_not_expose_foreign_academic_records(self):
        self.authenticate(self.admin_a)

        checks = [
            (
                "/api/academics/college-admin/academic-sessions/",
                "academic_sessions",
                self.session_a.id,
                self.session_b.id,
            ),
            (
                "/api/academics/college-admin/classes/",
                "classes",
                self.classroom_a.id,
                self.classroom_b.id,
            ),
            (
                "/api/academics/college-admin/sections/",
                "sections",
                self.section_a.id,
                self.section_b.id,
            ),
            (
                "/api/academics/college-admin/subjects/",
                "subjects",
                self.subject_a.id,
                self.subject_b.id,
            ),
        ]

        for endpoint, key, own_id, foreign_id in checks:
            response = self.client.get(endpoint)
            ids = [item["id"] for item in response.data[key]]
            self.assertIn(own_id, ids)
            self.assertNotIn(foreign_id, ids)

            response = self.client.get(endpoint, {"search": "Foreign"})
            ids = [item["id"] for item in response.data[key]]
            self.assertNotIn(foreign_id, ids)

    def test_foreign_detail_ids_cannot_be_read_or_patched(self):
        self.authenticate(self.admin_a)

        checks = [
            (
                f"/api/academics/college-admin/academic-sessions/"
                f"{self.session_b.id}/",
                {
                    "name": "Changed",
                    "start_date": "2026-01-01",
                    "end_date": "2026-12-31",
                },
            ),
            (
                f"/api/academics/college-admin/classes/"
                f"{self.classroom_b.id}/",
                {
                    "name": "Changed",
                    "academic_session_id": self.session_a.id,
                },
            ),
            (
                f"/api/academics/college-admin/sections/"
                f"{self.section_b.id}/",
                {
                    "name": "Changed",
                    "class_id": self.classroom_a.id,
                },
            ),
            (
                f"/api/academics/college-admin/subjects/"
                f"{self.subject_b.id}/",
                {
                    "name": "Changed",
                    "code": "CH",
                    "class_id": self.classroom_a.id,
                },
            ),
        ]

        for endpoint, payload in checks:
            response = self.client.get(endpoint)
            self.assertEqual(response.status_code, 404)

            response = self.client.patch(
                endpoint,
                payload,
                format="json",
            )
            self.assertEqual(response.status_code, 404)

        self.session_b.refresh_from_db()
        self.classroom_b.refresh_from_db()
        self.section_b.refresh_from_db()
        self.subject_b.refresh_from_db()
        self.assertEqual(self.session_b.name, "Foreign 2026")
        self.assertEqual(self.classroom_b.name, "Foreign Class")
        self.assertEqual(self.section_b.name, "Foreign Section")
        self.assertEqual(self.subject_b.name, "Foreign Subject")

    def test_create_payload_cannot_switch_organization(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            "/api/academics/college-admin/academic-sessions/",
            {
                "name": "A 2027",
                "start_date": "2027-01-01",
                "end_date": "2027-12-31",
                "organization": self.org_b.id,
                "organization_id": self.org_b.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        session = AcademicSession.objects.get(name="A 2027")
        self.assertEqual(session.organization, self.org_a)

    def test_foreign_relationship_ids_are_rejected(self):
        self.authenticate(self.admin_a)

        class_response = self.client.post(
            "/api/academics/college-admin/classes/",
            {
                "name": "Invalid Class",
                "academic_session_id": self.session_b.id,
            },
            format="json",
        )
        section_response = self.client.post(
            "/api/academics/college-admin/sections/",
            {
                "name": "Invalid Section",
                "class_id": self.classroom_b.id,
            },
            format="json",
        )
        subject_response = self.client.post(
            "/api/academics/college-admin/subjects/",
            {
                "name": "Invalid Subject",
                "code": "IS",
                "class_id": self.classroom_b.id,
            },
            format="json",
        )

        self.assertEqual(class_response.status_code, 404)
        self.assertEqual(section_response.status_code, 404)
        self.assertEqual(subject_response.status_code, 404)
        self.assertFalse(
            ClassRoom.objects.filter(name="Invalid Class").exists()
        )
        self.assertFalse(
            Section.objects.filter(name="Invalid Section").exists()
        )
        self.assertFalse(
            Subject.objects.filter(name="Invalid Subject").exists()
        )

class ClassFeatureAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org_a = Organization.objects.create(
            name="Feature College A",
            code="feature-college-a",
        )
        self.org_b = Organization.objects.create(
            name="Feature College B",
            code="feature-college-b",
        )
        self.admin_a = User.objects.create_user(
            username="feature-admin-a",
            password="pass",
            role="college_admin",
            organization=self.org_a,
        )
        self.student_user = User.objects.create_user(
            username="feature-student-a",
            password="pass",
            role="student",
            organization=self.org_a,
        )
        self.student_profile = StudentProfile.objects.create(
            user=self.student_user,
            admission_number="FEATURE-A-001",
        )
        self.parent_user = User.objects.create_user(
            username="feature-parent-a",
            password="pass",
            role="parent",
            organization=self.org_a,
        )
        self.parent_profile = ParentProfile.objects.create(
            user=self.parent_user,
        )
        ParentStudent.objects.create(
            parent=self.parent_profile,
            student=self.student_profile,
            relationship=ParentStudent.Relationship.GUARDIAN,
        )
        self.session_a = AcademicSession.objects.create(
            organization=self.org_a,
            name="Feature A 2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
        )
        self.classroom_a = ClassRoom.objects.create(
            organization=self.org_a,
            academic_session=self.session_a,
            name="Class 10",
        )
        self.section_a = Section.objects.create(
            organization=self.org_a,
            classroom=self.classroom_a,
            name="A",
        )
        StudentEnrollment.objects.create(
            student=self.student_profile,
            section=self.section_a,
            roll_number="1",
            is_active=True,
        )
        self.session_b = AcademicSession.objects.create(
            organization=self.org_b,
            name="Feature B 2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
        )
        self.classroom_b = ClassRoom.objects.create(
            organization=self.org_b,
            academic_session=self.session_b,
            name="Foreign Class",
        )

    def test_features_default_to_enabled_for_enrolled_class(self):
        self.client.force_authenticate(user=self.student_user)

        response = self.client.get(
            "/api/academics/student/feature-access/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["class"]["id"], self.classroom_a.id)
        self.assertTrue(response.data["features"]["attendance"])
        self.assertTrue(response.data["features"]["results"])

    def test_college_admin_can_set_student_and_parent_access_independently(self):
        self.client.force_authenticate(user=self.admin_a)

        response = self.client.patch(
            "/api/academics/college-admin/class-feature-access/",
            {
                "class_id": self.classroom_a.id,
                "features": {
                    "attendance": {
                        "student_enabled": False,
                        "parent_enabled": True,
                    },
                    "results": {
                        "student_enabled": True,
                        "parent_enabled": False,
                    },
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        attendance = next(
            item
            for item in response.data["features"]
            if item["key"] == "attendance"
        )
        self.assertFalse(attendance["student_enabled"])
        self.assertTrue(attendance["parent_enabled"])
        self.assertTrue(attendance["parent_supported"])

        results = next(
            item
            for item in response.data["features"]
            if item["key"] == "results"
        )
        self.assertTrue(results["student_enabled"])
        self.assertFalse(results["parent_enabled"])

        self.client.force_authenticate(user=self.student_user)
        student_response = self.client.get(
            "/api/academics/student/feature-access/"
        )
        self.assertEqual(student_response.status_code, 200)
        self.assertFalse(student_response.data["features"]["attendance"])
        self.assertTrue(student_response.data["features"]["results"])

        self.client.force_authenticate(user=self.parent_user)
        parent_response = self.client.get(
            (
                "/api/academics/parent/student/"
                f"{self.student_profile.id}/feature-access/"
            )
        )
        self.assertEqual(parent_response.status_code, 200)
        self.assertTrue(parent_response.data["features"]["attendance"])
        self.assertFalse(parent_response.data["features"]["results"])

    def test_college_admin_cannot_manage_foreign_class(self):
        self.client.force_authenticate(user=self.admin_a)

        response = self.client.patch(
            "/api/academics/college-admin/class-feature-access/",
            {
                "class_id": self.classroom_b.id,
                "features": {"attendance": False},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(
            ClassFeatureAccess.objects.filter(
                organization=self.org_a,
                classroom=self.classroom_b,
            ).exists()
        )

    def test_non_admin_cannot_change_class_feature_access(self):
        self.client.force_authenticate(user=self.student_user)

        response = self.client.patch(
            "/api/academics/college-admin/class-feature-access/",
            {
                "class_id": self.classroom_a.id,
                "features": {"attendance": False},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_restricted_feature_blocks_student_backend_endpoint(self):
        ClassFeatureAccess.objects.create(
            organization=self.org_a,
            classroom=self.classroom_a,
            feature_key=ClassFeatureAccess.Feature.ATTENDANCE,
            is_enabled=False,
        )
        self.client.force_authenticate(user=self.student_user)

        response = self.client.get("/api/attendance/student/")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            str(response.data["detail"]),
            "This feature has been restricted for your class.",
        )

    def test_student_restricted_parent_allowed_for_same_feature(self):
        ClassFeatureAccess.objects.create(
            organization=self.org_a,
            classroom=self.classroom_a,
            feature_key=ClassFeatureAccess.Feature.ATTENDANCE,
            is_enabled=False,
            parent_enabled=True,
        )

        self.client.force_authenticate(user=self.student_user)
        student_response = self.client.get("/api/attendance/student/")
        self.assertEqual(student_response.status_code, 403)

        self.client.force_authenticate(user=self.parent_user)
        parent_response = self.client.get(
            (
                "/api/attendance/parent/student/"
                f"{self.student_profile.id}/"
            )
        )
        self.assertEqual(parent_response.status_code, 200)

    def test_parent_restricted_student_allowed_for_same_feature(self):
        ClassFeatureAccess.objects.create(
            organization=self.org_a,
            classroom=self.classroom_a,
            feature_key=ClassFeatureAccess.Feature.ATTENDANCE,
            is_enabled=True,
            parent_enabled=False,
        )

        self.client.force_authenticate(user=self.student_user)
        student_response = self.client.get("/api/attendance/student/")
        self.assertEqual(student_response.status_code, 200)

        self.client.force_authenticate(user=self.parent_user)
        parent_response = self.client.get(
            (
                "/api/attendance/parent/student/"
                f"{self.student_profile.id}/"
            )
        )
        self.assertEqual(parent_response.status_code, 403)
        self.assertEqual(
            str(parent_response.data["detail"]),
            "This feature has been restricted for parents of this class.",
        )



    def test_documents_and_notifications_support_parent_toggles(self):
        self.client.force_authenticate(user=self.admin_a)

        response = self.client.patch(
            "/api/academics/college-admin/class-feature-access/",
            {
                "class_id": self.classroom_a.id,
                "features": {
                    "documents": {
                        "student_enabled": True,
                        "parent_enabled": False,
                    },
                    "notifications": {
                        "student_enabled": True,
                        "parent_enabled": False,
                    },
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        feature_map = {
            item["key"]: item
            for item in response.data["features"]
        }
        self.assertTrue(feature_map["documents"]["parent_supported"])
        self.assertTrue(feature_map["notifications"]["parent_supported"])
        self.assertFalse(feature_map["documents"]["parent_enabled"])
        self.assertFalse(feature_map["notifications"]["parent_enabled"])

        self.client.force_authenticate(user=self.parent_user)
        parent_response = self.client.get(
            (
                "/api/academics/parent/student/"
                f"{self.student_profile.id}/feature-access/"
            )
        )

        self.assertEqual(parent_response.status_code, 200)
        self.assertFalse(parent_response.data["features"]["documents"])
        self.assertFalse(parent_response.data["features"]["notifications"])


class ClassCreationWithSectionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.organization = Organization.objects.create(
            name="Section Setup College",
            code="SSC",
        )
        self.admin = User.objects.create_user(
            username="section-admin",
            password="pass12345",
            role="college_admin",
            organization=self.organization,
        )
        self.session = AcademicSession.objects.create(
            organization=self.organization,
            name="2026-27",
            start_date=date(2026, 6, 1),
            end_date=date(2027, 5, 31),
            is_active=True,
        )
        self.client.force_authenticate(user=self.admin)

    def test_class_creation_can_create_multiple_sections_together(self):
        response = self.client.post(
            "/api/academics/college-admin/classes/",
            {
                "name": "Class 10",
                "academic_session_id": self.session.id,
                "roll_number_prefix": "TEN",
                "roll_number_digits": 3,
                "roll_number_start": 1,
                "sections": ["A", "B", "C"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        classroom = ClassRoom.objects.get(
            organization=self.organization,
            name="Class 10",
        )
        self.assertEqual(
            list(
                Section.objects.filter(
                    organization=self.organization,
                    classroom=classroom,
                ).order_by("name").values_list("name", flat=True)
            ),
            ["A", "B", "C"],
        )
        self.assertEqual(len(response.data["sections"]), 3)

    def test_repeated_section_name_rejects_entire_class_creation(self):
        response = self.client.post(
            "/api/academics/college-admin/classes/",
            {
                "name": "Class 11",
                "academic_session_id": self.session.id,
                "roll_number_prefix": "ELEVEN",
                "roll_number_digits": 3,
                "roll_number_start": 1,
                "sections": ["A", "a"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            ClassRoom.objects.filter(
                organization=self.organization,
                name="Class 11",
            ).exists()
        )

    def test_class_creation_without_sections_still_supported_by_api(self):
        response = self.client.post(
            "/api/academics/college-admin/classes/",
            {
                "name": "Class 12",
                "academic_session_id": self.session.id,
                "roll_number_prefix": "TWELVE",
                "roll_number_digits": 3,
                "roll_number_start": 1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["sections"], [])


class SectionRemovalTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.organization = Organization.objects.create(
            name="Section Removal College",
            code="REMOVE",
        )
        self.admin = User.objects.create_user(
            username="remove-admin",
            password="pass12345",
            role="college_admin",
            organization=self.organization,
        )
        self.session = AcademicSession.objects.create(
            organization=self.organization,
            name="2026-27",
            start_date=date(2026, 6, 1),
            end_date=date(2027, 5, 31),
            is_active=True,
        )
        self.classroom = ClassRoom.objects.create(
            organization=self.organization,
            academic_session=self.session,
            name="Class 9",
        )
        self.client.force_authenticate(user=self.admin)

    def test_unused_section_can_be_removed(self):
        section = Section.objects.create(
            organization=self.organization,
            classroom=self.classroom,
            name="C",
        )

        response = self.client.delete(
            f"/api/academics/college-admin/sections/{section.id}/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            Section.objects.filter(id=section.id).exists()
        )

    def test_section_with_student_enrollment_cannot_be_removed(self):
        section = Section.objects.create(
            organization=self.organization,
            classroom=self.classroom,
            name="A",
        )
        student_user = User.objects.create_user(
            username="remove-student",
            password="pass12345",
            role="student",
            organization=self.organization,
        )
        student = StudentProfile.objects.create(
            user=student_user,
            admission_number="REMOVE-001",
        )
        StudentEnrollment.objects.create(
            student=student,
            section=section,
            roll_number="REMOVE-001",
            is_active=True,
        )

        response = self.client.delete(
            f"/api/academics/college-admin/sections/{section.id}/"
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("student enrollments", response.data["detail"])
        self.assertTrue(
            Section.objects.filter(id=section.id).exists()
        )

    def test_college_admin_cannot_remove_foreign_section(self):
        other_organization = Organization.objects.create(
            name="Other Section College",
            code="OTHERREMOVE",
        )
        other_session = AcademicSession.objects.create(
            organization=other_organization,
            name="2026-27",
            start_date=date(2026, 6, 1),
            end_date=date(2027, 5, 31),
            is_active=True,
        )
        other_class = ClassRoom.objects.create(
            organization=other_organization,
            academic_session=other_session,
            name="Foreign Class",
        )
        other_section = Section.objects.create(
            organization=other_organization,
            classroom=other_class,
            name="Z",
        )

        response = self.client.delete(
            f"/api/academics/college-admin/sections/{other_section.id}/"
        )

        self.assertEqual(response.status_code, 404)
        self.assertTrue(
            Section.objects.filter(id=other_section.id).exists()
        )


class SubjectStudentAssignmentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.organization = Organization.objects.create(
            name="Subject Access College",
            code="SAC",
        )
        self.other_organization = Organization.objects.create(
            name="Other Subject College",
            code="OSC",
        )
        self.admin = User.objects.create_user(
            username="subject-admin",
            password="pass12345",
            role="college_admin",
            organization=self.organization,
        )
        self.session = AcademicSession.objects.create(
            organization=self.organization,
            name="2026-27",
            start_date=date(2026, 6, 1),
            end_date=date(2027, 5, 31),
            is_active=True,
        )
        self.classroom = ClassRoom.objects.create(
            organization=self.organization,
            academic_session=self.session,
            name="Class 10",
        )
        self.section = Section.objects.create(
            organization=self.organization,
            classroom=self.classroom,
            name="A",
        )
        self.subject = Subject.objects.create(
            organization=self.organization,
            classroom=self.classroom,
            name="Maths",
            code="MATH",
        )

        self.students = []

        for index, first_name in enumerate(
            ["Aarav", "Diya", "Kabir"],
            start=1,
        ):
            user = User.objects.create_user(
                username=f"subjectstudent{index}",
                email=f"subjectstudent{index}@example.com",
                password="pass12345",
                first_name=first_name,
                last_name="Test",
                role="student",
                organization=self.organization,
            )
            profile = StudentProfile.objects.create(
                user=user,
                admission_number=f"SAC-{index:03d}",
            )
            StudentEnrollment.objects.create(
                student=profile,
                section=self.section,
                roll_number=f"SAC-{index:03d}",
                is_active=True,
            )
            self.students.append(profile)

        self.client.force_authenticate(user=self.admin)

    def test_existing_subject_defaults_to_all_students(self):
        response = self.client.get(
            f"/api/academics/college-admin/subjects/{self.subject.id}/students/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["subject"]["student_assignment_mode"],
            "all",
        )
        self.assertEqual(
            response.data["subject"]["eligible_student_count"],
            3,
        )
        self.assertTrue(
            all(
                student["studies_subject"]
                for student in response.data["students"]
            )
        )

    def test_all_mode_can_exclude_selected_exceptions(self):
        response = self.client.patch(
            f"/api/academics/college-admin/subjects/{self.subject.id}/students/",
            {
                "student_assignment_mode": "all",
                "student_profile_ids": [
                    self.students[0].id,
                    self.students[1].id,
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.subject.refresh_from_db()
        self.assertEqual(
            self.subject.student_assignment_mode,
            Subject.StudentAssignmentMode.ALL,
        )
        self.assertTrue(
            SubjectStudentAccess.objects.filter(
                subject=self.subject,
                student=self.students[2],
                is_enrolled=False,
            ).exists()
        )

        response = self.client.get(
            f"/api/academics/college-admin/subjects/{self.subject.id}/students/"
        )
        selected_ids = {
            item["student_profile_id"]
            for item in response.data["students"]
            if item["studies_subject"]
        }
        self.assertEqual(
            selected_ids,
            {
                self.students[0].id,
                self.students[1].id,
            },
        )

    def test_selected_mode_only_includes_checked_students(self):
        response = self.client.patch(
            f"/api/academics/college-admin/subjects/{self.subject.id}/students/",
            {
                "student_assignment_mode": "selected",
                "student_profile_ids": [
                    self.students[1].id,
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.subject.refresh_from_db()
        self.assertEqual(
            self.subject.student_assignment_mode,
            Subject.StudentAssignmentMode.SELECTED,
        )
        self.assertEqual(
            list(
                SubjectStudentAccess.objects.filter(
                    subject=self.subject,
                    is_enrolled=True,
                ).values_list("student_id", flat=True)
            ),
            [self.students[1].id],
        )

    def test_cannot_assign_student_from_another_class_or_college(self):
        foreign_session = AcademicSession.objects.create(
            organization=self.other_organization,
            name="Other 2026",
            start_date=date(2026, 6, 1),
            end_date=date(2027, 5, 31),
            is_active=True,
        )
        foreign_class = ClassRoom.objects.create(
            organization=self.other_organization,
            academic_session=foreign_session,
            name="Foreign Class",
        )
        foreign_section = Section.objects.create(
            organization=self.other_organization,
            classroom=foreign_class,
            name="A",
        )
        foreign_user = User.objects.create_user(
            username="foreign-subject-student",
            email="foreign-subject-student@example.com",
            password="pass12345",
            role="student",
            organization=self.other_organization,
        )
        foreign_student = StudentProfile.objects.create(
            user=foreign_user,
            admission_number="FOREIGN-SUBJECT-1",
        )
        StudentEnrollment.objects.create(
            student=foreign_student,
            section=foreign_section,
            roll_number="F-001",
            is_active=True,
        )

        response = self.client.patch(
            f"/api/academics/college-admin/subjects/{self.subject.id}/students/",
            {
                "student_assignment_mode": "selected",
                "student_profile_ids": [foreign_student.id],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            SubjectStudentAccess.objects.filter(
                subject=self.subject,
                student=foreign_student,
            ).exists()
        )


    def test_moving_subject_to_another_class_resets_student_assignment(self):
        response = self.client.patch(
            f"/api/academics/college-admin/subjects/{self.subject.id}/students/",
            {
                "student_assignment_mode": "selected",
                "student_profile_ids": [self.students[0].id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        other_class = ClassRoom.objects.create(
            organization=self.organization,
            academic_session=self.session,
            name="Class 11",
        )
        Section.objects.create(
            organization=self.organization,
            classroom=other_class,
            name="A",
        )

        response = self.client.patch(
            f"/api/academics/college-admin/subjects/{self.subject.id}/",
            {
                "class_id": other_class.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.subject.refresh_from_db()
        self.assertEqual(
            self.subject.student_assignment_mode,
            Subject.StudentAssignmentMode.ALL,
        )
        self.assertFalse(
            SubjectStudentAccess.objects.filter(
                subject=self.subject,
            ).exists()
        )
