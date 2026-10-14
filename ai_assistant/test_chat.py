from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import StudentProfile, TeacherProfile, User
from academics.models import (
    AcademicSession, ClassFeatureAccess, ClassRoom, Section,
    StudentEnrollment, Subject, SubjectStudentAccess, TeacherAssignment,
)
from assignments.models import Assignment, AssignmentSubmission
from documents.models import Document
from institutions.models import Organization
from studentresults.models import Exam, StudentResult

from .dashboard_data import student_dashboard_facts
from .provider import AIProviderUnavailable, generate_reply
from .student_context import get_authorized_student_context

CHAT_URL = "/api/ai-assistant/chat/"


class StudentAIChatSecurityTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.college = Organization.objects.create(name="College A", code="ai-chat-a")
        self.foreign_college = Organization.objects.create(name="College B", code="ai-chat-b")
        self.user = User.objects.create_user(
            username="chat-student-a", password="testpass", role="student",
            organization=self.college, first_name="Student",
        )
        self.profile = StudentProfile.objects.create(
            user=self.user, admission_number="A001"
        )
        self.session = AcademicSession.objects.create(
            organization=self.college, name="2026", start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31), is_active=True,
        )
        self.classroom = ClassRoom.objects.create(
            organization=self.college, academic_session=self.session, name="Digital"
        )
        self.section = Section.objects.create(
            organization=self.college, classroom=self.classroom, name="A",
        )
        StudentEnrollment.objects.create(
            student=self.profile, section=self.section, roll_number="1", is_active=True
        )
        self.science = Subject.objects.create(
            organization=self.college, classroom=self.classroom,
            name="Meta Ads",
        )
        self.excluded = Subject.objects.create(
            organization=self.college, classroom=self.classroom,
            name="Mathematics",
        )
        SubjectStudentAccess.objects.create(
            subject=self.excluded, student=self.profile, is_enrolled=False
        )
        self.selected = Subject.objects.create(
            organization=self.college, classroom=self.classroom,
            name="English", student_assignment_mode="selected",
        )
        SubjectStudentAccess.objects.create(
            subject=self.selected, student=self.profile, is_enrolled=True
        )

        other_class = ClassRoom.objects.create(
            organization=self.college, academic_session=self.session, name="Science"
        )
        self.outside_subject = Subject.objects.create(
            organization=self.college, classroom=other_class, name="History",
        )
        foreign_session = AcademicSession.objects.create(
            organization=self.foreign_college, name="2026",
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        )
        foreign_class = ClassRoom.objects.create(
            organization=self.foreign_college, academic_session=foreign_session, name="A",
        )
        self.foreign_subject = Subject.objects.create(
            organization=self.foreign_college,
            classroom=foreign_class,
            name="Foreign Marketing",
        )
        SubjectStudentAccess.objects.create(
            subject=self.foreign_subject, student=self.profile, is_enrolled=True,
        )

        self.teacher_user = User.objects.create_user(
            username="chat-teacher-a", password="testpass", role="teacher",
            organization=self.college,
        )
        self.teacher = TeacherProfile.objects.create(
            user=self.teacher_user, employee_id="CHAT-T001"
        )
        self.assignment = TeacherAssignment.objects.create(
            teacher=self.teacher, subject=self.science, section=self.section,
        )
        ClassFeatureAccess.objects.create(
            organization=self.college, classroom=self.classroom,
            feature_key="ai_assistant", is_enabled=True,
        )

    def login(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    @patch("ai_assistant.views.generate_reply", return_value="Meta Ads explanation")
    def test_selected_subject_passes_authorized_metadata_only(self, generation):
        Document.objects.create(
            organization=self.college,
            uploaded_by=self.teacher_user,
            teacher_assignment=self.assignment,
            title="Ad Campaign Notes",
            description="How to set up a campaign.",
            file="documents/notes.txt",
            is_published=True,
        )
        Document.objects.create(
            organization=self.college,
            uploaded_by=self.teacher_user,
            teacher_assignment=self.assignment,
            title="Secret Teacher Notes",
            description="Unpublished",
            file="documents/secret.txt",
            is_published=False,
        )
        self.login()
        response = self.client.post(CHAT_URL, {
            "mode": "tutor",
            "subject_id": self.science.id,
            "message": "Explain campaign objectives",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["reply"], "Meta Ads explanation")
        kwargs = generation.call_args.kwargs
        self.assertEqual(kwargs["subject"]["name"], "Meta Ads")
        self.assertEqual(len(kwargs["data"]["study_materials"]), 1)
        self.assertEqual(
            kwargs["data"]["study_materials"][0]["title"], "Ad Campaign Notes"
        )
        self.assertNotIn("Secret Teacher Notes", str(kwargs["data"]))

    @patch("ai_assistant.views.generate_reply", return_value="Learning")
    def test_allowed_and_excluded_subjects(self, generation):
        self.login()
        allowed = self.client.post(CHAT_URL, {
            "mode": "tutor", "subject_id": self.selected.id, "message": "Teach English",
        }, format="json")
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(generation.call_count, 1)
        for subject in [self.excluded, self.outside_subject, self.foreign_subject]:
            denied = self.client.post(CHAT_URL, {
                "mode": "tutor", "subject_id": subject.id,
                "message": "Teach me this topic",
            }, format="json")
            self.assertEqual(denied.status_code, 403)
        self.assertEqual(generation.call_count, 1)

    @patch("ai_assistant.views.generate_reply", return_value="Read-only response")
    def test_dashboard_filters_unpublished_and_foreign_results(self, generation):
        exam = Exam.objects.create(
            organization=self.college, section=self.section, name="Published",
            exam_date=date(2026, 10, 10), is_published=True,
        )
        draft = Exam.objects.create(
            organization=self.college, section=self.section, name="Draft",
            exam_date=date(2026, 10, 11), is_published=False,
        )
        StudentResult.objects.create(
            exam=exam, student=self.profile, subject=self.science,
            teacher=self.teacher, marks_obtained=Decimal("88"),
            maximum_marks=Decimal("100"),
        )
        StudentResult.objects.create(
            exam=draft, student=self.profile, subject=self.science,
            teacher=self.teacher, marks_obtained=Decimal("5"),
            maximum_marks=Decimal("100"),
        )
        Assignment.objects.create(
            organization=self.college, teacher_assignment=self.assignment,
            title="Marketing homework", due_date=date(2026, 10, 25),
            is_published=True,
        )
        Assignment.objects.create(
            organization=self.college, teacher_assignment=self.assignment,
            title="Secret assignment", due_date=date(2026, 10, 25),
            is_published=False,
        )

        self.login()
        response = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "Show my results and assignments",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        context = generation.call_args.kwargs["data"]
        self.assertEqual(len(context["published_results"]), 1)
        self.assertEqual(context["published_results"][0]["exam"], "Published")
        self.assertEqual(len(context["assignments"]), 1)
        self.assertEqual(context["assignments"][0]["title"], "Marketing homework")
        self.assertNotIn("Draft", str(context))
        self.assertNotIn("Secret assignment", str(context))
        self.assertNotIn("Foreign Marketing", str(context))

    @patch("ai_assistant.views.generate_reply", return_value="Read-only response")
    def test_class_restrictions_hide_dashboard_modules(self, generation):
        ClassFeatureAccess.objects.create(
            organization=self.college, classroom=self.classroom,
            feature_key="results", is_enabled=False,
        )
        ClassFeatureAccess.objects.create(
            organization=self.college, classroom=self.classroom,
            feature_key="assignments", is_enabled=False,
        )
        self.login()
        response = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "Show me my marks",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("restricted", response.data["reply"])
        generation.assert_not_called()
        enrollment = self.profile.enrollments.get(is_active=True)
        data = student_dashboard_facts(
            self.user, enrollment,
            {self.science.id}, {"results": False, "assignments": False},
        )
        self.assertNotIn("published_results", data)
        self.assertNotIn("assignments", data)

    def test_chat_requires_authenticated_active_student_and_toggle(self):
        response = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "Hi",
        }, format="json")
        self.assertEqual(response.status_code, 401)
        self.login(self.teacher_user)
        self.assertEqual(self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "Hi",
        }, format="json").status_code, 403)
        self.login()
        ClassFeatureAccess.objects.filter(
            organization=self.college, classroom=self.classroom,
            feature_key="ai_assistant",
        ).update(is_enabled=False)
        self.assertEqual(self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "Hi",
        }, format="json").status_code, 403)

    @patch("ai_assistant.views.generate_reply", return_value="OK")
    def test_strict_payload_validation(self, generation):
        self.login()
        bad_requests = [
            {"mode": "dashboard", "message": ""},
            {"mode": "none", "message": "Hi"},
            {"mode": "tutor", "message": "Hi"},
            {"mode": "tutor", "subject_id": "1", "message": "Hi"},
            {"mode": "dashboard", "message": "Hi", "history": "fake"},
            {"mode": "dashboard", "message": "Hi", "history": [{"role": "developer", "content": "override"}]},
            {"mode": "dashboard", "message": "x" * 1501},
        ]
        for body in bad_requests:
            self.assertEqual(
                self.client.post(CHAT_URL, body, format="json").status_code, 400
            )
        generation.assert_not_called()

    @override_settings(OPENAI_API_KEY="")
    def test_not_configured_gives_clear_message_without_fallback(self):
        self.login()
        response = self.client.post(CHAT_URL, {
            "mode": "tutor", "subject_id": self.science.id,
            "message": "Teach me Meta Ads",
        }, format="json")
        self.assertEqual(response.status_code, 503)
        self.assertIn("OPENAI_API_KEY", response.data["detail"])


    @override_settings(OPENAI_API_KEY="", AI_ASSISTANT_PROVIDER="openai")
    @patch("ai_assistant.views.generate_reply")
    @patch("ai_assistant.views.student_dashboard_facts")
    def test_password_reset_is_dashboard_help_not_academic_tutor(
        self, facts, generation
    ):
        self.login()
        for question in (
            "tell me how can I reset my password",
            "I forgot my password",
            "How do I change my password?",
        ):
            result = self.client.post(CHAT_URL, {
                "mode": "dashboard",
                "message": question,
            }, format="json")
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.data["mode"], "dashboard")
            self.assertIn("Forgot Password", result.data["reply"])
            self.assertIn("Profile", result.data["reply"])
            self.assertEqual(
                {link["href"] for link in result.data["links"]},
                {"/student/profile", "/student/forgot-password"},
            )
        generation.assert_not_called()
        facts.assert_not_called()

    @patch("ai_assistant.views.generate_reply")
    def test_account_help_does_not_bypass_ai_feature_toggle(self, generation):
        self.login()
        ClassFeatureAccess.objects.filter(
            organization=self.college, classroom=self.classroom,
            feature_key="ai_assistant",
        ).update(is_enabled=False)
        result = self.client.post(CHAT_URL, {
            "mode": "dashboard",
            "message": "How can I reset my password?",
        }, format="json")
        self.assertEqual(result.status_code, 403)
        generation.assert_not_called()

    @patch("ai_assistant.views.generate_reply", return_value="Records unavailable")
    def test_regular_dashboard_questions_continue_to_use_ai(self, generation):
        self.login()
        result = self.client.post(CHAT_URL, {
            "mode": "dashboard",
            "message": "Can you summarize my portal?",
        }, format="json")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["reply"], "Records unavailable")
        generation.assert_called_once()


    @patch("ai_assistant.views.generate_reply")
    def test_recorded_classes_answer_uses_current_student_and_purchase_access(self, generation):
        from liveclasses.models import LiveClass, LiveClassRecording
        from recordedcourses.models import RecordedClassAccess

        completed = LiveClass.objects.create(
            organization=self.college,
            teacher_assignment=self.assignment,
            title="Meta Ads Recording",
            class_date=date(2026, 10, 10),
            start_time="10:00:00",
            end_time="11:00:00",
            status=LiveClass.Status.COMPLETED,
        )
        recording = LiveClassRecording.objects.create(
            live_class=completed, uploaded_by=self.teacher,
            video="private/test.mp4",
            title="Meta Ads Lecture 1", is_available=True,
            price=Decimal("99.00"),
        )
        self.login()
        response = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "tell me about my recorded classes",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Meta Ads Lecture 1", response.data["reply"])
        self.assertIn("requires a purchase", response.data["reply"])
        self.assertIn("/student/recorded-classes", str(response.data["links"]))

        RecordedClassAccess.objects.create(
            organization=self.college, student=self.profile, recording=recording,
        )
        response = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "tell me about my recorded classes",
        }, format="json")
        self.assertIn("currently have access", response.data["reply"])
        generation.assert_not_called()

        ClassFeatureAccess.objects.create(
            organization=self.college, classroom=self.classroom,
            feature_key="recorded_classes", is_enabled=False,
        )
        response = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "tell me about my recorded classes",
        }, format="json")
        self.assertIn("restricted", response.data["reply"])
        self.assertNotIn("Meta Ads Lecture 1", response.data["reply"])

    @patch("ai_assistant.views.generate_reply")
    def test_online_exams_publish_only_final_results(self, generation):
        from datetime import timedelta
        from django.utils import timezone
        from studentresults.models import ExamAttempt

        exam = Exam.objects.create(
            organization=self.college, section=self.section,
            name="Meta Ads Online Quiz", exam_date=date(2026, 10, 14),
            online_teacher_assignment=self.assignment, online_is_open=True,
            online_starts_at=timezone.now(),
            online_ends_at=timezone.now() + timedelta(hours=2),
            is_published=False,
        )
        ExamAttempt.objects.create(
            exam=exam, student=self.profile,
            state=ExamAttempt.State.GRADED,
            objective_marks=Decimal("22"), subjective_marks=Decimal("17"),
        )
        self.login()
        response = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "tell me about my online exam",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Meta Ads Online Quiz", response.data["reply"])
        self.assertIn("Final result not published", response.data["reply"])
        self.assertNotIn("39.00", response.data["reply"])

        exam.is_published = True
        exam.save(update_fields=["is_published"])
        response = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "tell me about my online exam",
        }, format="json")
        self.assertIn("Published final marks: 39.00", response.data["reply"])
        generation.assert_not_called()

    @patch("ai_assistant.views.generate_reply")
    def test_recorded_courses_and_notices_from_authorized_portal(self, generation):
        from recordedcourses.models import RecordedCourse, RecordedCourseAccess
        from notices.models import Notice
        from notifications.models import Notification

        course = RecordedCourse.objects.create(
            organization=self.college, title="Meta Ads Advanced",
            description="Advanced campaigns", price=Decimal("999.00"),
        )
        Notice.objects.create(
            organization=self.college, title="College Event",
            message="The college will host an event.",
            audience=Notice.Audience.STUDENTS, created_by=self.teacher_user,
        )
        Notification.objects.create(
            organization=self.college, user=self.user,
            title="New Message", message="Welcome student",
        )
        Notification.objects.create(
            organization=self.foreign_college, user=self.teacher_user,
            title="Foreign Notification", message="Should be private",
        )
        self.login()

        response = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "show my recorded courses",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Meta Ads Advanced", response.data["reply"])
        self.assertIn("Access not active", response.data["reply"])
        RecordedCourseAccess.objects.create(
            organization=self.college, course=course, student=self.profile,
        )
        response = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "show my recorded courses",
        }, format="json")
        self.assertIn("Purchased/access active", response.data["reply"])

        notice = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "show notices",
        }, format="json")
        self.assertIn("College Event", notice.data["reply"])
        notifications = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "show notifications",
        }, format="json")
        self.assertIn("New Message", notifications.data["reply"])
        self.assertNotIn("Foreign Notification", notifications.data["reply"])
        generation.assert_not_called()


class AIProviderSafetyTests(TestCase):
    @override_settings(OPENAI_API_KEY="local-test-key", AI_ASSISTANT_MODEL="test-model")
    @patch("ai_assistant.provider.urlopen")
    def test_off_topic_model_answer_is_not_returned(self, urlopen_mock):
        from io import BytesIO

        class FakeHTTPResponse:
            def __enter__(self):
                return self
            def __exit__(self, exc_type, exc, tb):
                return False
            def read(self):
                return b'{"choices":[{"message":{"content":"{\\\"allowed\\\": false, \\\"answer\\\": \\\"Out of scope\\\"}"}}]}'

        urlopen_mock.return_value = FakeHTTPResponse()
        reply = generate_reply(
            message="Teach an unrelated subject", history=[], mode="tutor",
            student_context={"student": {"name": "A"}},
            data={"study_materials": []},
            subject={"id": 1, "name": "Meta Ads"},
        )
        self.assertIn("Meta Ads", reply)
        self.assertNotIn("Out of scope", reply)


class OllamaProviderTests(TestCase):
    @override_settings(
        AI_ASSISTANT_PROVIDER="ollama",
        OPENAI_API_KEY="",
        OLLAMA_MODEL="qwen2.5:1.5b",
        OLLAMA_BASE_URL="http://127.0.0.1:11434",
        OLLAMA_TIMEOUT=30,
        OLLAMA_NUM_CTX=4096,
    )
    @patch("ai_assistant.provider.urlopen")
    def test_ollama_generates_reply_without_openai_key(self, mocked_urlopen):
        import json

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def read(self):
                return json.dumps({
                    "message": {
                        "role": "assistant",
                        "content": json.dumps({
                            "allowed": True,
                            "answer": "Meta Ads can help reach a specific audience.",
                        }),
                    }
                }).encode("utf-8")

        mocked_urlopen.return_value = FakeResponse()
        reply = generate_reply(
            message="Explain Meta Ads",
            history=[],
            mode="tutor",
            student_context={"student": {"name": "Test Student"}},
            data={"study_materials": []},
            subject={"name": "Meta Ads", "id": 5},
        )
        self.assertEqual(reply, "Meta Ads can help reach a specific audience.")
        request = mocked_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "http://127.0.0.1:11434/api/chat")
        self.assertNotIn("Authorization", request.headers)
        sent = json.loads(request.data.decode("utf-8"))
        self.assertEqual(sent["model"], "qwen2.5:1.5b")
        self.assertFalse(sent["stream"])
        self.assertEqual(sent["format"], "json")
        self.assertEqual(sent["messages"][0]["role"], "system")
        self.assertEqual(sent["options"]["num_ctx"], 4096)

    @override_settings(
        AI_ASSISTANT_PROVIDER="ollama",
        OLLAMA_BASE_URL="http://127.0.0.1:11434",
        OLLAMA_MODEL="qwen2.5:1.5b",
    )
    @patch("ai_assistant.provider.urlopen")
    def test_ollama_refuses_off_topic_response(self, mocked_urlopen):
        import json

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def read(self):
                return json.dumps({
                    "message": {"content": json.dumps({
                        "allowed": False, "answer": "Forbidden external subject."
                    })},
                }).encode("utf-8")

        mocked_urlopen.return_value = FakeResponse()
        reply = generate_reply(
            message="Teach me an unrelated subject",
            history=[],
            mode="tutor",
            student_context={"student": {"name": "Test Student"}},
            data={"study_materials": []},
            subject={"name": "Meta Ads", "id": 5},
        )
        self.assertIn("Meta Ads", reply)
        self.assertNotIn("Forbidden external subject", reply)

    @override_settings(
        AI_ASSISTANT_PROVIDER="ollama",
        OLLAMA_BASE_URL="http://example.com:11434",
        OLLAMA_MODEL="qwen2.5:1.5b",
    )
    @patch("ai_assistant.provider.urlopen")
    def test_ollama_cannot_send_student_data_to_remote_http_host(self, mocked_urlopen):
        with self.assertRaises(AIProviderUnavailable):
            generate_reply(
                message="What is my attendance?",
                history=[],
                mode="dashboard",
                student_context={"student": {"name": "Student"}},
                data={"attendance": {"percentage": 95}},
            )
        mocked_urlopen.assert_not_called()

    @override_settings(
        AI_ASSISTANT_PROVIDER="ollama",
        OLLAMA_BASE_URL="http://127.0.0.1:11434",
        OLLAMA_MODEL="qwen2.5:1.5b",
    )
    @patch("ai_assistant.provider.urlopen")
    def test_ollama_unavailable_returns_safe_configuration_message(self, mocked_urlopen):
        from urllib.error import URLError
        mocked_urlopen.side_effect = URLError("connection refused")
        with self.assertRaisesRegex(AIProviderUnavailable, "local Ollama"):
            generate_reply(
                message="Explain Meta Ads",
                history=[],
                mode="tutor",
                student_context={"student": {"name": "Student"}},
                data={"study_materials": []},
                subject={"name": "Meta Ads", "id": 5},
            )
