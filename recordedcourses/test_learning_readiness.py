"""Operational readiness checklist and enrollment reporting tests."""
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITransactionTestCase
from accounts.models import User, StudentProfile, TeacherProfile
from institutions.models import Organization
from recordedcourses.models import (
    RecordedCourse, RecordedLesson, RecordedCourseAccess,
    RecordedCoursePurchase, CourseModule, ModuleQuiz,
    ModuleAssignment, ModuleAssignmentSubmission,
    CourseFinalExam, CourseFinalQuestion,
    OrganizationLearningSettings, TeacherCourseAssignment,
)


class CourseReadinessAPITests(APITransactionTestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Readiness Campus", code="P10-A")
        self.other = Organization.objects.create(name="Other Readiness Campus", code="P10-B")
        self.admin = User.objects.create_user(
            username="p10-admin", password="localtest",
            role="college_admin", organization=self.org,
        )
        self.other_admin = User.objects.create_user(
            username="p10-other", password="localtest",
            role="college_admin", organization=self.other,
        )
        self.teacher_user = User.objects.create_user(
            username="p10-teacher", password="localtest",
            role="teacher", organization=self.org,
        )
        self.teacher = TeacherProfile.objects.create(
            user=self.teacher_user, employee_id="P10-T",
        )
        self.student_user = User.objects.create_user(
            username="p10-student", password="localtest",
            role="student", organization=self.org,
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user, admission_number="P10-S",
        )
        self.course = RecordedCourse.objects.create(
            organization=self.org, title="Readiness Tutorial", price=Decimal("0.00"),
        )
        self.url = "/api/recorded-courses/learning/manage/courses/%s/readiness/" % self.course.pk
        OrganizationLearningSettings.objects.create(organization=self.org, is_enabled=True)
        OrganizationLearningSettings.objects.create(organization=self.other, is_enabled=True)

    def login(self, user):
        self.client.force_authenticate(user=user)

    def setup_ready(self):
        module = CourseModule.objects.create(
            course=self.course, title="Published", position=1, is_published=True,
        )
        RecordedLesson.objects.create(
            course=self.course, module=module, title="Video", position=1,
            verified_duration_seconds=60.0, duration_verified_at=timezone.now(),
        )
        exam = CourseFinalExam.objects.create(
            course=self.course, title="Final", is_published=True,
        )
        CourseFinalQuestion.objects.create(
            exam=exam, position=1, prompt="Which is correct?",
            choices=["A", "B"], correct_index=0,
        )
        return module

    def test_missing_course_setup_reports_blockers(self):
        self.login(self.admin)
        result = self.client.get(self.url)
        self.assertEqual(result.status_code, 200, result.data)
        self.assertFalse(result.data["ready_for_final_exam"])
        missing = {c["code"] for c in result.data["checks"] if not c["passed"]}
        self.assertIn("published_modules", missing)
        self.assertIn("final_exam_published", missing)
        self.assertIn("final_exam_questions", missing)

    def test_ready_course_and_draft_assessments_are_reported_separately(self):
        module = self.setup_ready()
        ModuleQuiz.objects.create(module=module, title="Draft quiz")
        ModuleAssignment.objects.create(
            module=module, title="Draft assignment", instructions="Write answer.",
        )
        self.login(self.admin)
        result = self.client.get(self.url)
        self.assertEqual(result.status_code, 200, result.data)
        self.assertTrue(result.data["ready_for_final_exam"])
        self.assertTrue(all(c["passed"] for c in result.data["checks"]))
        self.assertEqual(result.data["modules"][0]["quiz_status"], "draft")
        self.assertEqual(result.data["modules"][0]["assignment_status"], "draft")
        self.assertEqual(len(result.data["warnings"]), 2)

    def test_learner_counts_and_pending_grading_do_not_expose_student_names(self):
        module = self.setup_ready()
        manual = RecordedCourseAccess.objects.create(
            course=self.course, organization=self.org, student=self.student,
        )
        assignment = ModuleAssignment.objects.create(
            module=module, title="Workbook", instructions="Submit work.",
            is_published=True,
        )
        ModuleAssignmentSubmission.objects.create(
            assignment=assignment, student=self.student,
            attempt_number=1, answer_text="My worksheet",
        )
        self.login(self.admin)
        result = self.client.get(self.url)
        self.assertEqual(result.status_code, 200, result.data)
        metrics = result.data["enrollments"]
        self.assertEqual(metrics["active"], 1)
        self.assertEqual(metrics["manual_active"], 1)
        self.assertEqual(metrics["purchased_active"], 0)
        self.assertEqual(metrics["pending_grading"], 1)
        self.assertNotIn("p10-student", str(result.data))

    def test_tenant_and_teacher_assignment_are_enforced(self):
        self.setup_ready()
        self.login(self.other_admin)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.login(self.teacher_user)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        TeacherCourseAssignment.objects.create(
            course=self.course, teacher=self.teacher, assigned_by=self.admin,
        )
        self.assertEqual(self.client.get(self.url).status_code, 200)
        self.login(self.student_user)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        OrganizationLearningSettings.objects.filter(organization=self.org).update(is_enabled=False)
        self.login(self.admin)
        self.assertEqual(self.client.get(self.url).status_code, 403)
