from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from academics.models import (
    AcademicSession,
    ClassRoom,
    ParentStudent,
    Section,
    StudentEnrollment,
    Subject,
    TeacherAssignment,
)
from accounts.models import ParentProfile, StudentProfile, TeacherProfile
from assignments.models import Assignment
from institutions.models import Organization
from liveclasses.models import LiveClass
from studentresults.models import Exam
from notifications.models import Notification
from notifications.services import (
    create_notification,
    notify_assignment_published,
    notify_exam_created,
    notify_live_class_scheduled,
)


User = get_user_model()


class NotificationSecurityTests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Org One", code="ORG1")
        self.other_org = Organization.objects.create(
            name="Org Two",
            code="ORG2",
        )
        self.student = User.objects.create_user(
            username="student",
            password="pass",
            role="student",
            organization=self.org,
        )
        self.other_student = User.objects.create_user(
            username="otherstudent",
            password="pass",
            role="student",
            organization=self.org,
        )
        self.foreign_student = User.objects.create_user(
            username="foreignstudent",
            password="pass",
            role="student",
            organization=self.other_org,
        )
        self.own_notification = Notification.objects.create(
            organization=self.org,
            user=self.student,
            title="Own",
            message="Own notification",
            notification_type=Notification.Type.GENERAL,
            related_url="/student/dashboard",
        )
        self.other_user_notification = Notification.objects.create(
            organization=self.org,
            user=self.other_student,
            title="Other",
            message="Other user notification",
            notification_type=Notification.Type.GENERAL,
        )
        self.foreign_notification = Notification.objects.create(
            organization=self.other_org,
            user=self.foreign_student,
            title="Foreign",
            message="Foreign notification",
            notification_type=Notification.Type.GENERAL,
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.student)

    def test_user_lists_only_own_notifications(self):
        self.authenticate()

        response = self.client.get(reverse("notification-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data["notifications"]]
        self.assertIn(self.own_notification.id, ids)
        self.assertNotIn(self.other_user_notification.id, ids)
        self.assertNotIn(self.foreign_notification.id, ids)

    def test_unread_count_is_scoped_to_user(self):
        self.authenticate()

        response = self.client.get(reverse("notification-unread-count"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["unread_count"], 1)

    def test_mark_read_own_notification(self):
        self.authenticate()

        response = self.client.patch(
            reverse(
                "notification-mark-read",
                kwargs={"notification_id": self.own_notification.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.own_notification.refresh_from_db()
        self.assertTrue(self.own_notification.is_read)

    def test_cannot_mark_other_users_notification_read(self):
        self.authenticate()

        response = self.client.patch(
            reverse(
                "notification-mark-read",
                kwargs={
                    "notification_id": self.other_user_notification.id
                },
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.other_user_notification.refresh_from_db()
        self.assertFalse(self.other_user_notification.is_read)

    def test_cannot_mark_foreign_organization_notification_read(self):
        self.authenticate()

        response = self.client.patch(
            reverse(
                "notification-mark-read",
                kwargs={"notification_id": self.foreign_notification.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.foreign_notification.refresh_from_db()
        self.assertFalse(self.foreign_notification.is_read)

    def test_showing_notifications_does_not_mark_read(self):
        self.authenticate()

        self.client.get(reverse("notification-list"))

        self.own_notification.refresh_from_db()
        self.assertFalse(self.own_notification.is_read)

    def test_read_all_is_scoped_to_user(self):
        self.authenticate()

        response = self.client.patch(reverse("notification-mark-all-read"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.own_notification.refresh_from_db()
        self.other_user_notification.refresh_from_db()
        self.foreign_notification.refresh_from_db()
        self.assertTrue(self.own_notification.is_read)
        self.assertFalse(self.other_user_notification.is_read)
        self.assertFalse(self.foreign_notification.is_read)

    def test_unauthenticated_denied(self):
        response = self.client.get(reverse("notification-list"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="lms@example.com",
    LMS_FRONTEND_URL="https://lms.example.com",
)
class NotificationEmailTests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Email Notifications College",
            code="EMAILNOTIFY",
        )
        self.session = AcademicSession.objects.create(
            organization=self.org,
            name="2026-27",
            start_date="2026-06-01",
            end_date="2027-05-31",
            is_active=True,
        )
        self.classroom = ClassRoom.objects.create(
            organization=self.org,
            academic_session=self.session,
            name="Class 10",
        )
        self.section = Section.objects.create(
            organization=self.org,
            classroom=self.classroom,
            name="A",
        )
        self.subject = Subject.objects.create(
            organization=self.org,
            classroom=self.classroom,
            name="Science",
            code="SCI",
        )

        self.teacher_user = User.objects.create_user(
            username="teachern01",
            email="teacher@example.com",
            password="pass12345",
            role="teacher",
            organization=self.org,
        )
        self.teacher = TeacherProfile.objects.create(
            user=self.teacher_user,
            employee_id="EMAIL-T-1",
        )
        self.teacher_assignment = TeacherAssignment.objects.create(
            teacher=self.teacher,
            subject=self.subject,
            section=self.section,
            is_active=True,
        )

        self.student_user = User.objects.create_user(
            username="studentn01",
            email="student@example.com",
            password="pass12345",
            role="student",
            organization=self.org,
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user,
            admission_number="EMAIL-S-1",
        )
        StudentEnrollment.objects.create(
            student=self.student,
            section=self.section,
            roll_number="EMAIL-0001",
            is_active=True,
        )

        self.parent_user = User.objects.create_user(
            username="parentn01",
            email="parent@example.com",
            password="pass12345",
            role="parent",
            organization=self.org,
        )
        self.parent = ParentProfile.objects.create(
            user=self.parent_user,
        )
        ParentStudent.objects.create(
            parent=self.parent,
            student=self.student,
            relationship=ParentStudent.Relationship.FATHER,
        )

    def test_new_notification_sends_email_with_lms_link(self):
        with self.captureOnCommitCallbacks(execute=True):
            create_notification(
                organization=self.org,
                user=self.student_user,
                title="Test Notification",
                message="A test message.",
                notification_type=Notification.Type.GENERAL,
                related_url="/student/dashboard",
            )

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(
            mail.outbox[0].to,
            ["student@example.com"],
        )
        self.assertIn("Student LMS - Test Notification", mail.outbox[0].subject)
        self.assertIn(
            "https://lms.example.com/student/dashboard",
            mail.outbox[0].body,
        )

    def test_assignment_publish_emails_student_and_parent(self):
        assignment = Assignment.objects.create(
            organization=self.org,
            teacher_assignment=self.teacher_assignment,
            title="Chapter 1 Homework",
            due_date="2026-10-10",
            is_published=True,
        )

        with self.captureOnCommitCallbacks(execute=True):
            notify_assignment_published(assignment)

        recipients = sorted(message.to[0] for message in mail.outbox)
        self.assertEqual(
            recipients,
            ["parent@example.com", "student@example.com"],
        )

    def test_exam_creation_emails_student_and_parent(self):
        exam = Exam.objects.create(
            organization=self.org,
            section=self.section,
            name="Unit Test",
            exam_date="2026-10-15",
        )

        with self.captureOnCommitCallbacks(execute=True):
            notify_exam_created(exam, self.teacher_assignment)

        recipients = sorted(message.to[0] for message in mail.outbox)
        self.assertEqual(
            recipients,
            ["parent@example.com", "student@example.com"],
        )
        self.assertTrue(
            all("New Exam Scheduled" in message.subject for message in mail.outbox)
        )

    def test_live_class_creation_emails_student_and_parent(self):
        live_class = LiveClass.objects.create(
            organization=self.org,
            teacher_assignment=self.teacher_assignment,
            title="Science Live Class",
            class_date="2026-10-20",
            start_time="10:00:00",
            end_time="11:00:00",
            status=LiveClass.Status.SCHEDULED,
        )

        with self.captureOnCommitCallbacks(execute=True):
            notify_live_class_scheduled(live_class)

        recipients = sorted(message.to[0] for message in mail.outbox)
        self.assertEqual(
            recipients,
            ["parent@example.com", "student@example.com"],
        )
        self.assertTrue(
            all("Live Class Scheduled" in message.subject for message in mail.outbox)
        )
