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

    @patch("ai_assistant.views.generate_reply", return_value="Grounded explanation")
    def test_uploaded_pdf_excerpts_are_available_for_authorized_subject(self, generation):
        from io import BytesIO
        from tempfile import TemporaryDirectory
        from unittest.mock import patch as mock_patch

        from django.core.files.uploadedfile import SimpleUploadedFile
        from reportlab.pdfgen import canvas
        from documents.models import private_document_storage

        output = BytesIO()
        pdf = canvas.Canvas(output)
        pdf.drawString(
            40, 740,
            "Ad auction total value = (Bid x Estimated Action Rate) + Ad Quality.",
        )
        pdf.showPage()
        pdf.drawString(
            40, 740, "Exit learning phase = 50 conversions per ad set per week.",
        )
        pdf.save()

        with TemporaryDirectory() as temp_dir, mock_patch.object(
            private_document_storage, "_location", temp_dir
        ):
            Document.objects.create(
                organization=self.college, uploaded_by=self.teacher_user,
                teacher_assignment=self.assignment, title="Meta Ads Reference",
                description="Lesson presentation",
                file=SimpleUploadedFile(
                    "reference.pdf", output.getvalue(), content_type="application/pdf"
                ),
                is_published=True,
            )
            self.login()
            response = self.client.post(CHAT_URL, {
                "mode": "tutor", "subject_id": self.science.id,
                "message": "According to uploaded PDF, what is the ad auction total value formula?",
            }, format="json")
            self.assertEqual(response.status_code, 200, response.data)
            materials = generation.call_args.kwargs["data"]["study_materials"]
            self.assertEqual(len(materials), 1)
            self.assertEqual(materials[0]["title"], "Meta Ads Reference")
            self.assertTrue(materials[0]["excerpts"])
            self.assertEqual(materials[0]["excerpts"][0]["page"], 1)
            self.assertIn("Estimated Action Rate", materials[0]["excerpts"][0]["text"])

            generation.reset_mock()
            second = self.client.post(CHAT_URL, {
                "mode": "tutor", "subject_id": self.science.id,
                "message": "According to the PDF, how many conversions per week exit learning phase?",
            }, format="json")
            self.assertEqual(second.status_code, 200, second.data)
            excerpts = generation.call_args.kwargs["data"]["study_materials"][0]["excerpts"]
            self.assertTrue(any("50 conversions" in item["text"] for item in excerpts))

            # Disabling Documents must immediately remove private PDF excerpts.
            ClassFeatureAccess.objects.create(
                organization=self.college, classroom=self.classroom,
                feature_key="documents", is_enabled=False,
            )
            generation.reset_mock()
            restricted = self.client.post(CHAT_URL, {
                "mode": "tutor", "subject_id": self.science.id,
                "message": "According to uploaded PDF what is the ad auction total value?",
            }, format="json")
            self.assertEqual(restricted.status_code, 200)
            self.assertEqual(
                generation.call_args.kwargs["data"]["study_materials"], []
            )

    @patch("ai_assistant.views.generate_reply", return_value="Answer")
    @patch("ai_assistant.dashboard_data.pdf_excerpts")
    def test_pdf_retrieval_excludes_drafts_wrong_section_and_foreign_college(
        self, excerpts, generation
    ):
        other_section = Section.objects.create(
            organization=self.college, classroom=self.classroom, name="B"
        )
        other_assignment = TeacherAssignment.objects.create(
            teacher=self.teacher, subject=self.science, section=other_section
        )
        foreign_teacher = User.objects.create_user(
            username="foreign-pdf-teacher", password="pass", role="teacher",
            organization=self.foreign_college,
        )
        foreign_profile = TeacherProfile.objects.create(
            user=foreign_teacher, employee_id="FOREIGN-PDF-01"
        )
        foreign_section = self.foreign_subject.classroom.sections.create(
            organization=self.foreign_college, name="B"
        )
        foreign_assignment = TeacherAssignment.objects.create(
            teacher=foreign_profile, subject=self.foreign_subject,
            section=foreign_section,
        )
        for title, assignment, owner, org, published in (
            ("Published", self.assignment, self.teacher_user, self.college, True),
            ("Draft Secret", self.assignment, self.teacher_user, self.college, False),
            ("Other Section Secret", other_assignment, self.teacher_user, self.college, True),
            ("Foreign Secret", foreign_assignment, foreign_teacher, self.foreign_college, True),
        ):
            Document.objects.create(
                organization=org, uploaded_by=owner,
                teacher_assignment=assignment, title=title,
                file="documents/placeholder.pdf", is_published=published,
            )
        excerpts.return_value = [{"page": 12, "text": "Authorized teacher notes"}]
        self.login()
        response = self.client.post(CHAT_URL, {
            "mode": "tutor", "subject_id": self.science.id,
            "message": "According to uploaded PDF what is auction value?",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        materials = generation.call_args.kwargs["data"]["study_materials"]
        self.assertEqual([material["title"] for material in materials], ["Published"])
        self.assertEqual(excerpts.call_count, 1)

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


    @patch("ai_assistant.views.generate_reply")
    def test_scheduled_class_question_returns_student_classes_without_ai(self, generation):
        from datetime import timedelta
        from django.utils import timezone
        from liveclasses.models import LiveClass

        tomorrow = timezone.localdate() + timedelta(days=1)
        LiveClass.objects.create(
            organization=self.college,
            teacher_assignment=self.assignment,
            title="Meta Ads Scheduled Lesson",
            class_date=tomorrow,
            start_time="15:30:00",
            end_time="16:30:00",
            status=LiveClass.Status.SCHEDULED,
        )
        LiveClass.objects.create(
            organization=self.college,
            teacher_assignment=self.assignment,
            title="Later Meta Ads Lesson",
            class_date=tomorrow + timedelta(days=1),
            start_time="16:00:00",
            end_time="17:00:00",
            status=LiveClass.Status.SCHEDULED,
        )
        excluded_assignment = TeacherAssignment.objects.create(
            teacher=self.teacher, subject=self.excluded, section=self.section
        )
        LiveClass.objects.create(
            organization=self.college,
            teacher_assignment=excluded_assignment,
            title="Private Mathematics Class",
            class_date=tomorrow,
            start_time="15:30:00",
            end_time="16:30:00",
            status=LiveClass.Status.SCHEDULED,
        )

        self.login()
        for message in (
            "is there any class scheduled?",
            "Are there classes scheduled tomorrow?",
            "When is my next class?",
        ):
            reply = self.client.post(CHAT_URL, {
                "mode": "dashboard", "message": message,
            }, format="json")
            self.assertEqual(reply.status_code, 200)
            self.assertIn("Meta Ads Scheduled Lesson", reply.data["reply"])
            self.assertIn("15:30", reply.data["reply"])
            self.assertNotIn("Private Mathematics Class", reply.data["reply"])
            self.assertEqual(
                reply.data["links"][0]["href"], "/student/classes"
            )
        for question in (
            "Are there classes scheduled tomorrow?",
            "When is my next class?",
        ):
            filtered = self.client.post(CHAT_URL, {
                "mode": "dashboard", "message": question,
            }, format="json")
            self.assertNotIn("Later Meta Ads Lesson", filtered.data["reply"])

        today_reply = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "Do I have classes today?",
        }, format="json")
        self.assertIn("no scheduled or live classes listed for today",
                      today_reply.data["reply"])
        generation.assert_not_called()

    @patch("ai_assistant.views.generate_reply")
    def test_no_scheduled_classes_gives_clear_answer_without_ai(self, generation):
        self.login()
        result = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "Is any class scheduled?",
        }, format="json")
        self.assertEqual(result.status_code, 200)
        self.assertIn("no scheduled or live classes", result.data["reply"])
        generation.assert_not_called()

    @patch("ai_assistant.views.generate_reply")
    def test_restricted_classes_are_not_disclosed_via_chat(self, generation):
        from datetime import timedelta
        from django.utils import timezone
        from liveclasses.models import LiveClass

        LiveClass.objects.create(
            organization=self.college,
            teacher_assignment=self.assignment,
            title="Restricted Student Class",
            class_date=timezone.localdate() + timedelta(days=1),
            start_time="10:00:00",
            end_time="11:00:00",
            status=LiveClass.Status.SCHEDULED,
        )
        ClassFeatureAccess.objects.create(
            organization=self.college, classroom=self.classroom,
            feature_key="classes", is_enabled=False,
        )
        self.login()
        result = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "is there any class scheduled?",
        }, format="json")
        self.assertEqual(result.status_code, 200)
        self.assertIn("restricted", result.data["reply"])
        self.assertNotIn("Restricted Student Class", result.data["reply"])
        self.assertEqual(result.data["links"], [])
        generation.assert_not_called()


    @patch("ai_assistant.views.generate_reply")
    def test_previous_class_uses_latest_completed_student_class(self, generation):
        from datetime import timedelta
        from django.utils import timezone
        from liveclasses.models import LiveClass

        yesterday = timezone.localdate() - timedelta(days=1)
        older = yesterday - timedelta(days=2)

        LiveClass.objects.create(
            organization=self.college,
            teacher_assignment=self.assignment,
            title="Last Meta Ads Lesson",
            description="Class about campaign targeting",
            class_date=yesterday,
            start_time="16:00:00",
            end_time="17:00:00",
            status=LiveClass.Status.COMPLETED,
        )
        LiveClass.objects.create(
            organization=self.college,
            teacher_assignment=self.assignment,
            title="Older Meta Ads Lesson",
            class_date=older,
            start_time="10:00:00",
            end_time="11:00:00",
            status=LiveClass.Status.COMPLETED,
        )
        LiveClass.objects.create(
            organization=self.college,
            teacher_assignment=self.assignment,
            title="Past Scheduled But Never Completed",
            class_date=yesterday,
            start_time="12:00:00",
            end_time="13:00:00",
            status=LiveClass.Status.SCHEDULED,
        )
        hidden_assignment = TeacherAssignment.objects.create(
            teacher=self.teacher, subject=self.excluded, section=self.section
        )
        LiveClass.objects.create(
            organization=self.college,
            teacher_assignment=hidden_assignment,
            title="Private Maths Previous Lesson",
            class_date=yesterday,
            start_time="14:00:00",
            end_time="15:00:00",
            status=LiveClass.Status.COMPLETED,
        )
        self.login()

        last = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "tell me about my previous class",
        }, format="json")
        self.assertEqual(last.status_code, 200, last.data)
        self.assertIn("Last Meta Ads Lesson", last.data["reply"])
        self.assertIn("16:00", last.data["reply"])
        self.assertIn("completed", last.data["reply"])
        self.assertNotIn("Older Meta Ads Lesson", last.data["reply"])
        self.assertNotIn("Private Maths", last.data["reply"])
        self.assertNotIn("Past Scheduled But Never Completed", last.data["reply"])
        self.assertEqual(last.data["links"][0]["href"], "/student/classes")
        self.assertTrue(last.data.get("conversation_id"))

        all_previous = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "show me my completed classes",
        }, format="json")
        self.assertEqual(all_previous.status_code, 200)
        self.assertIn("Last Meta Ads Lesson", all_previous.data["reply"])
        self.assertIn("Older Meta Ads Lesson", all_previous.data["reply"])
        self.assertNotIn("Private Maths", all_previous.data["reply"])

        yesterday_only = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "show my class yesterday",
        }, format="json")
        self.assertEqual(yesterday_only.status_code, 200)
        self.assertIn("Last Meta Ads Lesson", yesterday_only.data["reply"])
        self.assertNotIn("Older Meta Ads Lesson", yesterday_only.data["reply"])
        generation.assert_not_called()

    @patch("ai_assistant.views.generate_reply")
    def test_previous_class_does_not_disclose_restricted_class(self, generation):
        from datetime import timedelta
        from django.utils import timezone
        from liveclasses.models import LiveClass

        LiveClass.objects.create(
            organization=self.college,
            teacher_assignment=self.assignment,
            title="Restricted Previous Class",
            class_date=timezone.localdate() - timedelta(days=1),
            start_time="14:00:00",
            end_time="15:00:00",
            status=LiveClass.Status.COMPLETED,
        )
        ClassFeatureAccess.objects.create(
            organization=self.college,
            classroom=self.classroom,
            feature_key="classes",
            is_enabled=False,
        )
        self.login()
        reply = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "What was my last class?",
        }, format="json")
        self.assertEqual(reply.status_code, 200)
        self.assertIn("restricted", reply.data["reply"])
        self.assertNotIn("Restricted Previous Class", reply.data["reply"])
        self.assertEqual(reply.data["links"], [])
        generation.assert_not_called()

    @patch("ai_assistant.views.generate_reply")
    def test_no_previous_class_has_clear_answer(self, generation):
        self.login()
        reply = self.client.post(CHAT_URL, {
            "mode": "dashboard", "message": "Tell me about my last class",
        }, format="json")
        self.assertEqual(reply.status_code, 200)
        self.assertIn("No completed classes", reply.data["reply"])
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


    def test_pdf_grounding_fallback_and_unrelated_subject_refusal(self):
        from .provider import _parse_reply
        context = {
            "study_materials": [{
                "title": "Meta Ads Reference",
                "excerpts": [{
                    "page": 12,
                    "text": "Total Value = (Bid x Estimated Action Rate) + Ad Quality",
                }],
            }],
        }
        rejected = '{"allowed": false, "answer": "Out of scope"}'
        grounded = _parse_reply(
            rejected, mode="tutor", subject={"name": "Meta Ads"},
            data=context,
            message="According to the uploaded PDF what is the ad auction total value?",
        )
        self.assertIn("Ad Quality", grounded)
        self.assertIn("page 12", grounded)
        self.assertNotIn("Out of scope", grounded)
        unrelated = _parse_reply(
            rejected, mode="tutor", subject={"name": "Meta Ads"},
            data=context, message="Teach me organic chemistry",
        )
        self.assertIn("I can only help with Meta Ads", unrelated)
        self.assertNotIn("Ad Quality", unrelated)

class PDFEvidenceRankingTests(TestCase):
    def test_later_learning_phase_page_outweighs_early_agenda(self):
        from io import BytesIO
        from reportlab.pdfgen import canvas
        from .material_retrieval import pdf_excerpts

        output = BytesIO()
        pdf = canvas.Canvas(output)
        for page in range(1, 14):
            if page == 3:
                pdf.drawString(35, 750, "Agenda: Ads Manager Fundamentals")
                pdf.drawString(35, 715, "Ad Set Level Decisions and Test and Learn")
            elif page == 12:
                pdf.drawString(
                    35, 750,
                    "Total Value = (Bid x Estimated Action Rate) + Ad Quality",
                )
            elif page == 13:
                for index in range(13):
                    pdf.drawString(
                        35, 760 - index * 35,
                        "Ad delivery decisions, goals, audience and creative considerations.",
                    )
                pdf.drawString(
                    35, 270,
                    "Exit the Learning Phase = 50 conversions per ad set per week.",
                )
            else:
                pdf.drawString(35, 750, "Overview of Meta advertising campaigns")
            pdf.showPage()
        pdf.save()

        class FakeFile:
            name = "teacher-lesson.pdf"

            @property
            def size(self):
                return len(output.getvalue())

            def open(self, mode):
                return BytesIO(output.getvalue())

        class FakeDocument:
            file = FakeFile()

        question = (
            "According to the uploaded PDF, how many conversions per ad set "
            "per week are mentioned for exiting the learning phase?"
        )
        excerpts = pdf_excerpts(FakeDocument(), question)
        self.assertTrue(excerpts)
        self.assertEqual(excerpts[0]["page"], 13)
        self.assertIn("50 conversions per ad set per week", excerpts[0]["text"])
        self.assertNotEqual(excerpts[0]["page"], 3)

        formula = pdf_excerpts(
            FakeDocument(),
            "According to the uploaded PDF, what is the ad auction total value formula?",
        )
        self.assertEqual(formula[0]["page"], 12)
        self.assertIn("Bid x Estimated Action Rate", formula[0]["text"])

    def test_false_rejection_uses_relevant_numeric_evidence_not_agenda(self):
        from .provider import _parse_reply

        data = {
            "study_materials": [{
                "title": "Meta Ads note",
                "excerpts": [
                    {
                        "page": 3,
                        "text": "Agenda: Campaign, Ad Set and Test and Learn.",
                    },
                    {
                        "page": 13,
                        "text": (
                            "Ad review can take ~24 hours. "
                            "Exit the Learning Phase = "
                            "50 conversions per ad set per week."
                        ),
                    },
                ],
            }],
        }
        question = (
            "According to the uploaded PDF, how many conversions per ad set "
            "per week are mentioned for exiting the learning phase?"
        )
        refused = '{"allowed": false, "answer": "Out of scope"}'
        answer = _parse_reply(
            refused, mode="tutor", subject={"name": "Meta Ads"},
            data=data, message=question,
        )
        self.assertIn("50 conversions per ad set per week", answer)
        self.assertIn("page 13", answer)
        self.assertNotIn("page 3", answer)
        self.assertNotIn("24 hours", answer)
        self.assertNotIn("Out of scope", answer)

    def test_no_unrelated_pdf_excerpt_fallback(self):
        from .provider import _parse_reply

        answer = _parse_reply(
            '{"allowed": false, "answer": "Out of scope"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data={"study_materials": [{
                "title": "Ad Set Agenda",
                "excerpts": [{"page": 3, "text": "Campaign and Ad Set Agenda"}],
            }]},
            message="According to the uploaded PDF, teach organic chemistry reactions",
        )
        self.assertIn("I can only help with Meta Ads", answer)
        self.assertNotIn("Agenda", answer)


class VerifiedDocumentCitationTests(TestCase):
    """A cited page must actually support the tutor's specific answer."""

    @staticmethod
    def _materials():
        return {
            "study_materials": [{
                "title": "Meta Ads note",
                "excerpts": [
                    {"page": 3, "text": "Today's agenda: Ad Set, Test and Learn."},
                    {
                        "page": 13,
                        "text": (
                            "Ad review can take around 24 hours. "
                            "Exit the Learning Phase = "
                            "50 conversions per ad set per week."
                        ),
                    },
                ],
            }],
        }

    def test_short_numeric_answer_gets_backend_verified_page(self):
        from .provider import _parse_reply

        question = (
            "According to the uploaded PDF, how many conversions per "
            "ad set per week are mentioned for exiting the learning phase?"
        )
        answer = _parse_reply(
            '{"allowed": true, "answer": "50"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data=self._materials(), message=question,
        )
        self.assertTrue(answer.startswith("50"))
        self.assertIn("Source: Meta Ads note (page 13).", answer)
        self.assertNotIn("(page 3)", answer)

    def test_wrong_number_on_same_page_does_not_get_false_citation(self):
        from .provider import _parse_reply

        answer = _parse_reply(
            '{"allowed": true, "answer": "24"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data=self._materials(),
            message="According to the uploaded PDF, how many conversions "
                    "per ad set per week are needed for the learning phase?",
        )
        self.assertIn("couldn't verify", answer)
        self.assertNotIn("Source:", answer)
        self.assertNotIn("24 hours", answer)

    def test_wrong_or_missing_pdf_cannot_get_a_source_claim(self):
        from .provider import _parse_reply

        answer = _parse_reply(
            '{"allowed": true, "answer": "99"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data={"study_materials": []},
            message="According to the PDF, how many conversions are required?",
        )
        self.assertIn("couldn't verify", answer)
        self.assertNotIn("Source:", answer)

    def test_model_supplied_wrong_page_is_replaced(self):
        from .provider import _parse_reply

        answer = _parse_reply(
            '{"allowed": true, "answer": "50 (page 3)"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data=self._materials(),
            message="According to the uploaded PDF, how many conversions "
                    "per ad set per week to exit the learning phase?",
        )
        self.assertIn("Source: Meta Ads note (page 13).", answer)
        self.assertNotIn("page 3", answer)

    def test_formula_from_matching_page_is_cited(self):
        from .provider import _parse_reply

        question = "According to uploaded PDF what is the ad auction total value formula?"
        answer = _parse_reply(
            '{"allowed": true, "answer": "Total Value = (Bid x Estimated Action Rate) + Ad Quality"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data={"study_materials": [{
                "title": "Meta Ads note",
                "excerpts": [
                    {"page": 3, "text": "The workshop agenda."},
                    {
                        "page": 12,
                        "text": "Ad auction total value formula: Total Value = "
                                "(Bid x Estimated Action Rate) + Ad Quality",
                    },
                ],
            }]},
            message=question,
        )
        self.assertIn("Source: Meta Ads note (page 12).", answer)

    def test_presenter_and_facilitator_are_verified_from_first_pdf_page(self):
        from io import BytesIO
        from reportlab.pdfgen import canvas
        from .material_retrieval import pdf_excerpts
        from .provider import _parse_reply

        output = BytesIO()
        pdf = canvas.Canvas(output)
        pdf.drawString(40, 750, "Facebook Ads Manager for beginners")
        pdf.drawString(40, 720, "Presenter: Alex Duffield")
        pdf.drawString(40, 690, "Facilitator: Haydn Corrodus")
        pdf.save()

        class File:
            name = "teacher-reference.pdf"

            @property
            def size(self):
                return len(output.getvalue())

            def open(self, mode):
                return BytesIO(output.getvalue())

        class Document:
            file = File()

        question = (
            "According to the uploaded PDF, who are the presenter "
            "and facilitator named on the first slide?"
        )
        excerpts = pdf_excerpts(Document(), question)
        self.assertTrue(excerpts)
        self.assertEqual(excerpts[0]["page"], 1)

        data = {"study_materials": [{
            "title": "Facebook Ads Manager for beginners",
            "excerpts": excerpts,
        }]}
        answer = _parse_reply(
            '{"allowed": true, "answer": "Alex Duffield and Haydn Corrodus"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data=data, message=question,
        )
        self.assertIn("Alex Duffield", answer)
        self.assertIn("Haydn Corrodus", answer)
        self.assertIn(
            "Source: Facebook Ads Manager for beginners (page 1).",
            answer,
        )

    def test_no_false_document_citation_for_general_or_dashboard_questions(self):
        from .provider import _parse_reply

        general = _parse_reply(
            '{"allowed": true, "answer": "50"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data=self._materials(),
            message="How many conversions does Meta recommend?",
        )
        self.assertEqual(general, "50")

        dashboard = _parse_reply(
            '{"allowed": true, "answer": "50"}',
            mode="dashboard", subject=None,
            data=self._materials(),
            message="According to the uploaded PDF what is the count?",
        )
        self.assertEqual(dashboard, "50")

    def test_off_topic_refusal_does_not_get_pdf_citation(self):
        from .provider import _parse_reply

        answer = _parse_reply(
            '{"allowed": false, "answer": "Not in scope"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data=self._materials(),
            message="Teach me advanced organic chemistry",
        )
        self.assertIn("I can only help with Meta Ads", answer)
        self.assertNotIn("Source:", answer)


class ReadableTeacherPDFAnswersTests(TestCase):
    """Student-facing PDF replies are concise, cited and permission-grounded."""

    @staticmethod
    def _presenter_materials():
        return {"study_materials": [{
            "title": "Meta Ads note",
            "excerpts": [
                {
                    "page": 1,
                    "text": (
                        "Digital Culture Network Facebook Ads Manager for beginners "
                        "Presenter: Alex Duffield, Meta Core Product Adoption Manager "
                        "Facilitator: Haydn Corrodus, Tech Champion for Social Media"
                    ),
                },
                {
                    "page": 3,
                    "text": (
                        "Today's agenda: Ads Manager Fundamentals, Campaign Level "
                        "Decisions, Ad Set Level Decisions and Test and Learn."
                    ),
                },
            ],
        }]}

    def test_false_rejection_formats_presenter_and_facilitator_without_dump(self):
        from .provider import _parse_reply

        answer = _parse_reply(
            '{"allowed": false, "answer": "Out of scope"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data=self._presenter_materials(),
            message="According to the uploaded Facebook Ads Manager beginners "
                    "PDF, who is the presenter and who is the facilitator?",
        )
        self.assertIn(
            "Presenter: Alex Duffield, Meta Core Product Adoption Manager", answer
        )
        self.assertIn(
            "Facilitator: Haydn Corrodus, Tech Champion for Social Media", answer
        )
        self.assertIn("Source: Meta Ads note (page 1).", answer)
        self.assertNotIn("Digital Culture Network Facebook", answer)
        self.assertNotIn("This is quoted source evidence", answer)
        self.assertNotIn("page 3", answer)
        self.assertLess(len(answer), 260)

    def test_allowed_model_answer_gets_same_clean_role_format(self):
        from .provider import _parse_reply

        answer = _parse_reply(
            '{"allowed": true, "answer": "Alex Duffield and Haydn Corrodus"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data=self._presenter_materials(),
            message="According to the uploaded PDF, who is the presenter "
                    "and who is the facilitator?",
        )
        self.assertIn("Presenter: Alex Duffield", answer)
        self.assertIn("Facilitator: Haydn Corrodus", answer)
        self.assertIn("Source: Meta Ads note (page 1).", answer)
        self.assertNotIn("Digital Culture Network Facebook", answer)

    def test_numeric_fallback_picks_50_not_24_and_cites_correct_page(self):
        from .provider import _parse_reply

        materials = {"study_materials": [{
            "title": "Meta Ads note",
            "excerpts": [
                {"page": 3, "text": "Agenda: Campaign and Ad Set Level Decisions."},
                {
                    "page": 13,
                    "text": (
                        "Ad review can take around 24 hours. "
                        "Exit the Learning Phase = 50 conversions "
                        "per ad set per week."
                    ),
                },
            ],
        }]}
        answer = _parse_reply(
            '{"allowed": false, "answer": "Out of scope"}',
            mode="tutor", subject={"name": "Meta Ads"}, data=materials,
            message="According to the uploaded PDF, how many conversions "
                    "per ad set per week are required to exit the learning phase?",
        )
        self.assertIn("50 conversions per ad set per week", answer)
        self.assertIn("Source: Meta Ads note (page 13).", answer)
        self.assertNotIn("24 hours", answer)
        self.assertNotIn("page 3", answer)
        self.assertNotIn("not a verified full-document answer", answer)
        self.assertLess(len(answer), 190)

    def test_verified_bare_number_expands_without_creating_new_fact(self):
        from .provider import _parse_reply

        materials = {"study_materials": [{
            "title": "Meta Ads note",
            "excerpts": [{
                "page": 13,
                "text": "Exit the Learning Phase = 50 conversions per ad set per week.",
            }],
        }]}
        question = (
            "According to the uploaded PDF, how many conversions per "
            "ad set per week are needed to exit the learning phase?"
        )
        answer = _parse_reply(
            '{"allowed": true, "answer": "50"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data=materials, message=question,
        )
        self.assertEqual(
            answer,
            "50 conversions per ad set per week.\n\n"
            "Source: Meta Ads note (page 13).",
        )

        wrong = _parse_reply(
            '{"allowed": true, "answer": "24"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data=materials, message=question,
        )
        self.assertIn("couldn't verify", wrong)
        self.assertNotIn("Source:", wrong)

    def test_false_rejection_formula_is_short_and_cited(self):
        from .provider import _parse_reply

        materials = {"study_materials": [{
            "title": "Meta Ads note",
            "excerpts": [
                {"page": 3, "text": "Agenda: Ads Manager Fundamentals."},
                {
                    "page": 12,
                    "text": (
                        "Ad auction total value formula: "
                        "Total Value = (Bid x Estimated Action Rate) + Ad Quality."
                    ),
                },
            ],
        }]}
        answer = _parse_reply(
            '{"allowed": false, "answer": "Out of scope"}',
            mode="tutor", subject={"name": "Meta Ads"}, data=materials,
            message="According to the uploaded PDF what is the ad auction "
                    "total value formula?",
        )
        self.assertIn("Bid x Estimated Action Rate", answer)
        self.assertIn("Source: Meta Ads note (page 12).", answer)
        self.assertNotIn("Agenda:", answer)
        self.assertLess(len(answer), 280)

    def test_no_pdf_evidence_does_not_invent_names_or_citation(self):
        from .provider import _parse_reply

        question = (
            "According to the uploaded PDF, who is the presenter "
            "and facilitator?"
        )
        refused = _parse_reply(
            '{"allowed": false, "answer": "Out of scope"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data={"study_materials": []}, message=question,
        )
        self.assertNotIn("Alex Duffield", refused)
        self.assertNotIn("Source:", refused)

        allowed = _parse_reply(
            '{"allowed": true, "answer": "Alex Duffield"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data={"study_materials": []}, message=question,
        )
        self.assertIn("couldn't verify", allowed)
        self.assertNotIn("Source:", allowed)

    def test_subject_refusal_dashboard_and_general_tutor_are_unchanged(self):
        from .provider import _parse_reply

        data = self._presenter_materials()
        off_topic = _parse_reply(
            '{"allowed": false, "answer": "Out of scope"}',
            mode="tutor", subject={"name": "Meta Ads"},
            data=data,
            message="Teach me organic chemistry reactions",
        )
        self.assertIn("I can only help with Meta Ads", off_topic)
        self.assertNotIn("Source:", off_topic)

        dashboard = _parse_reply(
            '{"allowed": true, "answer": "Your attendance is 75%."}',
            mode="dashboard", subject=None, data=data,
            message="What is my attendance?",
        )
        self.assertEqual(dashboard, "Your attendance is 75%.")

        general = _parse_reply(
            '{"allowed": true, "answer": "Meta Ads Manager creates campaigns."}',
            mode="tutor", subject={"name": "Meta Ads"}, data=data,
            message="What is Meta Ads Manager?",
        )
        self.assertEqual(general, "Meta Ads Manager creates campaigns.")


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


class DashboardTopicRoutingTests(TestCase):
    def test_recorded_classes_and_online_exams_match_student_questions(self):
        from .dashboard_answers import _topic

        self.assertEqual(
            _topic("tell me about my recorded classes"), "recorded_classes"
        )
        self.assertEqual(
            _topic("I want details of my recorded class"), "recorded_classes"
        )
        self.assertEqual(
            _topic("tell me about my online exam"), "online_exams"
        )
        self.assertEqual(
            _topic("show my online exams"), "online_exams"
        )

    def test_scheduled_class_question_phrasings(self):
        from .dashboard_answers import _topic

        questions = (
            "is there any class scheduled?",
            "Is any class scheduled for today?",
            "are there classes scheduled tomorrow?",
            "What classes are scheduled?",
            "Do I have classes today?",
            "What is my next class?",
            "Show my upcoming classes",
            "Is there a live class?",
            "Show the class schedule",
        )
        for question in questions:
            with self.subTest(question=question):
                self.assertEqual(_topic(question), "upcoming_classes")

        self.assertEqual(_topic("show my recorded classes"), "recorded_classes")
        self.assertEqual(_topic("show my online exam schedule"), "online_exams")

    def test_previous_class_questions_route_to_completed_records(self):
        from .dashboard_answers import _topic

        for question in (
            "tell me about my previous class",
            "What was my last class?",
            "My last live class",
            "Show my completed classes",
            "Tell me about my previous lectures",
            "Show my past classes",
            "Show my class yesterday",
        ):
            with self.subTest(question=question):
                self.assertEqual(_topic(question), "previous_classes")
        self.assertEqual(_topic("Show my previous recorded classes"), "recorded_classes")
        self.assertEqual(_topic("When is my next class?"), "upcoming_classes")



