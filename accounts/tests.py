from datetime import date, time

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from academics.models import (
    AcademicSession,
    ClassRoom,
    ParentStudent,
    Section,
    StudentEnrollment,
    Subject,
    TeacherAssignment,
)
from assignments.models import Assignment, AssignmentSubmission
from attendance.models import AttendanceSession, StudentAttendance
from documents.models import Document
from institutions.models import Organization
from liveclasses.models import LiveClass, LiveClassRecording
from notifications.models import Notification
from studentresults.models import Exam, StudentResult

from .models import ParentProfile, StudentProfile, TeacherProfile, User


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


class CollegeAdminDashboardAnalyticsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(
            name="DU",
            code="du",
        )
        self.other_org = Organization.objects.create(
            name="Other",
            code="other",
        )
        self.admin = User.objects.create_user(
            username="admin-du",
            password="pass",
            role="college_admin",
            organization=self.org,
        )
        self.empty_admin = User.objects.create_user(
            username="empty-admin",
            password="pass",
            role="college_admin",
            organization=Organization.objects.create(
                name="Empty",
                code="empty",
            ),
        )
        self.student_user = User.objects.create_user(
            username="student-du",
            password="pass",
            role="student",
            organization=self.org,
        )
        self.teacher_user = User.objects.create_user(
            username="teacher-du",
            password="pass",
            role="teacher",
            organization=self.org,
        )
        self.parent_user = User.objects.create_user(
            username="parent-du",
            password="pass",
            role="parent",
            organization=self.org,
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user,
            admission_number="DU-S1",
        )
        self.teacher = TeacherProfile.objects.create(
            user=self.teacher_user,
            employee_id="DU-T1",
        )
        ParentProfile.objects.create(user=self.parent_user)

        self.session = AcademicSession.objects.create(
            organization=self.org,
            name="2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
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
        self.subject = Subject.objects.create(
            organization=self.org,
            name="Math",
            classroom=self.classroom,
        )
        self.teacher_assignment = TeacherAssignment.objects.create(
            teacher=self.teacher,
            subject=self.subject,
            section=self.section,
        )
        StudentEnrollment.objects.create(
            student=self.student,
            section=self.section,
            roll_number="1",
        )

        self.attendance_session = AttendanceSession.objects.create(
            organization=self.org,
            section=self.section,
            subject=self.subject,
            teacher=self.teacher,
            date=date(2026, 9, 18),
        )
        StudentAttendance.objects.create(
            attendance_session=self.attendance_session,
            student=self.student,
            status=StudentAttendance.Status.PRESENT,
        )

        self.assignment = Assignment.objects.create(
            organization=self.org,
            teacher_assignment=self.teacher_assignment,
            title="Algebra",
            due_date=date(2026, 9, 30),
            is_published=True,
        )
        self.submission = AssignmentSubmission.objects.create(
            assignment=self.assignment,
            student=self.student,
            submission_text="Done",
            status=AssignmentSubmission.Status.GRADED,
            marks_obtained=8,
        )

        self.exam = Exam.objects.create(
            organization=self.org,
            section=self.section,
            name="Midterm",
            exam_date=date(2026, 9, 10),
            is_published=True,
        )
        StudentResult.objects.create(
            exam=self.exam,
            student=self.student,
            subject=self.subject,
            teacher=self.teacher,
            marks_obtained=80,
            maximum_marks=100,
        )

        self.live_class = LiveClass.objects.create(
            organization=self.org,
            teacher_assignment=self.teacher_assignment,
            title="Today Class",
            class_date=date(2026, 9, 18),
            start_time=time(10, 0),
            end_time=time(11, 0),
            status=LiveClass.Status.COMPLETED,
        )
        LiveClassRecording.objects.create(
            live_class=self.live_class,
            uploaded_by=self.teacher,
            video=SimpleUploadedFile(
                "class.mp4",
                b"video",
                content_type="video/mp4",
            ),
        )
        Document.objects.create(
            organization=self.org,
            uploaded_by=self.teacher_user,
            teacher_assignment=self.teacher_assignment,
            title="Notes",
            file=SimpleUploadedFile(
                "notes.txt",
                b"notes",
                content_type="text/plain",
            ),
            is_published=True,
        )
        Notification.objects.create(
            organization=self.org,
            user=self.admin,
            title="Document Published",
            message="Notes published",
            related_url="/college-admin/documents/1",
        )

        self.other_student_user = User.objects.create_user(
            username="student-other",
            password="pass",
            role="student",
            organization=self.other_org,
        )
        self.other_teacher_user = User.objects.create_user(
            username="teacher-other",
            password="pass",
            role="teacher",
            organization=self.other_org,
        )
        other_student = StudentProfile.objects.create(
            user=self.other_student_user,
            admission_number="O-S1",
        )
        other_teacher = TeacherProfile.objects.create(
            user=self.other_teacher_user,
            employee_id="O-T1",
        )
        other_session = AcademicSession.objects.create(
            organization=self.other_org,
            name="2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )
        other_classroom = ClassRoom.objects.create(
            organization=self.other_org,
            name="Other Class",
            academic_session=other_session,
        )
        other_section = Section.objects.create(
            organization=self.other_org,
            name="B",
            classroom=other_classroom,
        )
        other_subject = Subject.objects.create(
            organization=self.other_org,
            name="Science",
            classroom=other_classroom,
        )
        other_assignment = TeacherAssignment.objects.create(
            teacher=other_teacher,
            subject=other_subject,
            section=other_section,
        )
        StudentEnrollment.objects.create(
            student=other_student,
            section=other_section,
        )
        Assignment.objects.create(
            organization=self.other_org,
            teacher_assignment=other_assignment,
            title="Foreign Assignment",
            due_date=date(2026, 9, 30),
        )
        Notification.objects.create(
            organization=self.other_org,
            user=self.other_teacher_user,
            title="Foreign Activity",
            message="Foreign",
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def dashboard(self):
        return self.client.get("/api/accounts/college-admin/dashboard/")

    def test_own_organization_statistics(self):
        self.authenticate(self.admin)

        response = self.dashboard()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["total_students"], 1)
        self.assertEqual(response.data["summary"]["total_teachers"], 1)
        self.assertEqual(response.data["summary"]["total_parents"], 1)
        self.assertEqual(response.data["summary"]["classrooms"], 1)
        self.assertEqual(response.data["summary"]["sections"], 1)
        self.assertEqual(response.data["summary"]["subjects"], 1)
        self.assertEqual(response.data["summary"]["assignments"], 1)
        self.assertEqual(response.data["summary"]["exams"], 1)
        self.assertEqual(response.data["summary"]["documents"], 1)

    def test_foreign_organization_records_excluded(self):
        self.authenticate(self.admin)

        response = self.dashboard()

        self.assertEqual(response.data["summary"]["total_students"], 1)
        self.assertEqual(response.data["assignments"]["total"], 1)
        titles = [
            item["title"]
            for item in response.data["recent_activity"]
        ]
        self.assertNotIn("Foreign Activity", titles)

    def test_duplicate_recipient_notifications_collapse_into_one_activity(self):
        created_at = timezone.now()
        notifications = [
            Notification.objects.create(
                organization=self.org,
                user=self.admin,
                title="Document Published",
                message='"Shared Notes" was published by Teacher.',
                related_url="/college-admin/documents/25",
            ),
            Notification.objects.create(
                organization=self.org,
                user=self.student_user,
                title="New Document",
                message='A new document "Shared Notes" has been published.',
                related_url="/student/documents",
            ),
            Notification.objects.create(
                organization=self.org,
                user=self.parent_user,
                title="New Document",
                message='A new document "Shared Notes" has been published.',
            ),
        ]
        Notification.objects.filter(
            id__in=[notification.id for notification in notifications]
        ).update(created_at=created_at)
        self.authenticate(self.admin)

        response = self.dashboard()

        matches = [
            item for item in response.data["recent_activity"]
            if "Shared Notes" in item["description"]
        ]
        self.assertEqual(len(matches), 1)
        self.assertEqual(
            matches[0]["related_url"],
            "/college-admin/documents/25",
        )

    def test_separate_events_with_same_title_are_not_merged(self):
        Notification.objects.create(
            organization=self.org,
            user=self.admin,
            title="Document Published",
            message='"Notes One" was published.',
            related_url="/college-admin/documents/31",
        )
        Notification.objects.create(
            organization=self.org,
            user=self.admin,
            title="Document Published",
            message='"Notes Two" was published.',
            related_url="/college-admin/documents/32",
        )
        self.authenticate(self.admin)

        response = self.dashboard()

        urls = [
            item["related_url"]
            for item in response.data["recent_activity"]
        ]
        self.assertIn("/college-admin/documents/31", urls)
        self.assertIn("/college-admin/documents/32", urls)

    def test_recent_activity_is_newest_first_and_limited_to_ten(self):
        old_notification = Notification.objects.create(
            organization=self.org,
            user=self.admin,
            title="Old Activity",
            message='"Old" was published.',
            related_url="/college-admin/documents/40",
        )
        new_notification = Notification.objects.create(
            organization=self.org,
            user=self.admin,
            title="Newest Activity",
            message='"Newest" was published.',
            related_url="/college-admin/documents/41",
        )
        Notification.objects.filter(id=old_notification.id).update(
            created_at=timezone.now() - timezone.timedelta(days=1)
        )
        Notification.objects.filter(id=new_notification.id).update(
            created_at=timezone.now() + timezone.timedelta(minutes=1)
        )
        for index in range(12):
            Notification.objects.create(
                organization=self.org,
                user=self.admin,
                title=f"Bulk Activity {index}",
                message=f'"Bulk {index}" was published.',
                related_url=f"/college-admin/documents/{100 + index}",
            )
        self.authenticate(self.admin)

        response = self.dashboard()

        self.assertEqual(len(response.data["recent_activity"]), 10)
        self.assertEqual(
            response.data["recent_activity"][0]["title"],
            "Newest Activity",
        )

    def test_recent_activity_exposes_only_college_admin_urls(self):
        Notification.objects.create(
            organization=self.org,
            user=self.student_user,
            title="Student Only",
            message='"Private Student Event"',
            related_url="/student/results",
        )
        self.authenticate(self.admin)

        response = self.dashboard()

        urls = [
            item["related_url"]
            for item in response.data["recent_activity"]
        ]
        self.assertNotIn("/student/results", urls)

    def test_parent_oriented_result_text_is_normalized_for_dashboard(self):
        notification = Notification.objects.create(
            organization=self.org,
            user=self.parent_user,
            title="Result Published",
            message='Your child\'s result for "Mid term exam" has been published.',
            notification_type=Notification.Type.RESULT,
            related_url="/parent/results",
        )
        self.authenticate(self.admin)

        response = self.dashboard()

        descriptions = [
            item["description"]
            for item in response.data["recent_activity"]
        ]
        self.assertIn(
            'Result "Mid term exam" was published.',
            descriptions,
        )
        self.assertNotIn(notification.message, descriptions)
        notification.refresh_from_db()
        self.assertEqual(
            notification.message,
            'Your child\'s result for "Mid term exam" has been published.',
        )

    def test_assignment_and_document_text_is_normalized_for_dashboard(self):
        assignment_notification = Notification.objects.create(
            organization=self.org,
            user=self.parent_user,
            title="New Assignment",
            message=(
                'A new assignment "Digital marketing assignment" has been '
                "published for your child."
            ),
            notification_type=Notification.Type.ASSIGNMENT,
            related_url="/parent/assignments",
        )
        document_notification = Notification.objects.create(
            organization=self.org,
            user=self.student_user,
            title="New Document",
            message='A new document "notes2" has been published for Meta Ads.',
            notification_type=Notification.Type.GENERAL,
            related_url="/student/documents",
        )
        self.authenticate(self.admin)

        response = self.dashboard()

        descriptions = [
            item["description"]
            for item in response.data["recent_activity"]
        ]
        self.assertIn(
            'Assignment "Digital marketing assignment" was published.',
            descriptions,
        )
        self.assertIn(
            'Document "notes2" was published for Meta Ads.',
            descriptions,
        )
        self.assertNotIn(assignment_notification.message, descriptions)
        self.assertNotIn(document_notification.message, descriptions)
        assignment_notification.refresh_from_db()
        document_notification.refresh_from_db()
        self.assertEqual(
            assignment_notification.message,
            (
                'A new assignment "Digital marketing assignment" has been '
                "published for your child."
            ),
        )
        self.assertEqual(
            document_notification.message,
            'A new document "notes2" has been published for Meta Ads.',
        )

    def test_attendance_calculations(self):
        self.authenticate(self.admin)

        response = self.dashboard()

        self.assertEqual(response.data["attendance"]["session_count"], 1)
        self.assertEqual(response.data["attendance"]["present"], 1)
        self.assertEqual(
            response.data["attendance"]["attendance_percentage"],
            100,
        )

    def test_assignment_result_and_live_class_calculations(self):
        self.authenticate(self.admin)

        response = self.dashboard()

        self.assertEqual(response.data["assignments"]["submitted"], 1)
        self.assertEqual(response.data["assignments"]["graded"], 1)
        self.assertEqual(response.data["assignments"]["pending"], 0)
        self.assertEqual(response.data["results"]["published_exams"], 1)
        self.assertEqual(response.data["results"]["results_entered"], 1)
        self.assertEqual(response.data["live_classes"]["today"], 1)
        self.assertEqual(response.data["live_classes"]["completed"], 1)
        self.assertEqual(response.data["live_classes"]["recorded"], 1)

    def test_roles_and_unauthenticated_denied(self):
        for user in [
            self.student_user,
            self.teacher_user,
            self.parent_user,
        ]:
            self.authenticate(user)
            self.assertEqual(self.dashboard().status_code, 403)

        self.client.force_authenticate(user=None)
        self.assertEqual(self.dashboard().status_code, 401)

    def test_empty_organization_works(self):
        self.authenticate(self.empty_admin)

        response = self.dashboard()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["total_students"], 0)
        self.assertEqual(
            response.data["attendance"]["attendance_percentage"],
            0,
        )
        self.assertEqual(response.data["assignments"]["pending"], 0)
