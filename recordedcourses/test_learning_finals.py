"""End-to-end final exam and certificate access tests; no production data."""
from decimal import Decimal
from unittest.mock import patch
from django.utils import timezone
from rest_framework.test import APITransactionTestCase

from accounts.models import User, StudentProfile, TeacherProfile
from institutions.models import Organization
from recordedcourses.models import (
    RecordedCourse, RecordedLesson, CourseModule, RecordedCourseAccess,
    LessonLearningProgress, OrganizationLearningSettings,
    TeacherCourseAssignment, CourseFinalExam, CourseFinalQuestion,
    CourseFinalAttempt, CourseCertificate,
)


class CourseFinalExamAPITests(APITransactionTestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Certificate Academy", code="P7-ACADEMY")
        self.outside = Organization.objects.create(name="Other Academy", code="P7-OUTSIDE")
        self.admin = User.objects.create_user(
            username="p7-admin", password="localtest", role="college_admin", organization=self.org,
        )
        self.other_admin = User.objects.create_user(
            username="p7-other", password="localtest", role="college_admin", organization=self.outside,
        )
        self.teacher_user = User.objects.create_user(
            username="p7-teacher", password="localtest", role="teacher", organization=self.org,
        )
        self.teacher = TeacherProfile.objects.create(user=self.teacher_user, employee_id="P7-T")
        self.student_user = User.objects.create_user(
            username="p7-student", password="localtest", role="student", organization=self.org,
            first_name="Alex", last_name="Student",
        )
        self.student = StudentProfile.objects.create(user=self.student_user, admission_number="P7-S")
        self.course = RecordedCourse.objects.create(
            organization=self.org, title="Course Completion Basics", price=Decimal("0.00"),
        )
        self.module = CourseModule.objects.create(
            course=self.course, position=1, title="Essentials", is_published=True,
        )
        self.lesson = RecordedLesson.objects.create(
            course=self.course, module=self.module, position=1, title="Video 1",
        )
        self.access = RecordedCourseAccess.objects.create(
            organization=self.org, course=self.course, student=self.student,
        )
        OrganizationLearningSettings.objects.create(organization=self.org, is_enabled=True)
        OrganizationLearningSettings.objects.create(organization=self.outside, is_enabled=True)
        self.staff_url = f"/api/recorded-courses/learning/manage/courses/{self.course.pk}/final-exam/"
        self.question_url = self.staff_url + "questions/"
        self.student_url = f"/api/recorded-courses/learning/student/courses/{self.course.pk}/final-exam/"
        self.cert_list = "/api/recorded-courses/learning/student/certificates/"
        student_feature = patch("recordedcourses.learning_access.student_feature_is_enabled", return_value=True)
        student_feature.start()
        self.addCleanup(student_feature.stop)

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def prepare_exam(self, attempts=2):
        self.auth(self.admin)
        settings = self.client.put(self.staff_url, {
            "title": "Certificate Final Exam", "passing_percent": 70, "max_attempts": attempts,
        }, format="json")
        self.assertEqual(settings.status_code, 200, settings.data)
        question = self.client.post(self.question_url, {
            "prompt": "What is four?", "choices": ["2", "4", "8"], "correct_index": 1,
        }, format="json")
        self.assertEqual(question.status_code, 201, question.data)
        published = self.client.patch(self.staff_url, {"is_published": True}, format="json")
        self.assertEqual(published.status_code, 200, published.data)
        return CourseFinalQuestion.objects.get(exam__course=self.course)

    def complete_modules(self):
        LessonLearningProgress.objects.create(
            lesson=self.lesson, student=self.student, completed_at=timezone.now(),
        )

    def test_cannot_publish_exam_without_questions(self):
        self.auth(self.admin)
        created = self.client.put(self.staff_url, {"title": "Draft"}, format="json")
        self.assertEqual(created.status_code, 200)
        result = self.client.patch(self.staff_url, {"is_published": True}, format="json")
        self.assertEqual(result.status_code, 400)
        self.auth(self.student_user)
        self.assertEqual(self.client.get(self.student_url).status_code, 404)

    def test_teacher_can_author_when_assigned_but_cannot_publish(self):
        self.auth(self.teacher_user)
        self.assertEqual(self.client.get(self.staff_url).status_code, 404)
        TeacherCourseAssignment.objects.create(
            course=self.course, teacher=self.teacher, assigned_by=self.admin,
        )
        self.assertEqual(self.client.put(self.staff_url, {"title": "Prepared final"}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(
            self.staff_url, {"is_published": True}, format="json",
        ).status_code, 403)

    def test_no_cross_organization_admin_access(self):
        self.prepare_exam()
        self.auth(self.other_admin)
        self.assertEqual(self.client.get(self.staff_url).status_code, 404)
        self.assertEqual(self.client.get(
            f"/api/recorded-courses/learning/manage/courses/{self.course.pk}/certificates/",
        ).status_code, 404)

    def test_student_final_locked_until_all_published_modules_complete(self):
        q = self.prepare_exam()
        self.auth(self.student_user)
        detail = self.client.get(self.student_url)
        self.assertEqual(detail.status_code, 200)
        self.assertFalse(detail.data["exam"]["unlocked"])
        self.assertNotIn("questions", detail.data)
        self.assertEqual(self.client.post(
            self.student_url, {"answers": {str(q.pk): 1}}, format="json",
        ).status_code, 403)
        self.complete_modules()
        detail = self.client.get(self.student_url)
        self.assertTrue(detail.data["exam"]["unlocked"])
        self.assertEqual(len(detail.data["questions"]), 1)
        self.assertNotIn("correct_index", str(detail.data))
        self.assertNotIn("is_correct", str(detail.data))

    def test_final_remains_locked_when_second_published_module_incomplete(self):
        self.prepare_exam()
        second = CourseModule.objects.create(
            course=self.course, position=2, title="Advanced", is_published=True,
        )
        RecordedLesson.objects.create(
            course=self.course, module=second, position=2, title="Second video",
        )
        self.complete_modules()
        self.auth(self.student_user)
        detail = self.client.get(self.student_url)
        self.assertFalse(detail.data["exam"]["unlocked"])
        self.assertEqual(detail.data["exam"]["required_modules"], 2)

    def test_invalid_answers_do_not_consume_an_attempt(self):
        q = self.prepare_exam()
        self.complete_modules()
        self.auth(self.student_user)
        for answers in ({}, {str(q.pk): "1"}, {str(q.pk): 5}, {"123456": 1}):
            result = self.client.post(self.student_url, {"answers": answers}, format="json")
            self.assertEqual(result.status_code, 400, result.data)
        self.assertEqual(CourseFinalAttempt.objects.count(), 0)

    def test_failed_exam_does_not_issue_certificate_and_attempt_limit_applies(self):
        q = self.prepare_exam(attempts=2)
        self.complete_modules()
        self.auth(self.student_user)
        for attempt in range(2):
            response = self.client.post(self.student_url, {"answers": {str(q.pk): 0}}, format="json")
            self.assertEqual(response.status_code, 201, response.data)
            self.assertFalse(response.data["attempt"]["passed"])
            self.assertIsNone(response.data["certificate_id"])
        self.assertEqual(self.client.post(
            self.student_url, {"answers": {str(q.pk): 1}}, format="json",
        ).status_code, 403)
        self.assertEqual(CourseCertificate.objects.count(), 0)

    def test_passed_exam_issues_unique_certificate_and_pdf(self):
        q = self.prepare_exam()
        self.complete_modules()
        self.auth(self.student_user)
        response = self.client.post(self.student_url, {"answers": {str(q.pk): 1}}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["attempt"]["passed"])
        certificate_id = response.data["certificate_id"]
        self.assertTrue(certificate_id)
        self.assertEqual(CourseCertificate.objects.count(), 1)
        self.assertEqual(self.client.post(
            self.student_url, {"answers": {str(q.pk): 1}}, format="json",
        ).status_code, 409)
        self.assertEqual(CourseCertificate.objects.count(), 1)
        library = self.client.get(self.cert_list)
        self.assertEqual(library.status_code, 200)
        self.assertEqual(library.data["certificates"][0]["id"], certificate_id)
        pdf = self.client.get(
            f"/api/recorded-courses/learning/student/certificates/{certificate_id}/pdf/",
        )
        self.assertEqual(pdf.status_code, 200)
        self.assertEqual(pdf["Content-Type"], "application/pdf")
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        verification = self.client.get(
            f"/api/recorded-courses/learning/certificates/verify/{certificate_id}/",
        )
        self.assertEqual(verification.status_code, 200)
        self.assertTrue(verification.data["valid"])
        self.assertNotEqual(verification.data["student"], "Alex Student")

    def test_certificate_is_private_even_after_entitlement_expires(self):
        q = self.prepare_exam()
        self.complete_modules()
        self.auth(self.student_user)
        result = self.client.post(self.student_url, {"answers": {str(q.pk): 1}}, format="json")
        certificate_id = result.data["certificate_id"]
        self.access.is_active = False
        self.access.save(update_fields=["is_active", "updated_at"])
        # Previously earned certificates remain downloadable by their owner.
        self.assertEqual(self.client.get(
            f"/api/recorded-courses/learning/student/certificates/{certificate_id}/pdf/",
        ).status_code, 200)
        self.auth(self.other_admin)
        self.assertEqual(self.client.get(
            f"/api/recorded-courses/learning/student/certificates/{certificate_id}/pdf/",
        ).status_code, 403)

    def test_certificate_revocation_is_visible_in_verification_and_blocks_pdf(self):
        q = self.prepare_exam()
        self.complete_modules()
        self.auth(self.student_user)
        issued = self.client.post(self.student_url, {"answers": {str(q.pk): 1}}, format="json")
        cert_id = issued.data["certificate_id"]
        self.auth(self.admin)
        revoke = self.client.patch(
            f"/api/recorded-courses/learning/manage/courses/{self.course.pk}/certificates/",
            {"certificate_id": cert_id, "reason": "Local testing"}, format="json",
        )
        self.assertEqual(revoke.status_code, 200, revoke.data)
        verify = self.client.get(f"/api/recorded-courses/learning/certificates/verify/{cert_id}/")
        self.assertFalse(verify.data["valid"])
        self.auth(self.student_user)
        self.assertEqual(self.client.get(
            f"/api/recorded-courses/learning/student/certificates/{cert_id}/pdf/",
        ).status_code, 410)

    def test_organization_switch_blocks_new_exam_attempt_but_not_certificate_download(self):
        q = self.prepare_exam()
        self.complete_modules()
        self.auth(self.student_user)
        created = self.client.post(self.student_url, {"answers": {str(q.pk): 1}}, format="json")
        cert_id = created.data["certificate_id"]
        OrganizationLearningSettings.objects.filter(organization=self.org).update(is_enabled=False)
        self.assertEqual(self.client.get(self.student_url).status_code, 403)
        self.assertEqual(self.client.get(
            f"/api/recorded-courses/learning/student/certificates/{cert_id}/pdf/",
        ).status_code, 200)
