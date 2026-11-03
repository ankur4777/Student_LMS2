"""End-to-end API journey for Recorded Learning, using only disposable test data.

This tests real Django routes across College Admin, Teacher and Student roles.
It is NOT a real browser test and does not connect to DU or production.
FFprobe is mocked for one tiny example media upload, but playback session
authorization and heartbeat/completion checks use their real implementations.
"""
from datetime import timedelta
from decimal import Decimal
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITransactionTestCase

from accounts.models import StudentProfile, TeacherProfile, User
from institutions.models import Organization
from recordedcourses.models import (
    CourseCertificate, CourseFinalQuestion, LessonLearningProgress,
    LessonPlaybackSession, ModuleQuizQuestion, OrganizationLearningSettings,
    RecordedCourse, RecordedLesson,
)


ROOT = "/api/recorded-courses/"


class FullRecordedLearningJourneyTests(APITransactionTestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Isolated QA Learning Campus", code="P19-QA")
        self.other = Organization.objects.create(name="Other QA Campus", code="P19-OTHER")
        self.admin = User.objects.create_user(
            username="p19-admin", password="local", role="college_admin", organization=self.org,
        )
        self.teacher_user = User.objects.create_user(
            username="p19-teacher", password="local", role="teacher", organization=self.org,
        )
        self.teacher = TeacherProfile.objects.create(user=self.teacher_user, employee_id="P19-T")
        self.student_user = User.objects.create_user(
            username="p19-student", password="local", role="student",
            first_name="QA", last_name="Student", organization=self.org,
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user, admission_number="P19-S",
        )
        self.outsider = User.objects.create_user(
            username="p19-other-admin", password="local", role="college_admin",
            organization=self.other,
        )
        OrganizationLearningSettings.objects.create(organization=self.org, is_enabled=True)
        student_feature = patch(
            "recordedcourses.learning_access.student_feature_is_enabled", return_value=True,
        )
        student_feature.start()
        self.addCleanup(student_feature.stop)

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def expect(self, response, status):
        self.assertEqual(response.status_code, status, getattr(response, "data", None))
        return response.data

    def create_course(self):
        self.auth(self.admin)
        data = self.expect(self.client.post(
            ROOT + "college-admin/courses/",
            {
                "title": "QA Certificate Journey", "description": "Testing only",
                "price": "0.00", "access_duration_days": 45,
            }, format="json",
        ), 201)
        return data["course"]["id"]

    def create_module(self, course_id, position):
        result = self.expect(self.client.post(
            ROOT + f"learning/manage/courses/{course_id}/modules/",
            {"title": f"Stage {position}", "position": position}, format="json",
        ), 201)
        return result["module"]["id"]

    def upload_lesson(self, module_id, label):
        with patch("recordedcourses.learning_content.probe_video_duration", return_value=4.0):
            result = self.expect(self.client.post(
                ROOT + f"learning/manage/modules/{module_id}/lessons/",
                {
                    "title": label,
                    "video": SimpleUploadedFile(
                        "four-seconds.mp4", b"mock tiny video content", content_type="video/mp4",
                    ),
                }, format="multipart",
            ), 201)
        return result["lesson"]["id"]

    def complete_video(self, lesson_id):
        url = ROOT + f"learning/student/lessons/{lesson_id}/"
        ticket = self.expect(self.client.post(url + "viewing-session/"), 200)["ticket"]
        # Simulate four elapsed seconds without a real sleep.
        LessonPlaybackSession.objects.filter(
            lesson_id=lesson_id, student=self.student,
        ).update(
            started_at=timezone.now() - timedelta(seconds=4),
            last_heartbeat_at=timezone.now() - timedelta(seconds=4),
        )
        milestone = self.expect(self.client.post(
            url + "heartbeat/",
            {
                "playback_ticket": ticket,
                "position_seconds": 4, "duration_seconds": 4,
            }, format="json",
        ), 200)
        self.assertTrue(milestone["accepted"])
        self.assertGreaterEqual(milestone["milestone_percent"], 80)
        finished = self.expect(self.client.post(
            url + "complete/", {"playback_ticket": ticket}, format="json",
        ), 200)
        self.assertTrue(finished["completed"])
        self.assertEqual(
            LessonLearningProgress.objects.get(
                student=self.student, lesson_id=lesson_id,
            ).completion_method,
            LessonLearningProgress.CompletionMethod.SESSION,
        )

    def test_admin_teacher_student_to_verified_certificate_with_revoke(self):
        field = RecordedLesson._meta.get_field("video")
        original_storage = field.storage
        with TemporaryDirectory() as tmp:
            field.storage = FileSystemStorage(location=tmp)
            try:
                self.run_journey()
            finally:
                field.storage = original_storage

    def run_journey(self):
        course_id = self.create_course()
        module1 = self.create_module(course_id, 1)
        module2 = self.create_module(course_id, 2)
        assign_url = ROOT + f"learning/manage/courses/{course_id}/teachers/"
        self.expect(self.client.post(
            assign_url, {"teacher_id": self.teacher.pk}, format="json",
        ), 200)

        lesson1 = self.upload_lesson(module1, "Watch the fundamentals")
        lesson2 = self.upload_lesson(module2, "Watch the advanced lecture")
        self.assertEqual(RecordedLesson.objects.get(pk=lesson1).verified_duration_seconds, 4.0)
        for module in (module1, module2):
            self.expect(self.client.patch(
                ROOT + f"learning/manage/modules/{module}/",
                {"is_published": True}, format="json",
            ), 200)

        self.auth(self.teacher_user)
        quiz_url = ROOT + f"learning/manage/modules/{module1}/quiz/"
        self.expect(self.client.put(
            quiz_url,
            {"title": "Understanding Check", "passing_percent": 70, "max_attempts": 2},
            format="json",
        ), 200)
        self.expect(self.client.post(
            quiz_url + "questions/",
            {"prompt": "Which is two?", "choices": ["1", "2"], "correct_index": 1},
            format="json",
        ), 201)
        self.assertEqual(self.client.patch(
            quiz_url, {"is_published": True}, format="json",
        ).status_code, 403)
        quiz_question = ModuleQuizQuestion.objects.get(quiz__module_id=module1)

        assignment_url = ROOT + f"learning/manage/modules/{module1}/assignment/"
        self.expect(self.client.put(
            assignment_url,
            {"title": "Practice", "instructions": "Describe the lesson.", "passing_percent": 60},
            format="json",
        ), 200)
        self.assertEqual(self.client.patch(
            assignment_url, {"is_published": True}, format="json",
        ).status_code, 403)

        final_url = ROOT + f"learning/manage/courses/{course_id}/final-exam/"
        self.expect(self.client.put(
            final_url, {"title": "Certificate Final", "passing_percent": 70, "max_attempts": 2},
            format="json",
        ), 200)
        self.expect(self.client.post(
            final_url + "questions/",
            {"prompt": "Select the pass option.", "choices": ["Fail", "Pass"], "correct_index": 1},
            format="json",
        ), 201)
        self.assertEqual(self.client.patch(
            final_url, {"is_published": True}, format="json",
        ).status_code, 403)
        final_question = CourseFinalQuestion.objects.get(exam__course_id=course_id)

        self.auth(self.admin)
        self.expect(self.client.patch(quiz_url, {"is_published": True}, format="json"), 200)
        self.expect(self.client.patch(assignment_url, {"is_published": True}, format="json"), 200)
        self.expect(self.client.patch(final_url, {"is_published": True}, format="json"), 200)
        enrollment_url = ROOT + f"learning/manage/courses/{course_id}/enrollments/"
        # A student without course access must not see content or start playback.
        self.auth(self.student_user)
        self.assertEqual(
            self.expect(self.client.get(ROOT + "learning/student/courses/"), 200)["courses"], [],
        )
        self.assertEqual(
            self.client.get(ROOT + f"learning/student/courses/{course_id}/").status_code, 403,
        )
        self.assertEqual(
            self.client.post(
                ROOT + f"learning/student/lessons/{lesson1}/viewing-session/",
            ).status_code, 403,
        )
        self.auth(self.admin)
        self.expect(self.client.post(
            enrollment_url, {"student_id": self.student.pk, "duration_days": 45}, format="json",
        ), 201)
        self.assertEqual(self.client.post(
            enrollment_url, {"student_id": self.student.pk, "duration_days": 90}, format="json",
        ).status_code, 409)  # Duplicate grants must not silently extend access.
        readiness = self.expect(self.client.get(
            ROOT + f"learning/manage/courses/{course_id}/readiness/",
        ), 200)
        self.assertTrue(readiness["ready_for_final_exam"])

        self.auth(self.outsider)
        self.assertEqual(self.client.get(
            ROOT + f"learning/manage/courses/{course_id}/progress/",
        ).status_code, 403)
        self.auth(self.student_user)
        listings = self.expect(self.client.get(ROOT + "learning/student/courses/"), 200)
        self.assertIn(str(course_id), str(listings))
        detail_url = ROOT + f"learning/student/courses/{course_id}/"
        first = self.expect(self.client.get(detail_url), 200)
        modules = first["course"]["modules"]
        self.assertFalse(modules[0]["locked"])
        self.assertTrue(modules[1]["locked"])
        student_final_url = ROOT + f"learning/student/courses/{course_id}/final-exam/"
        self.assertFalse(self.expect(self.client.get(student_final_url), 200)["exam"]["unlocked"])
        self.assertEqual(self.client.post(
            student_final_url, {"answers": {str(final_question.pk): 1}}, format="json",
        ).status_code, 403)
        # A later module stays inaccessible even when its ID is known.
        self.assertEqual(self.client.get(
            ROOT + f"learning/student/lessons/{lesson2}/play/",
        ).status_code, 403)
        # Video completion requires a signed viewing session and watch credit.
        first_lesson_url = ROOT + f"learning/student/lessons/{lesson1}/"
        self.assertEqual(self.client.post(
            first_lesson_url + "complete/", format="json",
        ).status_code, 400)
        early_ticket = self.expect(self.client.post(
            first_lesson_url + "viewing-session/",
        ), 200)["ticket"]
        self.assertEqual(self.client.post(
            first_lesson_url + "complete/",
            {"playback_ticket": early_ticket}, format="json",
        ).status_code, 400)
        self.assertFalse(LessonLearningProgress.objects.exists())

        self.complete_video(lesson1)
        middle = self.expect(self.client.get(detail_url), 200)
        self.assertTrue(middle["course"]["modules"][1]["locked"])
        quiz_student_url = ROOT + f"learning/student/modules/{module1}/quiz/"
        quiz_before = self.expect(self.client.get(quiz_student_url), 200)
        self.assertNotIn("correct_index", str(quiz_before))
        quiz_attempt = self.expect(self.client.post(
            quiz_student_url, {"answers": {str(quiz_question.pk): 1}}, format="json",
        ), 201)
        self.assertTrue(quiz_attempt["attempt"]["passed"])

        assignment_student_url = ROOT + f"learning/student/modules/{module1}/assignment/"
        submitted = self.expect(self.client.post(
            assignment_student_url, {"answer_text": "My QA practice answer"}, format="json",
        ), 201)
        submission_id = submitted["submission"]["id"]
        self.assertTrue(self.expect(self.client.get(detail_url), 200)["course"]["modules"][1]["locked"])
        grade_url = ROOT + f"learning/manage/submissions/{submission_id}/grade/"
        unassigned = User.objects.create_user(
            username="p23-unassigned-teacher", password="local", role="teacher",
            organization=self.org,
        )
        TeacherProfile.objects.create(user=unassigned, employee_id="P23-UNASSIGNED")
        self.auth(unassigned)
        self.assertEqual(self.client.patch(
            grade_url, {"score_percent": 99}, format="json",
        ).status_code, 404)
        self.auth(self.outsider)
        # A disabled tenant is rejected by the organization feature gate
        # before its submission visibility is checked.
        self.assertEqual(self.client.patch(
            grade_url, {"score_percent": 99}, format="json",
        ).status_code, 403)
        # With Learning enabled, this separate tenant still cannot see or
        # grade another organization's submission.
        OrganizationLearningSettings.objects.create(
            organization=self.other, is_enabled=True,
        )
        self.assertEqual(self.client.patch(
            grade_url, {"score_percent": 99}, format="json",
        ).status_code, 404)
        self.auth(self.teacher_user)
        self.expect(self.client.patch(
            grade_url, {"score_percent": 88, "feedback": "Passed"}, format="json",
        ), 200)
        self.auth(self.student_user)
        self.assertFalse(self.expect(self.client.get(detail_url), 200)["course"]["modules"][1]["locked"])
        self.complete_video(lesson2)

        final = self.expect(self.client.get(student_final_url), 200)
        self.assertTrue(final["exam"]["unlocked"])
        self.assertNotIn("correct_index", str(final))
        issued = self.expect(self.client.post(
            student_final_url, {"answers": {str(final_question.pk): 1}}, format="json",
        ), 201)
        self.assertTrue(issued["attempt"]["passed"])
        cert_id = issued["certificate_id"]
        self.assertTrue(cert_id)
        self.assertEqual(CourseCertificate.objects.filter(course_id=course_id).count(), 1)
        self.assertEqual(self.client.post(
            student_final_url, {"answers": {str(final_question.pk): 1}}, format="json",
        ).status_code, 409)
        # An unenrolled student from the same organization cannot read an
        # earned certificate PDF through another student's private endpoint.
        other_user = User.objects.create_user(
            username="p23-other-student", password="local", role="student",
            organization=self.org,
        )
        StudentProfile.objects.create(user=other_user, admission_number="P23-OTHER")
        self.auth(other_user)
        self.assertIn(self.client.get(
            ROOT + f"learning/student/certificates/{cert_id}/pdf/",
        ).status_code, (403, 404))
        self.auth(self.student_user)

        pdf = self.client.get(
            ROOT + f"learning/student/certificates/{cert_id}/pdf/",
        )
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(pdf["Content-Type"].startswith("application/pdf"))
        pdf.close()
        self.client.force_authenticate(user=None)
        public_url = ROOT + f"learning/certificates/verify/{cert_id}/"
        self.assertTrue(self.expect(self.client.get(public_url), 200)["valid"])

        self.auth(self.admin)
        report = self.expect(self.client.get(
            ROOT + f"learning/manage/courses/{course_id}/progress/",
        ), 200)
        self.assertEqual(report["students"][0]["progress_percent"], 100)
        self.assertTrue(report["students"][0]["final_exam_passed"])
        self.assertEqual(report["students"][0]["certificate_status"], "issued")
        analytics = self.expect(self.client.get(ROOT + "learning/manage/analytics/"), 200)
        self.assertEqual(analytics["totals"]["valid_certificates"], 1)
        for csv_path in (
            ROOT + f"learning/manage/courses/{course_id}/progress/export.csv",
            ROOT + "learning/manage/analytics/export.csv",
        ):
            exported = self.client.get(csv_path)
            self.assertEqual(exported.status_code, 200)
            self.assertIn("text/csv", exported["Content-Type"])
            self.assertIn("attachment;", exported["Content-Disposition"])
        revoke = self.expect(self.client.patch(
            ROOT + f"learning/manage/courses/{course_id}/certificates/",
            {"certificate_id": cert_id, "reason": "QA certificate revocation"}, format="json",
        ), 200)
        self.assertEqual(revoke["status"], "revoked")
        self.assertEqual(
            self.expect(self.client.get(ROOT + "learning/manage/analytics/"), 200)[
                "totals"
            ]["valid_certificates"], 0,
        )
        self.client.force_authenticate(user=None)
        self.assertFalse(self.expect(self.client.get(public_url), 200)["valid"])
        self.auth(self.student_user)
        self.assertEqual(
            self.client.get(ROOT + f"learning/student/certificates/{cert_id}/pdf/").status_code,
            410,
        )
