"""Regression tests for College Admin-assigned recorded-learning course access."""
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITransactionTestCase

from accounts.models import StudentProfile, TeacherProfile, User
from institutions.models import Organization
from recordedcourses.models import (
    CourseModule, OrganizationLearningSettings, RecordedCourse,
    RecordedCourseAccess, RecordedCoursePurchase,
)


class ManualCourseEnrollmentTests(APITransactionTestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Enrollment Campus", code="P9-A")
        self.other_org = Organization.objects.create(name="Other Campus", code="P9-B")
        self.admin = User.objects.create_user(
            username="p9-admin", password="localtest", role="college_admin", organization=self.org,
        )
        self.outsider_admin = User.objects.create_user(
            username="p9-other-admin", password="localtest", role="college_admin", organization=self.other_org,
        )
        self.teacher_user = User.objects.create_user(
            username="p9-teacher", password="localtest", role="teacher", organization=self.org,
        )
        self.teacher = TeacherProfile.objects.create(user=self.teacher_user, employee_id="P9-T")
        self.student_user = User.objects.create_user(
            username="p9-student", password="localtest", role="student",
            organization=self.org, first_name="Test", last_name="Learner",
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user, admission_number="P9-001",
        )
        self.other_student_user = User.objects.create_user(
            username="p9-external-student", password="localtest",
            role="student", organization=self.other_org,
        )
        self.other_student = StudentProfile.objects.create(
            user=self.other_student_user, admission_number="P9-OUT",
        )
        self.course = RecordedCourse.objects.create(
            organization=self.org, title="Physics Masterclass",
            price=Decimal("50.00"), access_duration_days=180,
        )
        self.module = CourseModule.objects.create(
            course=self.course, title="Intro", position=1, is_published=True,
        )
        self.url = f"/api/recorded-courses/learning/manage/courses/{self.course.pk}/enrollments/"
        self.student_url = "/api/recorded-courses/learning/student/courses/"
        OrganizationLearningSettings.objects.create(organization=self.org, is_enabled=True)
        OrganizationLearningSettings.objects.create(organization=self.other_org, is_enabled=True)
        feature = patch("recordedcourses.learning_access.student_feature_is_enabled", return_value=True)
        feature.start()
        self.addCleanup(feature.stop)

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def grant(self, duration=None):
        self.auth(self.admin)
        values = {"student_id": self.student.pk}
        if duration is not None:
            values["duration_days"] = duration
        return self.client.post(self.url, values, format="json")

    def test_admin_can_grant_access_without_purchase_and_student_can_see_course(self):
        granted = self.grant()
        self.assertEqual(granted.status_code, 201, granted.data)
        access = RecordedCourseAccess.objects.get(course=self.course, student=self.student)
        self.assertIsNone(access.purchase_id)
        self.assertTrue(access.has_access)
        self.assertEqual(granted.data["access"]["source"], "manual")
        self.assertAlmostEqual(
            (access.expires_at - access.starts_at).total_seconds(),
            180 * 86400, delta=2,
        )
        self.auth(self.student_user)
        courses = self.client.get(self.student_url)
        self.assertEqual(courses.status_code, 200, courses.data)
        self.assertIn(self.course.pk, [c["id"] for c in courses.data["courses"]])

    def test_grant_requires_college_admin_and_organization_access(self):
        self.auth(self.teacher_user)
        self.assertEqual(self.client.post(
            self.url, {"student_id": self.student.pk}, format="json",
        ).status_code, 403)
        self.auth(self.student_user)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.auth(self.outsider_admin)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.client.post(
            self.url, {"student_id": self.student.pk}, format="json",
        ).status_code, 404)

    def test_cannot_grant_another_organization_or_inactive_student(self):
        self.auth(self.admin)
        self.assertEqual(self.client.post(
            self.url, {"student_id": self.other_student.pk}, format="json",
        ).status_code, 404)
        self.student_user.is_active = False
        self.student_user.save(update_fields=["is_active"])
        self.assertEqual(self.client.post(
            self.url, {"student_id": self.student.pk}, format="json",
        ).status_code, 404)
        self.assertFalse(RecordedCourseAccess.objects.exists())

    def test_duplicate_grant_does_not_extend_existing_active_access(self):
        self.assertEqual(self.grant(30).status_code, 201)
        initial = RecordedCourseAccess.objects.get(course=self.course, student=self.student)
        original_expiry = initial.expires_at
        duplicate = self.grant(365)
        self.assertEqual(duplicate.status_code, 409)
        initial.refresh_from_db()
        self.assertEqual(initial.expires_at, original_expiry)
        self.assertEqual(RecordedCourseAccess.objects.count(), 1)

    def test_revoke_and_regrant_only_manual_access(self):
        self.assertEqual(self.grant().status_code, 201)
        self.auth(self.admin)
        revoked = self.client.patch(
            self.url, {"student_id": self.student.pk, "reason": "End of sponsored access"}, format="json",
        )
        self.assertEqual(revoked.status_code, 200, revoked.data)
        access = RecordedCourseAccess.objects.get(course=self.course, student=self.student)
        self.assertFalse(access.has_access)
        self.assertEqual(access.revoke_reason, "End of sponsored access")
        self.auth(self.student_user)
        self.assertNotIn(self.course.pk, [
            c["id"] for c in self.client.get(self.student_url).data["courses"]
        ])
        restored = self.grant(45)
        self.assertEqual(restored.status_code, 201, restored.data)
        access.refresh_from_db()
        self.assertTrue(access.has_access)
        self.assertIsNone(access.revoked_at)
        self.assertEqual(access.revoke_reason, "")
        self.assertAlmostEqual(
            (access.expires_at - access.starts_at).total_seconds(), 45 * 86400, delta=2,
        )

    def test_paid_purchase_access_remains_immutable(self):
        purchase = RecordedCoursePurchase.objects.create(
            organization=self.org, course=self.course, student=self.student,
            buyer_type=RecordedCoursePurchase.BuyerType.STUDENT,
            purchased_by_student=self.student,
            amount=Decimal("50.00"),
            status=RecordedCoursePurchase.Status.PAID,
        )
        access = RecordedCourseAccess.objects.create(
            organization=self.org, course=self.course, student=self.student,
            purchase=purchase,
        )
        self.auth(self.admin)
        blocked_grant = self.client.post(
            self.url, {"student_id": self.student.pk}, format="json",
        )
        self.assertEqual(blocked_grant.status_code, 409)
        blocked_revoke = self.client.patch(
            self.url, {"student_id": self.student.pk, "reason": "Not permitted"}, format="json",
        )
        self.assertEqual(blocked_revoke.status_code, 409)
        access.refresh_from_db()
        self.assertEqual(access.purchase_id, purchase.pk)
        self.assertTrue(access.has_access)

    def test_paid_purchase_without_linked_access_still_blocks_manual_grant(self):
        RecordedCoursePurchase.objects.create(
            organization=self.org, course=self.course, student=self.student,
            buyer_type=RecordedCoursePurchase.BuyerType.STUDENT,
            purchased_by_student=self.student, amount=Decimal("50.00"),
            status=RecordedCoursePurchase.Status.PAID,
        )
        self.assertEqual(self.grant().status_code, 409)
        self.assertFalse(RecordedCourseAccess.objects.exists())

    def test_expired_manual_access_can_be_renewed(self):
        access = RecordedCourseAccess.objects.create(
            organization=self.org, course=self.course, student=self.student,
            starts_at=timezone.now()-timedelta(days=90),
            expires_at=timezone.now()-timedelta(days=1),
        )
        self.assertFalse(access.has_access)
        renewed = self.grant(60)
        self.assertEqual(renewed.status_code, 201, renewed.data)
        access.refresh_from_db()
        self.assertTrue(access.has_access)

    def test_invalid_payload_and_missing_revocation_reason(self):
        self.auth(self.admin)
        for bad in (0, -1, "1", True, None):
            self.assertEqual(self.client.post(
                self.url, {"student_id": bad}, format="json",
            ).status_code, 400)
        for duration in (0, 3651, "45", True, -2):
            self.assertEqual(self.client.post(
                self.url, {"student_id": self.student.pk, "duration_days": duration},
                format="json",
            ).status_code, 400)
        self.assertEqual(self.client.patch(
            self.url, {"student_id": self.student.pk, "reason": " "}, format="json",
        ).status_code, 400)
        self.assertFalse(RecordedCourseAccess.objects.exists())

    def test_students_list_is_paginated_and_searchable(self):
        for idx in range(26):
            user = User.objects.create(
                username=f"p9-another-{idx:02d}", role="student", organization=self.org,
            )
            StudentProfile.objects.create(
                user=user, admission_number=f"P9-{idx+100:03d}",
            )
        self.auth(self.admin)
        first = self.client.get(self.url)
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data["students_total"], 27)
        self.assertEqual(len(first.data["students"]), 25)
        self.assertTrue(first.data["has_next"])
        second = self.client.get(self.url, {"page": "2"})
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(len(second.data["students"]), 2)
        lookup = self.client.get(self.url, {"search": "P9-001"})
        self.assertEqual(lookup.status_code, 200, lookup.data)
        self.assertEqual(lookup.data["students_total"], 1)
        self.assertEqual(lookup.data["students"][0]["id"], self.student.pk)
        for value in ("0", "bad", "-1", "1000001"):
            self.assertEqual(self.client.get(self.url, {"page": value}).status_code, 400)
        self.assertEqual(self.client.get(self.url, {"search": "x"*81}).status_code, 400)

    def test_org_toggle_blocks_manual_enrollment(self):
        OrganizationLearningSettings.objects.filter(organization=self.org).update(is_enabled=False)
        self.auth(self.admin)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.client.post(
            self.url, {"student_id": self.student.pk}, format="json",
        ).status_code, 403)
        self.assertFalse(RecordedCourseAccess.objects.exists())


    def test_end_to_end_manual_enrollment_to_certificate(self):
        """Manual grant -> lessons -> quiz -> graded work -> final -> certificate."""
        from recordedcourses.models import (
            RecordedLesson, ModuleQuiz, ModuleQuizQuestion,
            ModuleAssignment, ModuleAssignmentSubmission,
            CourseFinalExam, CourseFinalQuestion, CourseCertificate,
        )
        lesson = RecordedLesson.objects.create(
            course=self.course, module=self.module, title="Introduction video", position=1,
            video="tests/enrollment-intro.mp4",
        )
        module_quiz_url = (
            f"/api/recorded-courses/learning/manage/modules/{self.module.pk}/quiz/"
        )
        module_assignment_url = (
            f"/api/recorded-courses/learning/manage/modules/{self.module.pk}/assignment/"
        )
        final_url = (
            f"/api/recorded-courses/learning/manage/courses/{self.course.pk}/final-exam/"
        )
        # College Admin configures and publishes required assessments.
        self.auth(self.admin)
        quiz = self.client.put(module_quiz_url, {
            "title": "Module Check", "passing_percent": 70, "max_attempts": 2,
        }, format="json")
        self.assertEqual(quiz.status_code, 200, quiz.data)
        question = self.client.post(module_quiz_url + "questions/", {
            "prompt": "Which answer is correct?", "choices": ["Wrong", "Correct"],
            "correct_index": 1,
        }, format="json")
        self.assertEqual(question.status_code, 201, question.data)
        module_question = ModuleQuizQuestion.objects.get(quiz__module=self.module)
        self.assertEqual(self.client.patch(
            module_quiz_url, {"is_published": True}, format="json",
        ).status_code, 200)

        assignment = self.client.put(module_assignment_url, {
            "title": "Module Homework", "instructions": "Explain the topic.",
            "passing_percent": 60, "max_attempts": 2,
        }, format="json")
        self.assertEqual(assignment.status_code, 200, assignment.data)
        self.assertEqual(self.client.patch(
            module_assignment_url, {"is_published": True}, format="json",
        ).status_code, 200)

        exam = self.client.put(final_url, {
            "title": "Course Final", "passing_percent": 70, "max_attempts": 2,
        }, format="json")
        self.assertEqual(exam.status_code, 200, exam.data)
        final_question = self.client.post(final_url + "questions/", {
            "prompt": "Final question?", "choices": ["No", "Yes"], "correct_index": 1,
        }, format="json")
        self.assertEqual(final_question.status_code, 201, final_question.data)
        final_q = CourseFinalQuestion.objects.get(exam__course=self.course)
        self.assertEqual(self.client.patch(
            final_url, {"is_published": True}, format="json",
        ).status_code, 200)

        granted = self.grant(45)
        self.assertEqual(granted.status_code, 201, granted.data)

        # The student can see the directly assigned course, without paying.
        self.auth(self.student_user)
        catalog = self.client.get(self.student_url)
        self.assertEqual(catalog.status_code, 200, catalog.data)
        self.assertIn(self.course.pk, [course["id"] for course in catalog.data["courses"]])
        locked = self.client.post(
            f"/api/recorded-courses/learning/student/courses/{self.course.pk}/final-exam/",
            {"answers": {str(final_q.pk): 1}}, format="json",
        )
        self.assertEqual(locked.status_code, 403)

        playback_session = self.client.post(
            f"/api/recorded-courses/learning/student/lessons/{lesson.pk}/viewing-session/",
        )
        self.assertEqual(playback_session.status_code, 200, playback_session.data)
        with patch("recordedcourses.learning_playback.MIN_VIEW_SECONDS", 0):
            watched = self.client.post(
                f"/api/recorded-courses/learning/student/lessons/{lesson.pk}/complete/",
                {"playback_ticket": playback_session.data["ticket"]}, format="json",
            )
        self.assertEqual(watched.status_code, 200, watched.data)
        quiz_result = self.client.post(
            f"/api/recorded-courses/learning/student/modules/{self.module.pk}/quiz/",
            {"answers": {str(module_question.pk): 1}}, format="json",
        )
        self.assertEqual(quiz_result.status_code, 201, quiz_result.data)
        self.assertTrue(quiz_result.data["attempt"]["passed"])
        submitted = self.client.post(
            f"/api/recorded-courses/learning/student/modules/{self.module.pk}/assignment/",
            {"answer_text": "My completed homework."}, format="json",
        )
        self.assertEqual(submitted.status_code, 201, submitted.data)

        # Pending grading prevents final examination access.
        still_locked = self.client.post(
            f"/api/recorded-courses/learning/student/courses/{self.course.pk}/final-exam/",
            {"answers": {str(final_q.pk): 1}}, format="json",
        )
        self.assertEqual(still_locked.status_code, 403)

        # College Admin grades the submitted work.
        self.auth(self.admin)
        graded = self.client.patch(
            f"/api/recorded-courses/learning/manage/submissions/{submitted.data['submission']['id']}/grade/",
            {"score_percent": 90, "feedback": "Well done"}, format="json",
        )
        self.assertEqual(graded.status_code, 200, graded.data)
        self.auth(self.student_user)
        finished = self.client.post(
            f"/api/recorded-courses/learning/student/courses/{self.course.pk}/final-exam/",
            {"answers": {str(final_q.pk): 1}}, format="json",
        )
        self.assertEqual(finished.status_code, 201, finished.data)
        self.assertTrue(finished.data["attempt"]["passed"])
        certificate_id = finished.data["certificate_id"]
        self.assertTrue(certificate_id)
        self.assertEqual(CourseCertificate.objects.filter(course=self.course).count(), 1)

        # Verification remains valid even after manual enrollment expires/revokes.
        self.auth(self.admin)
        revoked = self.client.patch(
            self.url, {"student_id": self.student.pk, "reason": "Course access period ended"},
            format="json",
        )
        self.assertEqual(revoked.status_code, 200, revoked.data)
        self.auth(self.student_user)
        pdf = self.client.get(
            f"/api/recorded-courses/learning/student/certificates/{certificate_id}/pdf/",
        )
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        verified = self.client.get(
            f"/api/recorded-courses/learning/certificates/verify/{certificate_id}/",
        )
        self.assertEqual(verified.status_code, 200, verified.data)
        self.assertTrue(verified.data["valid"])
