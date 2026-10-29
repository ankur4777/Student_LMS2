"""Regression tests for organization-scoped module quizzes and MCQ grading."""
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITransactionTestCase
from accounts.models import User, StudentProfile, TeacherProfile
from institutions.models import Organization
from recordedcourses.models import (
    CourseModule, LessonLearningProgress, ModuleQuiz, ModuleQuizAttempt,
    ModuleQuizQuestion, OrganizationLearningSettings, RecordedCourse,
    RecordedCourseAccess, RecordedLesson, TeacherCourseAssignment,
)


class ModuleQuizAPITests(APITransactionTestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Quiz College", code="P5-QA")
        self.other_org = Organization.objects.create(name="Other Quiz College", code="P5-QB")
        self.admin = User.objects.create_user(username="p5-admin", password="localtest", role="college_admin", organization=self.org)
        self.teacher_user = User.objects.create_user(username="p5-teacher", password="localtest", role="teacher", organization=self.org)
        self.teacher = TeacherProfile.objects.create(user=self.teacher_user, employee_id="P5-TEACH")
        self.student_user = User.objects.create_user(username="p5-student", password="localtest", role="student", organization=self.org)
        self.student = StudentProfile.objects.create(user=self.student_user, admission_number="P5-STUD")
        self.other_user = User.objects.create_user(username="p5-other", password="localtest", role="college_admin", organization=self.other_org)
        self.course = RecordedCourse.objects.create(organization=self.org, title="P5 Course", price=Decimal("0.00"))
        self.module = CourseModule.objects.create(course=self.course, position=1, title="Module One", is_published=True)
        self.lesson = RecordedLesson.objects.create(course=self.course, module=self.module, position=1, title="Lesson One")
        self.access = RecordedCourseAccess.objects.create(organization=self.org, course=self.course, student=self.student)
        OrganizationLearningSettings.objects.create(organization=self.org, is_enabled=True)
        self.staff_url = f"/api/recorded-courses/learning/manage/modules/{self.module.pk}/quiz/"
        self.question_url = self.staff_url + "questions/"
        self.student_url = f"/api/recorded-courses/learning/student/modules/{self.module.pk}/quiz/"
        feature = patch("recordedcourses.learning_access.student_feature_is_enabled", return_value=True)
        feature.start()
        self.addCleanup(feature.stop)

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def quiz_ready(self):
        self.auth(self.admin)
        response = self.client.put(
            self.staff_url,
            {"title": "Chapter Quiz", "passing_percent": 70, "max_attempts": 2},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        question = self.client.post(
            self.question_url,
            {"prompt": "2 + 2 equals?", "choices": ["3", "4", "5"], "correct_index": 1},
            format="json",
        )
        self.assertEqual(question.status_code, 201, question.data)
        published = self.client.patch(self.staff_url, {"is_published": True}, format="json")
        self.assertEqual(published.status_code, 200, published.data)
        return ModuleQuizQuestion.objects.get(quiz__module=self.module)

    def mark_watched(self):
        LessonLearningProgress.objects.create(student=self.student, lesson=self.lesson, completed_at=timezone.now())

    def test_quiz_requires_published_questions(self):
        self.auth(self.admin)
        self.assertEqual(self.client.put(self.staff_url, {"title": "Draft"}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(self.staff_url, {"is_published": True}, format="json").status_code, 400)
        # A college admin cannot use a student-only quiz endpoint.
        self.assertEqual(self.client.get(self.student_url).status_code, 403)
        # With a genuine enrolled student, the unpublished quiz is hidden.
        self.auth(self.student_user)
        self.assertEqual(self.client.get(self.student_url).status_code, 404)

    def test_unassigned_teacher_cannot_write_and_assigned_teacher_cannot_publish(self):
        self.auth(self.teacher_user)
        self.assertEqual(self.client.get(self.staff_url).status_code, 404)
        TeacherCourseAssignment.objects.create(course=self.course, teacher=self.teacher, assigned_by=self.admin)
        self.assertEqual(self.client.put(self.staff_url, {"title": "Draft"}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(self.staff_url, {"is_published": True}, format="json").status_code, 403)

    def test_other_organization_cannot_read_quiz(self):
        self.quiz_ready()
        OrganizationLearningSettings.objects.create(organization=self.other_org, is_enabled=True)
        self.auth(self.other_user)
        self.assertEqual(self.client.get(self.staff_url).status_code, 404)

    def test_student_sees_no_answers_before_or_after_unlocked(self):
        question = self.quiz_ready()
        self.auth(self.student_user)
        locked = self.client.get(self.student_url)
        self.assertEqual(locked.status_code, 200)
        self.assertFalse(locked.data["quiz"]["unlocked"])
        self.assertNotIn("questions", locked.data)
        self.assertEqual(
            self.client.post(self.student_url, {"answers": {str(question.pk): 1}}, format="json").status_code,
            403,
        )
        self.mark_watched()
        visible = self.client.get(self.student_url)
        self.assertEqual(visible.status_code, 200)
        self.assertEqual(visible.data["questions"][0]["choices"][1]["text"], "4")
        self.assertNotIn("correct_index", str(visible.data))
        self.assertNotIn("is_correct", str(visible.data))

    def test_correct_answer_is_graded_and_prevents_retakes(self):
        q = self.quiz_ready()
        self.mark_watched()
        self.auth(self.student_user)
        response = self.client.post(self.student_url, {"answers": {str(q.pk): 1}}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["attempt"]["passed"])
        self.assertEqual(response.data["attempt"]["score_percent"], 100)
        self.assertEqual(self.client.post(self.student_url, {"answers": {str(q.pk): 1}}, format="json").status_code, 409)

    def test_wrong_answers_use_attempt_limit(self):
        q = self.quiz_ready()
        self.mark_watched()
        self.auth(self.student_user)
        for _ in range(2):
            response = self.client.post(self.student_url, {"answers": {str(q.pk): 0}}, format="json")
            self.assertEqual(response.status_code, 201, response.data)
            self.assertFalse(response.data["attempt"]["passed"])
        self.assertEqual(self.client.post(self.student_url, {"answers": {str(q.pk): 1}}, format="json").status_code, 403)
        self.assertEqual(ModuleQuizAttempt.objects.count(), 2)

    def test_invalid_answers_do_not_consume_attempt(self):
        q = self.quiz_ready()
        self.mark_watched()
        self.auth(self.student_user)
        for ans in ({}, {str(q.pk): 5}, {str(q.pk): "1"}, {"1234567": 1}):
            self.assertEqual(self.client.post(self.student_url, {"answers": ans}, format="json").status_code, 400)
        self.assertEqual(ModuleQuizAttempt.objects.count(), 0)

    def test_organization_toggle_and_access_are_enforced(self):
        self.quiz_ready()
        self.auth(self.student_user)
        self.access.is_active = False
        self.access.save(update_fields=["is_active", "updated_at"])
        self.assertEqual(self.client.get(self.student_url).status_code, 403)
        self.access.is_active = True
        self.access.save(update_fields=["is_active", "updated_at"])
        OrganizationLearningSettings.objects.filter(organization=self.org).update(is_enabled=False)
        self.assertEqual(self.client.get(self.student_url).status_code, 403)

    def test_published_quiz_is_locked_against_question_changes(self):
        self.quiz_ready()
        self.auth(self.admin)
        res = self.client.post(self.question_url, {"prompt": "new", "choices": ["a", "b"], "correct_index": 0}, format="json")
        self.assertEqual(res.status_code, 409)
