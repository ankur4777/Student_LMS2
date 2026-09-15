from datetime import date, time

from django.test import TestCase
from rest_framework.test import APIClient

from academics.models import (
    AcademicSession,
    ClassRoom,
    Section,
    Subject,
    TeacherAssignment,
)
from accounts.models import ParentProfile, StudentProfile, TeacherProfile, User
from institutions.models import Organization

from .models import LiveClass


class CollegeAdminLiveClassManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org_a = Organization.objects.create(
            name="DU",
            code="du",
        )
        self.org_b = Organization.objects.create(
            name="Other",
            code="other",
        )
        self.admin_a = User.objects.create_user(
            username="du-admin",
            password="pass",
            role="college_admin",
            organization=self.org_a,
        )
        self.admin_b = User.objects.create_user(
            username="other-admin",
            password="pass",
            role="college_admin",
            organization=self.org_b,
        )
        self.teacher_user_a = User.objects.create_user(
            username="teacher-a",
            password="pass",
            role="teacher",
            organization=self.org_a,
        )
        self.teacher_profile_a = TeacherProfile.objects.create(
            user=self.teacher_user_a,
            employee_id="TA",
        )
        self.teacher_user_b = User.objects.create_user(
            username="teacher-b",
            password="pass",
            role="teacher",
            organization=self.org_b,
        )
        self.teacher_profile_b = TeacherProfile.objects.create(
            user=self.teacher_user_b,
            employee_id="TB",
        )
        self.student_user = User.objects.create_user(
            username="student",
            password="pass",
            role="student",
            organization=self.org_a,
        )
        StudentProfile.objects.create(
            user=self.student_user,
            admission_number="S1",
        )
        self.parent_user = User.objects.create_user(
            username="parent",
            password="pass",
            role="parent",
            organization=self.org_a,
        )
        ParentProfile.objects.create(user=self.parent_user)

        self.assignment_a = self.create_assignment(
            self.org_a,
            self.teacher_profile_a,
            "2026",
            "Class A",
            "A",
            "Math",
        )
        self.assignment_b = self.create_assignment(
            self.org_b,
            self.teacher_profile_b,
            "2026",
            "Class B",
            "B",
            "Science",
        )
        self.live_class_a = LiveClass.objects.create(
            organization=self.org_a,
            teacher_assignment=self.assignment_a,
            title="DU Math",
            class_date=date(2026, 9, 20),
            start_time=time(10, 0),
            end_time=time(11, 0),
            meeting_link="https://example.com/du",
        )
        self.live_class_b = LiveClass.objects.create(
            organization=self.org_b,
            teacher_assignment=self.assignment_b,
            title="Other Science",
            class_date=date(2026, 9, 20),
            start_time=time(12, 0),
            end_time=time(13, 0),
            meeting_link="https://example.com/other",
        )

    def create_assignment(
        self,
        organization,
        teacher_profile,
        session_name,
        class_name,
        section_name,
        subject_name,
    ):
        session = AcademicSession.objects.create(
            organization=organization,
            name=session_name,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
        )
        classroom = ClassRoom.objects.create(
            organization=organization,
            name=class_name,
            academic_session=session,
        )
        section = Section.objects.create(
            organization=organization,
            name=section_name,
            classroom=classroom,
        )
        subject = Subject.objects.create(
            organization=organization,
            name=subject_name,
            code=subject_name[:3].upper(),
            classroom=classroom,
        )
        return TeacherAssignment.objects.create(
            teacher=teacher_profile,
            subject=subject,
            section=section,
            is_active=True,
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_list_is_tenant_scoped(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            "/api/live-classes/college-admin/classes/"
        )

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.data["classes"]]
        self.assertIn("DU Math", titles)
        self.assertNotIn("Other Science", titles)

    def test_create_schedules_live_class_for_admin_organization(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            "/api/live-classes/college-admin/classes/",
            {
                "teacher_assignment": self.assignment_a.id,
                "title": "Scheduled Class",
                "description": "Intro",
                "class_date": "2026-09-21",
                "start_time": "09:00",
                "end_time": "10:00",
                "meeting_link": "https://example.com/class",
                "organization": self.org_b.id,
                "organization_id": self.org_b.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        live_class = LiveClass.objects.get(title="Scheduled Class")
        self.assertEqual(live_class.organization, self.org_a)
        self.assertEqual(live_class.status, LiveClass.Status.SCHEDULED)

    def test_cross_college_teacher_assignment_is_rejected(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            "/api/live-classes/college-admin/classes/",
            {
                "teacher_assignment": self.assignment_b.id,
                "title": "Invalid",
                "class_date": "2026-09-21",
                "start_time": "09:00",
                "end_time": "10:00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 404)

    def test_detail_edit_and_cancel_are_tenant_scoped(self):
        self.authenticate(self.admin_a)
        detail_url = (
            f"/api/live-classes/college-admin/classes/"
            f"{self.live_class_b.id}/"
        )
        cancel_url = (
            f"/api/live-classes/college-admin/classes/"
            f"{self.live_class_b.id}/cancel/"
        )

        detail_response = self.client.get(detail_url)
        edit_response = self.client.patch(
            detail_url,
            {"title": "Changed"},
            format="json",
        )
        cancel_response = self.client.post(cancel_url)

        self.assertEqual(detail_response.status_code, 404)
        self.assertEqual(edit_response.status_code, 404)
        self.assertEqual(cancel_response.status_code, 404)
        self.live_class_b.refresh_from_db()
        self.assertEqual(self.live_class_b.title, "Other Science")
        self.assertEqual(
            self.live_class_b.status,
            LiveClass.Status.SCHEDULED,
        )

    def test_cancel_sets_status_without_deleting_class(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            (
                f"/api/live-classes/college-admin/classes/"
                f"{self.live_class_a.id}/cancel/"
            )
        )

        self.assertEqual(response.status_code, 200)
        self.live_class_a.refresh_from_db()
        self.assertEqual(
            self.live_class_a.status,
            LiveClass.Status.CANCELLED,
        )
        self.assertTrue(
            LiveClass.objects.filter(id=self.live_class_a.id).exists()
        )

    def test_cancelled_and_completed_classes_are_protected(self):
        self.authenticate(self.admin_a)
        self.live_class_a.status = LiveClass.Status.CANCELLED
        self.live_class_a.save(update_fields=["status"])

        edit_cancelled = self.client.patch(
            (
                f"/api/live-classes/college-admin/classes/"
                f"{self.live_class_a.id}/"
            ),
            {"title": "Changed"},
            format="json",
        )

        completed = LiveClass.objects.create(
            organization=self.org_a,
            teacher_assignment=self.assignment_a,
            title="Completed",
            class_date=date(2026, 9, 19),
            start_time=time(9, 0),
            end_time=time(10, 0),
            status=LiveClass.Status.COMPLETED,
        )
        edit_completed_schedule = self.client.patch(
            f"/api/live-classes/college-admin/classes/{completed.id}/",
            {"class_date": "2026-09-22"},
            format="json",
        )
        cancel_completed = self.client.post(
            (
                f"/api/live-classes/college-admin/classes/"
                f"{completed.id}/cancel/"
            )
        )

        self.assertEqual(edit_cancelled.status_code, 400)
        self.assertEqual(edit_completed_schedule.status_code, 400)
        self.assertEqual(cancel_completed.status_code, 400)

    def test_other_roles_and_unauthenticated_requests_are_rejected(self):
        for user in [
            self.teacher_user_a,
            self.student_user,
            self.parent_user,
        ]:
            self.authenticate(user)
            response = self.client.get(
                "/api/live-classes/college-admin/classes/"
            )
            self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=None)
        response = self.client.get(
            "/api/live-classes/college-admin/classes/"
        )
        self.assertIn(response.status_code, [401, 403])

    def test_setup_returns_only_same_organization_assignments(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            "/api/live-classes/college-admin/setup/"
        )

        self.assertEqual(response.status_code, 200)
        assignment_ids = [
            item["assignment_id"]
            for item in response.data["teacher_assignments"]
        ]
        self.assertIn(self.assignment_a.id, assignment_ids)
        self.assertNotIn(self.assignment_b.id, assignment_ids)

    def test_invalid_time_range_is_rejected(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            "/api/live-classes/college-admin/classes/",
            {
                "teacher_assignment": self.assignment_a.id,
                "title": "Bad Time",
                "class_date": "2026-09-21",
                "start_time": "10:00",
                "end_time": "09:00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
