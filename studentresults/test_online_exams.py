"""Regression tests for online and mixed exams.

Run: python manage.py test studentresults.test_online_exams
"""
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import StudentProfile, TeacherProfile, User
from academics.models import (
    AcademicSession, ClassRoom, Section, StudentEnrollment,
    Subject, TeacherAssignment,
)
from institutions.models import Organization
from studentresults.models import Exam, ExamAttempt, StudentResult


class MixedOnlineExamsTests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="College Alpha", code="ALPHA-EX")
        self.other_org = Organization.objects.create(
            name="College Beta", code="BETA-EX"
        )
        self.teacher_user = User.objects.create_user(
            username="exam-teacher", password="password123",
            role="teacher", organization=self.org,
        )
        self.other_teacher_user = User.objects.create_user(
            username="foreign-exam-teacher", password="password123",
            role="teacher", organization=self.other_org,
        )
        self.student_user = User.objects.create_user(
            username="exam-student", password="password123",
            role="student", organization=self.org,
        )
        self.other_student_user = User.objects.create_user(
            username="foreign-exam-student", password="password123",
            role="student", organization=self.other_org,
        )
        self.teacher = TeacherProfile.objects.create(
            user=self.teacher_user, employee_id="EX-T1"
        )
        self.other_teacher = TeacherProfile.objects.create(
            user=self.other_teacher_user, employee_id="EX-T2"
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user, admission_number="EX-S1"
        )
        self.other_student = StudentProfile.objects.create(
            user=self.other_student_user, admission_number="EX-S2"
        )
        self.session = AcademicSession.objects.create(
            organization=self.org, name="2026 EX",
            start_date=timezone.localdate() - timedelta(days=30),
            end_date=timezone.localdate() + timedelta(days=150),
            is_active=True,
        )
        self.classroom = ClassRoom.objects.create(
            organization=self.org, academic_session=self.session,
            name="Class 10 EX",
        )
        self.section = Section.objects.create(
            organization=self.org, classroom=self.classroom, name="A"
        )
        self.subject = Subject.objects.create(
            organization=self.org, classroom=self.classroom,
            name="Science", code="SCI-EX",
        )
        self.assignment = TeacherAssignment.objects.create(
            teacher=self.teacher, subject=self.subject, section=self.section,
            is_active=True,
        )
        StudentEnrollment.objects.create(
            student=self.student, section=self.section,
            roll_number="S-10", is_active=True,
        )
        self.start_at = timezone.now() - timedelta(minutes=10)
        self.end_at = timezone.now() + timedelta(hours=1)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def create_exam(self, questions):
        self.authenticate(self.teacher_user)
        response = self.client.post(
            "/api/results/teacher/online-exams/",
            {
                "teacher_assignment_id": self.assignment.id,
                "title": "Science Mixed Test",
                "starts_at": self.start_at.isoformat(),
                "ends_at": self.end_at.isoformat(),
                "duration_minutes": 30,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        exam_id = response.data["exam"]["id"]
        response = self.client.patch(
            f"/api/results/teacher/online-exams/{exam_id}/",
            {"questions": questions}, format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.post(
            f"/api/results/teacher/online-exams/{exam_id}/open/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        return exam_id

    def test_mixed_exam_is_partially_scored_then_teacher_publishes(self):
        exam_id = self.create_exam([
            {
                "kind": "mcq", "prompt": "What is H2O?", "marks": "4",
                "choices": [
                    {"text": "Water", "is_correct": True},
                    {"text": "Oxygen", "is_correct": False},
                ],
            },
            {
                "kind": "long", "prompt": "Explain evaporation.",
                "marks": "6", "choices": [],
            },
        ])

        self.authenticate(self.student_user)
        self.assertEqual(
            self.client.get("/api/results/student/online-exams/").status_code,
            200,
        )
        response = self.client.post(
            f"/api/results/student/online-exams/{exam_id}/start/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        objective = next(q for q in response.data["questions"] if q["kind"] == "mcq")
        subjective = next(q for q in response.data["questions"] if q["kind"] == "long")
        # Correct-option flags must NEVER be sent to students.
        self.assertNotIn("is_correct", objective["choices"][0])
        answer = self.client.put(
            f"/api/results/student/online-exams/{exam_id}/questions/{objective['id']}/answer/",
            {"choice_id": objective["choices"][0]["id"]}, format="json",
        )
        self.assertEqual(answer.status_code, 200, answer.data)
        answer = self.client.put(
            f"/api/results/student/online-exams/{exam_id}/questions/{subjective['id']}/answer/",
            {"text_answer": "Heat turns water into vapor."}, format="json",
        )
        self.assertEqual(answer.status_code, 200, answer.data)
        response = self.client.post(
            f"/api/results/student/online-exams/{exam_id}/submit/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        attempt = response.data["attempt"]
        self.assertEqual(attempt["objective_marks"], "4.00")
        self.assertEqual(attempt["objective_percentage"], Decimal("100.00"))
        self.assertIsNone(attempt["overall_percentage"])
        self.assertEqual(attempt["state"], "submitted")
        attempt_id = attempt["id"]

        # Students cannot submit again or change answers afterward.
        response = self.client.put(
            f"/api/results/student/online-exams/{exam_id}/questions/{objective['id']}/answer/",
            {"choice_id": objective["choices"][1]["id"]}, format="json",
        )
        self.assertEqual(response.status_code, 409)

        self.authenticate(self.teacher_user)
        response = self.client.patch(
            f"/api/results/teacher/exams/{exam_id}/publish/",
            {"is_published": True}, format="json",
        )
        self.assertEqual(response.status_code, 400)  # grading required
        response = self.client.patch(
            f"/api/results/teacher/online-exams/{exam_id}/attempts/{attempt_id}/questions/{subjective['id']}/grade/",
            {"marks": "5", "feedback": "Good explanation."}, format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["attempt"]["overall_percentage"], Decimal("90.00"))
        self.assertEqual(
            StudentResult.objects.get(exam_id=exam_id, student=self.student).marks_obtained,
            Decimal("9.00"),
        )

        # Final result still hidden until the teacher publishes it.
        self.authenticate(self.student_user)
        response = self.client.get(
            f"/api/results/student/online-exams/{exam_id}/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["attempt"]["overall_marks"])
        self.assertIsNone(response.data["attempt"]["overall_percentage"])
        self.assertEqual(
            self.client.get("/api/results/student/").data["exams"], []
        )

        self.authenticate(self.teacher_user)
        response = self.client.patch(
            f"/api/results/teacher/exams/{exam_id}/publish/",
            {"is_published": True}, format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)

        self.authenticate(self.student_user)
        response = self.client.get(
            f"/api/results/student/online-exams/{exam_id}/"
        )
        self.assertEqual(response.data["attempt"]["overall_marks"], "9.00")
        self.assertEqual(response.data["attempt"]["overall_percentage"], Decimal("90.00"))
        self.assertEqual(
            len(self.client.get("/api/results/student/").data["exams"]), 1
        )

    def test_objective_only_auto_grades_but_requires_publication(self):
        exam_id = self.create_exam([{
            "kind": "true_false", "prompt": "Earth orbits the Sun.",
            "marks": "10", "choices": [
                {"text": "True", "is_correct": True},
                {"text": "False", "is_correct": False},
            ],
        }])
        self.authenticate(self.student_user)
        start = self.client.post(
            f"/api/results/student/online-exams/{exam_id}/start/"
        )
        question = start.data["questions"][0]
        choice = question["choices"][1]
        self.client.put(
            f"/api/results/student/online-exams/{exam_id}/questions/{question['id']}/answer/",
            {"choice_id": choice["id"]}, format="json",
        )
        response = self.client.post(
            f"/api/results/student/online-exams/{exam_id}/submit/"
        )
        self.assertEqual(response.data["attempt"]["state"], "graded")
        self.assertEqual(response.data["attempt"]["objective_marks"], "0.00")
        self.assertIsNone(response.data["attempt"]["overall_percentage"])

        self.authenticate(self.teacher_user)
        published = self.client.patch(
            f"/api/results/teacher/exams/{exam_id}/publish/",
            {"is_published": True}, format="json",
        )
        self.assertEqual(published.status_code, 200, published.data)

    def test_cross_college_and_unenrolled_student_cannot_access_exam(self):
        exam_id = self.create_exam([{
            "kind": "short", "prompt": "Explain gravity.", "marks": "5",
        }])
        self.authenticate(self.other_student_user)
        self.assertEqual(
            self.client.get(f"/api/results/student/online-exams/{exam_id}/").status_code,
            404,
        )
        self.authenticate(self.other_teacher_user)
        self.assertEqual(
            self.client.get(f"/api/results/teacher/online-exams/{exam_id}/").status_code,
            404,
        )

    def test_question_paper_cannot_be_modified_after_release(self):
        exam_id = self.create_exam([{
            "kind": "short", "prompt": "Explain gravity.", "marks": "5",
        }])
        self.authenticate(self.teacher_user)
        response = self.client.patch(
            f"/api/results/teacher/online-exams/{exam_id}/",
            {"questions": [{"kind": "long", "prompt": "Different", "marks": "2"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_student_cannot_submit_choice_from_another_question(self):
        exam_id = self.create_exam([
            {"kind": "mcq", "prompt": "First?", "marks": "2", "choices": [
                {"text": "Yes", "is_correct": True},
                {"text": "No", "is_correct": False},
            ]},
            {"kind": "mcq", "prompt": "Second?", "marks": "2", "choices": [
                {"text": "A", "is_correct": True},
                {"text": "B", "is_correct": False},
            ]},
        ])
        self.authenticate(self.student_user)
        data = self.client.post(
            f"/api/results/student/online-exams/{exam_id}/start/"
        ).data
        first, second = data["questions"]
        response = self.client.put(
            f"/api/results/student/online-exams/{exam_id}/questions/{first['id']}/answer/",
            {"choice_id": second["choices"][0]["id"]}, format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_expired_attempt_is_server_submitted(self):
        exam_id = self.create_exam([{
            "kind": "mcq", "prompt": "Question?", "marks": "5", "choices": [
                {"text": "Right", "is_correct": True},
                {"text": "Wrong", "is_correct": False},
            ],
        }])
        self.authenticate(self.student_user)
        started = self.client.post(
            f"/api/results/student/online-exams/{exam_id}/start/"
        )
        self.assertEqual(started.status_code, 200)
        attempt = ExamAttempt.objects.get(exam_id=exam_id)
        attempt.started_at = timezone.now() - timedelta(hours=2)
        attempt.save(update_fields=["started_at"])
        response = self.client.get(
            f"/api/results/student/online-exams/{exam_id}/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["attempt"]["state"], "graded")
        self.assertEqual(response.data["attempt"]["objective_marks"], "0.00")

    def test_invalid_questions_and_malicious_marks_are_rejected(self):
        self.authenticate(self.teacher_user)
        created = self.client.post(
            "/api/results/teacher/online-exams/",
            {
                "teacher_assignment_id": self.assignment.id,
                "title": "Invalid Questions",
                "starts_at": self.start_at.isoformat(),
                "ends_at": self.end_at.isoformat(),
                "duration_minutes": 30,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        exam_id = created.data["exam"]["id"]
        invalid = self.client.patch(
            f"/api/results/teacher/online-exams/{exam_id}/",
            {"questions": [{
                "kind": "mcq", "prompt": "Who?", "marks": "4",
                "choices": [
                    {"text": "One", "is_correct": True},
                    {"text": "Two", "is_correct": True},
                ],
            }]},
            format="json",
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(Exam.objects.get(pk=exam_id).questions.count(), 0)
