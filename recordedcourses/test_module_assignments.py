"""Tests for learning module assignments and sequential access rules."""
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITransactionTestCase

from accounts.models import StudentProfile, TeacherProfile, User
from institutions.models import Organization
from recordedcourses.models import (
    CourseModule, LessonLearningProgress, ModuleAssignment,
    ModuleAssignmentSubmission, ModuleQuiz, ModuleQuizAttempt,
    ModuleQuizQuestion, OrganizationLearningSettings, RecordedCourse,
    RecordedCourseAccess, RecordedLesson, TeacherCourseAssignment,
)


class ModuleAssignmentFlowTests(APITransactionTestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Sequential Learning", code="P6-ORG")
        self.outsider_org = Organization.objects.create(name="Other Learning", code="P6-OTHER")
        self.admin = User.objects.create_user(
            username="p6-admin", password="localtest", role="college_admin", organization=self.org,
        )
        self.outsider = User.objects.create_user(
            username="p6-other", password="localtest", role="college_admin", organization=self.outsider_org,
        )
        self.teacher_user = User.objects.create_user(
            username="p6-teacher", password="localtest", role="teacher", organization=self.org,
        )
        self.teacher = TeacherProfile.objects.create(user=self.teacher_user, employee_id="P6-T")
        self.student_user = User.objects.create_user(
            username="p6-student", password="localtest", role="student", organization=self.org,
        )
        self.student = StudentProfile.objects.create(user=self.student_user, admission_number="P6-S")
        self.course = RecordedCourse.objects.create(
            organization=self.org, title="Intro to Physics", price=Decimal("0.00"),
        )
        self.first = CourseModule.objects.create(
            course=self.course, position=1, title="Introduction", is_published=True,
        )
        self.second = CourseModule.objects.create(
            course=self.course, position=2, title="Motion", is_published=True,
        )
        self.lesson1 = RecordedLesson.objects.create(
            course=self.course, module=self.first, position=1, title="First video",
        )
        self.lesson2 = RecordedLesson.objects.create(
            course=self.course, module=self.second, position=2, title="Second video",
        )
        self.access = RecordedCourseAccess.objects.create(
            organization=self.org, course=self.course, student=self.student,
        )
        OrganizationLearningSettings.objects.create(organization=self.org, is_enabled=True)
        OrganizationLearningSettings.objects.create(organization=self.outsider_org, is_enabled=True)
        self.staff_url = f"/api/recorded-courses/learning/manage/modules/{self.first.pk}/assignment/"
        self.student_url = f"/api/recorded-courses/learning/student/modules/{self.first.pk}/assignment/"
        self.course_url = f"/api/recorded-courses/learning/student/courses/{self.course.pk}/"
        self.second_complete_url = f"/api/recorded-courses/learning/student/lessons/{self.lesson2.pk}/complete/"
        self.second_play_url = f"/api/recorded-courses/learning/student/lessons/{self.lesson2.pk}/play/"
        self.legacy_play_url = f"/api/recorded-courses/student/lessons/{self.lesson2.pk}/play/"
        feature = patch("recordedcourses.learning_access.student_feature_is_enabled", return_value=True)
        feature.start()
        self.addCleanup(feature.stop)

    def login(self, user):
        self.client.force_authenticate(user=user)

    def watched(self):
        LessonLearningProgress.objects.create(
            lesson=self.lesson1, student=self.student, completed_at=timezone.now(),
        )

    def assignment(self):
        return ModuleAssignment.objects.create(
            module=self.first, title="Show your working", instructions="Solve questions 1-3.",
            passing_percent=60, max_attempts=2, is_published=True,
        )

    def test_student_cannot_see_unpublished_assignment(self):
        self.login(self.admin)
        self.assertEqual(self.client.put(
            self.staff_url,
            {"title": "Draft", "instructions": "Write an answer."}, format="json",
        ).status_code, 200)
        self.login(self.student_user)
        self.assertEqual(self.client.get(self.student_url).status_code, 404)

    def test_only_college_admin_publishes_assignments(self):
        self.login(self.teacher_user)
        self.assertEqual(self.client.get(self.staff_url).status_code, 404)
        TeacherCourseAssignment.objects.create(
            course=self.course, teacher=self.teacher, assigned_by=self.admin,
        )
        self.assertEqual(self.client.put(self.staff_url, {
            "title": "Homework", "instructions": "Complete it.",
        }, format="json").status_code, 200)
        self.assertEqual(self.client.patch(
            self.staff_url, {"is_published": True}, format="json",
        ).status_code, 403)
        self.login(self.admin)
        self.assertEqual(self.client.patch(
            self.staff_url, {"is_published": True}, format="json",
        ).status_code, 200)

    def test_module_two_stays_locked_until_first_video_watched(self):
        self.login(self.student_user)
        detail = self.client.get(self.course_url)
        self.assertEqual(detail.status_code, 200)
        self.assertFalse(detail.data["course"]["modules"][0]["locked"])
        self.assertTrue(detail.data["course"]["modules"][1]["locked"])
        self.assertEqual(detail.data["course"]["modules"][1]["lessons"], [])
        self.assertEqual(self.client.post(self.second_complete_url).status_code, 403)
        self.assertEqual(self.client.get(self.second_play_url).status_code, 403)
        self.assertEqual(self.client.get(self.legacy_play_url).status_code, 403)
        self.watched()
        detail = self.client.get(self.course_url)
        self.assertFalse(detail.data["course"]["modules"][1]["locked"])

    def test_published_quiz_and_assignment_both_required_for_next_module(self):
        assignment = self.assignment()
        quiz = ModuleQuiz.objects.create(
            module=self.first, title="Knowledge check", is_published=True,
        )
        q = ModuleQuizQuestion.objects.create(
            quiz=quiz, position=1, prompt="2+2?", choices=["4", "7"], correct_index=0,
        )
        self.watched()
        self.login(self.student_user)
        detail = self.client.get(self.course_url)
        self.assertTrue(detail.data["course"]["modules"][1]["locked"])
        answer = self.client.post(
            f"/api/recorded-courses/learning/student/modules/{self.first.pk}/quiz/",
            {"answers": {str(q.pk): 0}}, format="json",
        )
        self.assertEqual(answer.status_code, 201, answer.data)
        self.assertTrue(answer.data["attempt"]["passed"])
        detail = self.client.get(self.course_url)
        self.assertTrue(detail.data["course"]["modules"][1]["locked"])
        submission = self.client.post(self.student_url, {"answer_text": "My answer"}, format="json")
        self.assertEqual(submission.status_code, 201, submission.data)
        detail = self.client.get(self.course_url)
        self.assertTrue(detail.data["course"]["modules"][1]["locked"])
        self.login(self.admin)
        grade = self.client.patch(
            f"/api/recorded-courses/learning/manage/submissions/{submission.data['submission']['id']}/grade/",
            {"score_percent": 90, "feedback": "Good"}, format="json",
        )
        self.assertEqual(grade.status_code, 200, grade.data)
        self.login(self.student_user)
        detail = self.client.get(self.course_url)
        self.assertFalse(detail.data["course"]["modules"][1]["locked"])

    def test_assignment_submission_requires_lecture_completion(self):
        self.assignment()
        self.login(self.student_user)
        self.assertEqual(self.client.post(
            self.student_url, {"answer_text": "Early answer"}, format="json",
        ).status_code, 403)
        self.watched()
        self.assertEqual(self.client.post(
            self.student_url, {"answer_text": ""}, format="json",
        ).status_code, 400)

    def test_pending_submission_blocks_resubmission_and_failed_grade_allows_retry(self):
        self.assignment()
        self.watched()
        self.login(self.student_user)
        first = self.client.post(self.student_url, {"answer_text": "Attempt one"}, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(self.client.post(
            self.student_url, {"answer_text": "Double submit"}, format="json",
        ).status_code, 409)
        self.login(self.admin)
        grade_url = f"/api/recorded-courses/learning/manage/submissions/{first.data['submission']['id']}/grade/"
        self.assertEqual(self.client.patch(grade_url, {"score_percent": 45}, format="json").status_code, 200)
        self.login(self.student_user)
        second = self.client.post(self.student_url, {"answer_text": "Improved"}, format="json")
        self.assertEqual(second.status_code, 201, second.data)
        self.login(self.admin)
        grade_url = f"/api/recorded-courses/learning/manage/submissions/{second.data['submission']['id']}/grade/"
        self.assertEqual(self.client.patch(grade_url, {"score_percent": 80}, format="json").status_code, 200)
        self.login(self.student_user)
        self.assertEqual(self.client.post(
            self.student_url, {"answer_text": "Extra"}, format="json",
        ).status_code, 409)
        self.assertEqual(ModuleAssignmentSubmission.objects.count(), 2)

    def test_unassigned_teacher_and_cross_org_admin_cannot_grade(self):
        self.assignment()
        self.watched()
        self.login(self.student_user)
        submitted = self.client.post(self.student_url, {"answer_text": "Test"}, format="json")
        self.assertEqual(submitted.status_code, 201, submitted.data)
        url = f"/api/recorded-courses/learning/manage/submissions/{submitted.data['submission']['id']}/grade/"
        self.login(self.teacher_user)
        self.assertEqual(self.client.patch(url, {"score_percent": 95}, format="json").status_code, 404)
        self.login(self.outsider)
        self.assertEqual(self.client.patch(url, {"score_percent": 95}, format="json").status_code, 404)
        self.login(self.admin)
        self.assertEqual(self.client.patch(url, {"score_percent": 110}, format="json").status_code, 400)

    def test_organization_toggle_blocks_student_submission(self):
        self.assignment()
        self.watched()
        self.login(self.student_user)
        OrganizationLearningSettings.objects.filter(organization=self.org).update(is_enabled=False)
        self.assertEqual(self.client.get(self.student_url).status_code, 403)
        self.assertEqual(self.client.post(self.student_url, {"answer_text": "Test"}, format="json").status_code, 403)

    def test_teacher_cannot_edit_assignment_after_publication(self):
        self.assignment()
        self.login(self.admin)
        self.assertEqual(self.client.put(
            self.staff_url, {"title": "Changed", "instructions": "Changed"}, format="json",
        ).status_code, 409)
        self.assertEqual(self.client.patch(
            self.staff_url, {"is_published": False}, format="json",
        ).status_code, 200)
