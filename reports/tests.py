from datetime import date, time
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from academics.models import (
    AcademicSession,
    ClassRoom,
    Section,
    StudentEnrollment,
    Subject,
    TeacherAssignment,
)
from accounts.models import ParentProfile, StudentProfile, TeacherProfile, User
from assignments.models import Assignment, AssignmentSubmission
from attendance.models import AttendanceSession, StudentAttendance
from fees.models import FeePayment, FeeStructure, StudentFee
from institutions.models import Organization
from liveclasses.models import LiveClass
from studentresults.models import Exam, StudentResult


class CollegeAdminOverviewReportAPITests(TestCase):
    endpoint = "/api/reports/college-admin/overview/"

    def setUp(self):
        self.client = APIClient()
        self.org_a = Organization.objects.create(name="College A", code="A")
        self.org_b = Organization.objects.create(name="College B", code="B")

        self.admin_a = self.make_user("admin-a", "college_admin", self.org_a)
        self.admin_b = self.make_user("admin-b", "college_admin", self.org_b)
        self.teacher_user = self.make_user("teacher-a", "teacher", self.org_a)
        self.student_user = self.make_user("student-a", "student", self.org_a)
        self.parent_user = self.make_user("parent-a", "parent", self.org_a)

        self.teacher = TeacherProfile.objects.create(
            user=self.teacher_user,
            employee_id="T-A",
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user,
            admission_number="S-A",
        )
        ParentProfile.objects.create(user=self.parent_user)

        self.session = AcademicSession.objects.create(
            organization=self.org_a,
            name="2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
        )
        self.classroom = ClassRoom.objects.create(
            organization=self.org_a,
            name="Class 10",
            academic_session=self.session,
        )
        self.section = Section.objects.create(
            organization=self.org_a,
            name="A",
            classroom=self.classroom,
        )
        self.subject = Subject.objects.create(
            organization=self.org_a,
            name="Math",
            code="MTH",
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
            is_active=True,
        )

    def make_user(self, username, role, organization):
        return User.objects.create_user(
            username=username,
            password="pass",
            role=role,
            organization=organization,
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def add_other_org_data(self):
        teacher_user = self.make_user("teacher-b", "teacher", self.org_b)
        student_user = self.make_user("student-b", "student", self.org_b)
        teacher = TeacherProfile.objects.create(
            user=teacher_user,
            employee_id="T-B",
        )
        student = StudentProfile.objects.create(
            user=student_user,
            admission_number="S-B",
        )
        session = AcademicSession.objects.create(
            organization=self.org_b,
            name="2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
        )
        classroom = ClassRoom.objects.create(
            organization=self.org_b,
            name="Class 11",
            academic_session=session,
        )
        section = Section.objects.create(
            organization=self.org_b,
            name="B",
            classroom=classroom,
        )
        subject = Subject.objects.create(
            organization=self.org_b,
            name="Science",
            classroom=classroom,
        )
        teacher_assignment = TeacherAssignment.objects.create(
            teacher=teacher,
            subject=subject,
            section=section,
        )
        StudentEnrollment.objects.create(student=student, section=section)
        attendance_session = AttendanceSession.objects.create(
            organization=self.org_b,
            section=section,
            subject=subject,
            teacher=teacher,
            date=date(2026, 9, 20),
        )
        StudentAttendance.objects.create(
            attendance_session=attendance_session,
            student=student,
            status=StudentAttendance.Status.ABSENT,
        )
        Assignment.objects.create(
            organization=self.org_b,
            teacher_assignment=teacher_assignment,
            title="Foreign Assignment",
            due_date=date(2026, 9, 30),
        )
        LiveClass.objects.create(
            organization=self.org_b,
            teacher_assignment=teacher_assignment,
            title="Foreign Live",
            class_date=date(2026, 9, 21),
            start_time=time(10, 0),
            end_time=time(11, 0),
            status=LiveClass.Status.COMPLETED,
        )

    def add_org_a_metrics(self):
        attendance_session = AttendanceSession.objects.create(
            organization=self.org_a,
            section=self.section,
            subject=self.subject,
            teacher=self.teacher,
            date=date(2026, 9, 20),
        )
        statuses = [
            StudentAttendance.Status.PRESENT,
            StudentAttendance.Status.LATE,
            StudentAttendance.Status.ABSENT,
            StudentAttendance.Status.EXCUSED,
        ]
        for index, status in enumerate(statuses, start=2):
            user = self.make_user(f"student-a-{index}", "student", self.org_a)
            student = StudentProfile.objects.create(
                user=user,
                admission_number=f"S-A-{index}",
            )
            StudentEnrollment.objects.create(student=student, section=self.section)
            StudentAttendance.objects.create(
                attendance_session=attendance_session,
                student=student,
                status=status,
            )

        assignment = Assignment.objects.create(
            organization=self.org_a,
            teacher_assignment=self.teacher_assignment,
            title="Homework",
            due_date=date(2026, 9, 30),
        )
        AssignmentSubmission.objects.create(
            assignment=assignment,
            student=self.student,
            status=AssignmentSubmission.Status.SUBMITTED,
        )
        LiveClass.objects.create(
            organization=self.org_a,
            teacher_assignment=self.teacher_assignment,
            title="Scheduled",
            class_date=date(2026, 9, 21),
            start_time=time(10, 0),
            end_time=time(11, 0),
        )
        LiveClass.objects.create(
            organization=self.org_a,
            teacher_assignment=self.teacher_assignment,
            title="Completed",
            class_date=date(2026, 9, 22),
            start_time=time(10, 0),
            end_time=time(11, 0),
            status=LiveClass.Status.COMPLETED,
        )
        structure = FeeStructure.objects.create(
            organization=self.org_a,
            academic_session=self.session,
            class_room=self.classroom,
            name="Annual",
            total_amount=Decimal("1000.00"),
        )
        fee = StudentFee.objects.create(
            organization=self.org_a,
            student=self.student,
            academic_session=self.session,
            fee_structure=structure,
            original_amount=Decimal("1000.00"),
            discount_amount=Decimal("0.00"),
            fine_amount=Decimal("0.00"),
            payable_amount=Decimal("1000.00"),
            due_date=date(2026, 12, 31),
            status=StudentFee.Status.PARTIALLY_PAID,
        )
        FeePayment.objects.create(
            organization=self.org_a,
            student_fee=fee,
            amount=Decimal("250.00"),
            recorded_by=self.admin_a,
        )
        exam = Exam.objects.create(
            organization=self.org_a,
            section=self.section,
            name="Mid Term",
            exam_date=date(2026, 10, 1),
            is_published=True,
        )
        StudentResult.objects.create(
            exam=exam,
            student=self.student,
            subject=self.subject,
            teacher=self.teacher,
            marks_obtained=Decimal("80.00"),
            maximum_marks=Decimal("100.00"),
        )

    def test_college_admin_can_access_overview(self):
        self.authenticate(self.admin_a)

        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 200)
        self.assertIn("academic", response.data)

    def test_anonymous_user_is_rejected(self):
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 401)

    def test_non_admin_roles_are_rejected(self):
        for user in [self.student_user, self.teacher_user, self.parent_user]:
            with self.subTest(role=user.role):
                self.authenticate(user)
                response = self.client.get(self.endpoint)
                self.assertEqual(response.status_code, 403)

    def test_college_a_admin_sees_college_a_data_only(self):
        self.add_org_a_metrics()
        self.add_other_org_data()
        self.authenticate(self.admin_a)

        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["academic"]["total_classes"], 1)
        self.assertEqual(response.data["academic"]["total_sections"], 1)
        self.assertEqual(response.data["assignments"]["total_assignments"], 1)
        self.assertEqual(response.data["live_classes"]["total_live_classes"], 2)
        self.assertEqual(response.data["fees"]["total_expected_amount"], Decimal("1000.00"))
        self.assertEqual(response.data["results"]["published_results"], 1)

    def test_college_a_admin_does_not_see_college_b_data(self):
        self.add_other_org_data()
        self.authenticate(self.admin_a)

        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["assignments"]["total_assignments"], 0)
        self.assertEqual(response.data["live_classes"]["completed"], 0)
        self.assertEqual(response.data["attendance"]["absent"], 0)

    def test_query_string_organization_tampering_is_ignored(self):
        self.add_other_org_data()
        self.authenticate(self.admin_a)

        response = self.client.get(
            self.endpoint,
            {"organization_id": self.org_b.id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["academic"]["total_classes"], 1)
        self.assertEqual(response.data["live_classes"]["total_live_classes"], 0)

    def test_empty_organization_returns_zero_values(self):
        empty_org = Organization.objects.create(name="Empty", code="EMPTY")
        empty_admin = self.make_user("empty-admin", "college_admin", empty_org)
        self.authenticate(empty_admin)

        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["academic"]["total_students"], 0)
        self.assertEqual(response.data["attendance"]["overall_percentage"], 0)
        self.assertEqual(response.data["fees"]["total_expected_amount"], Decimal("0.00"))

    def test_fee_and_attendance_calculations_use_existing_rules(self):
        self.add_org_a_metrics()
        self.authenticate(self.admin_a)

        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["attendance"]["present"], 1)
        self.assertEqual(response.data["attendance"]["late"], 1)
        self.assertEqual(response.data["attendance"]["absent"], 1)
        self.assertEqual(response.data["attendance"]["excused"], 1)
        self.assertEqual(response.data["attendance"]["overall_percentage"], 66.67)
        self.assertEqual(response.data["fees"]["total_collected_amount"], Decimal("250.00"))
        self.assertEqual(response.data["fees"]["total_pending_amount"], Decimal("750.00"))
