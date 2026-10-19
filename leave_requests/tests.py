"""Regression tests: role, college, parent-child, section, subject, and decision scope."""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from academics.models import (
    AcademicSession, ClassRoom, ParentStudent, Section,
    StudentEnrollment, Subject, SubjectStudentAccess, TeacherAssignment,
)
from accounts.models import ParentProfile, StudentProfile, TeacherProfile, User
from institutions.models import Organization
from liveclasses.models import LiveClass
from notifications.models import Notification

from .models import LeaveRequest


class LeaveRequestFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="Leave College A", code="LEAVE-A")
        self.other_org = Organization.objects.create(name="Leave College B", code="LEAVE-B")
        self.session = AcademicSession.objects.create(
            organization=self.org, name="2026-27",
            start_date="2026-06-01", end_date="2027-05-31", is_active=True,
        )
        self.classroom = ClassRoom.objects.create(
            organization=self.org, academic_session=self.session, name="BTech",
        )
        self.section = Section.objects.create(
            organization=self.org, classroom=self.classroom, name="A",
        )
        self.other_section = Section.objects.create(
            organization=self.org, classroom=self.classroom, name="B",
        )
        self.subject = Subject.objects.create(
            organization=self.org, classroom=self.classroom, name="Science",
        )
        self.admin = User.objects.create_user(
            username="leave-admin", password="pass", role="college_admin", organization=self.org,
        )
        self.other_admin = User.objects.create_user(
            username="other-leave-admin", password="pass",
            role="college_admin", organization=self.other_org,
        )
        self.teacher_user = User.objects.create_user(
            username="leave-teacher", password="pass", role="teacher", organization=self.org,
        )
        self.teacher = TeacherProfile.objects.create(
            user=self.teacher_user, employee_id="LEAVE-T-1",
        )
        self.teacher_assignment = TeacherAssignment.objects.create(
            teacher=self.teacher, section=self.section, subject=self.subject,
        )
        self.other_teacher_user = User.objects.create_user(
            username="leave-other-teacher", password="pass",
            role="teacher", organization=self.org,
        )
        self.other_teacher = TeacherProfile.objects.create(
            user=self.other_teacher_user, employee_id="LEAVE-T-2",
        )
        self.other_assignment = TeacherAssignment.objects.create(
            teacher=self.other_teacher, section=self.other_section, subject=self.subject,
        )
        self.parent_user = User.objects.create_user(
            username="leave-parent", password="pass", role="parent", organization=self.org,
        )
        self.parent = ParentProfile.objects.create(user=self.parent_user)
        self.other_parent_user = User.objects.create_user(
            username="leave-parent-two", password="pass", role="parent", organization=self.org,
        )
        self.other_parent = ParentProfile.objects.create(user=self.other_parent_user)
        self.foreign_parent_user = User.objects.create_user(
            username="leave-parent-foreign", password="pass", role="parent", organization=self.other_org,
        )
        self.foreign_parent = ParentProfile.objects.create(user=self.foreign_parent_user)
        self.student_user = User.objects.create_user(
            username="leave-student", password="pass", role="student", organization=self.org,
            first_name="Ada", last_name="Scholar",
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user, admission_number="LEAVE-S-1",
        )
        StudentEnrollment.objects.create(
            student=self.student, section=self.section, roll_number="1", is_active=True,
        )
        ParentStudent.objects.create(parent=self.parent, student=self.student)
        self.unlinked_user = User.objects.create_user(
            username="leave-unlinked", password="pass", role="student", organization=self.org,
        )
        self.unlinked = StudentProfile.objects.create(
            user=self.unlinked_user, admission_number="LEAVE-S-2",
        )
        StudentEnrollment.objects.create(
            student=self.unlinked, section=self.section, roll_number="2",
        )
        self.next_date = timezone.localdate() + timedelta(days=2)
        self.next_class = LiveClass.objects.create(
            organization=self.org, teacher_assignment=self.teacher_assignment,
            title="Next science class", class_date=self.next_date,
            start_time="10:00:00", end_time="11:00:00",
            status=LiveClass.Status.SCHEDULED,
        )
        self.other_class = LiveClass.objects.create(
            organization=self.org, teacher_assignment=self.other_assignment,
            title="Other section class", class_date=self.next_date,
            start_time="12:00:00", end_time="13:00:00",
            status=LiveClass.Status.SCHEDULED,
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def apply(self, *, student_id=None, class_id=None, reason="Family medical appointment"):
        return self.client.post(
            reverse("parent-leave-requests"),
            {
                "student_id": student_id if student_id is not None else self.student.id,
                "live_class_id": class_id if class_id is not None else self.next_class.id,
                "reason": reason,
            },
            format="json",
        )

    def test_parent_can_list_linked_child_and_upcoming_class_only(self):
        self.authenticate(self.parent_user)
        response = self.client.get(reverse("parent-leave-requests"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual([child["id"] for child in response.data["children"]], [self.student.id])
        self.assertEqual(
            [item["id"] for item in response.data["upcoming_classes"]],
            [self.next_class.id],
        )
        self.assertEqual(response.data["requests"], [])

    def test_parent_submit_notifies_teacher_and_admin_pending(self):
        self.authenticate(self.parent_user)
        response = self.apply()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["request"]["status"], "pending")
        leave = LeaveRequest.objects.get()
        self.assertEqual(leave.parent_id, self.parent.id)
        self.assertEqual(leave.student_id, self.student.id)
        self.assertEqual(leave.organization_id, self.org.id)
        self.assertEqual(
            set(Notification.objects.filter(organization=self.org).values_list("user_id", flat=True)),
            {self.teacher_user.id, self.admin.id},
        )

    def test_parent_cannot_apply_for_unlinked_student_or_wrong_section(self):
        self.authenticate(self.parent_user)
        self.assertEqual(self.apply(student_id=self.unlinked.id).status_code, 404)
        self.assertEqual(self.apply(class_id=self.other_class.id).status_code, 404)
        self.assertEqual(LeaveRequest.objects.count(), 0)

    def test_parent_cannot_apply_for_foreign_org_even_with_guessed_id(self):
        self.authenticate(self.foreign_parent_user)
        self.assertEqual(self.apply().status_code, 404)
        self.assertEqual(LeaveRequest.objects.count(), 0)

    def test_cannot_apply_for_past_cancelled_or_unassigned_subject(self):
        self.authenticate(self.parent_user)
        old = LiveClass.objects.create(
            organization=self.org, teacher_assignment=self.teacher_assignment,
            title="Old class", class_date=timezone.localdate() - timedelta(days=1),
            start_time="10:00:00", end_time="11:00:00",
            status=LiveClass.Status.SCHEDULED,
        )
        self.assertEqual(self.apply(class_id=old.id).status_code, 404)
        self.next_class.status = LiveClass.Status.CANCELLED
        self.next_class.save(update_fields=["status"])
        self.assertEqual(self.apply().status_code, 404)
        self.next_class.status = LiveClass.Status.SCHEDULED
        self.next_class.save(update_fields=["status"])
        SubjectStudentAccess.objects.create(
            student=self.student, subject=self.subject, is_enrolled=False,
        )
        self.assertEqual(self.apply().status_code, 404)

    def test_reason_validation_duplicate_and_second_parent_cannot_duplicate(self):
        self.authenticate(self.parent_user)
        self.assertEqual(self.apply(reason="x").status_code, 400)
        self.assertEqual(self.apply(reason="z" * 1001).status_code, 400)
        self.assertEqual(self.apply().status_code, 201)
        self.assertEqual(self.apply().status_code, 409)
        ParentStudent.objects.create(parent=self.other_parent, student=self.student)
        self.authenticate(self.other_parent_user)
        self.assertEqual(self.apply().status_code, 409)
        self.assertEqual(LeaveRequest.objects.count(), 1)

    def test_teacher_can_view_assigned_class_but_cannot_approve(self):
        self.authenticate(self.parent_user)
        self.apply()
        self.authenticate(self.teacher_user)
        found = self.client.get(reverse("teacher-leave-requests"))
        self.assertEqual(found.status_code, 200)
        self.assertEqual(len(found.data["requests"]), 1)
        leave = LeaveRequest.objects.get()
        self.assertEqual(
            self.client.patch(
                reverse("admin-leave-review", kwargs={"request_id": leave.id}),
                {"action": "approved"},
                format="json",
            ).status_code,
            403,
        )
        self.authenticate(self.other_teacher_user)
        response = self.client.get(reverse("teacher-leave-requests"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["requests"], [])

    def test_admin_review_notifies_parent_teacher_and_is_one_time(self):
        self.authenticate(self.parent_user)
        self.apply()
        leave = LeaveRequest.objects.get()
        self.authenticate(self.admin)
        list_response = self.client.get(reverse("admin-leave-requests"))
        self.assertEqual(len(list_response.data["requests"]), 1)
        response = self.client.patch(
            reverse("admin-leave-review", kwargs={"request_id": leave.id}),
            {"action": "approved", "admin_note": "Leave authorized."},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["request"]["status"], "approved")
        leave.refresh_from_db()
        self.assertEqual(leave.reviewed_by_id, self.admin.id)
        self.assertIsNotNone(leave.reviewed_at)
        self.assertEqual(leave.admin_note, "Leave authorized.")
        self.assertTrue(Notification.objects.filter(user=self.parent_user, title="Leave Request Approved").exists())
        self.assertTrue(Notification.objects.filter(user=self.teacher_user, title="Student Leave Approved").exists())
        self.assertEqual(
            self.client.patch(
                reverse("admin-leave-review", kwargs={"request_id": leave.id}),
                {"action": "rejected"},
                format="json",
            ).status_code,
            409,
        )
        self.authenticate(self.parent_user)
        visible = self.client.get(reverse("parent-leave-requests"))
        self.assertEqual(visible.data["requests"][0]["status"], "approved")

    def test_admin_can_reject_and_foreign_admin_cannot_review(self):
        self.authenticate(self.parent_user)
        self.apply()
        leave = LeaveRequest.objects.get()
        url = reverse("admin-leave-review", kwargs={"request_id": leave.id})
        self.authenticate(self.other_admin)
        self.assertEqual(self.client.get(reverse("admin-leave-requests")).data["requests"], [])
        self.assertEqual(self.client.patch(url, {"action": "approved"}, format="json").status_code, 404)
        self.authenticate(self.admin)
        self.assertEqual(
            self.client.patch(url, {"action": "invalid"}, format="json").status_code,
            400,
        )
        self.assertEqual(
            self.client.patch(url, {"action": "rejected", "admin_note": "No."}, format="json").status_code,
            200,
        )
        leave.refresh_from_db()
        self.assertEqual(leave.status, "rejected")

    def test_parent_history_restricted_if_link_removed(self):
        self.authenticate(self.parent_user)
        self.apply()
        ParentStudent.objects.filter(parent=self.parent, student=self.student).delete()
        response = self.client.get(reverse("parent-leave-requests"))
        self.assertEqual(response.data["requests"], [])
        self.assertEqual(response.data["children"], [])
        self.assertEqual(self.apply().status_code, 404)

    def test_disabled_assignment_hides_request_from_teacher(self):
        self.authenticate(self.parent_user)
        self.apply()
        self.teacher_assignment.is_active = False
        self.teacher_assignment.save(update_fields=["is_active"])
        self.authenticate(self.teacher_user)
        self.assertEqual(self.client.get(reverse("teacher-leave-requests")).data["requests"], [])

    def test_unauthenticated_and_other_roles_denied(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(reverse("parent-leave-requests")).status_code, 401)
        self.assertEqual(self.client.get(reverse("admin-leave-requests")).status_code, 401)
        self.authenticate(self.student_user)
        self.assertEqual(self.client.get(reverse("parent-leave-requests")).status_code, 403)
        self.assertEqual(self.client.get(reverse("teacher-leave-requests")).status_code, 403)
        self.assertEqual(self.client.get(reverse("admin-leave-requests")).status_code, 403)
