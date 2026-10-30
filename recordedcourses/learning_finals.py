"""Course-wide final exams, issuance rules and privacy-limited verification."""
from uuid import UUID
from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .learning_access import OrganizationLearningEnabled
from .learning_content import _course
from .learning_progression import module_access_map
from .student_learning import _student, _student_access
from .models import (
    CourseModule, CourseFinalExam, CourseFinalQuestion, CourseFinalAttempt,
    CourseCertificate, RecordedCourse,
)


def _staff_exam(exam):
    return {
        "id": exam.pk, "course_id": exam.course_id, "title": exam.title,
        "passing_percent": exam.passing_percent, "max_attempts": exam.max_attempts,
        "is_published": exam.is_published,
        "question_count": exam.questions.count(), "attempt_count": exam.attempts.count(),
        "questions": [
            {"id": q.pk, "prompt": q.prompt, "position": q.position,
             "choices": q.choices, "correct_index": q.correct_index}
            for q in exam.questions.all()
        ],
    }


def course_completion_ready(course, student):
    modules = list(CourseModule.objects.filter(
        course=course, is_published=True,
    ).order_by("position", "pk"))
    if not modules or any(not module.lessons.filter(is_active=True).exists() for module in modules):
        return False, len(modules)
    status = module_access_map(course, student)
    return all(status[m.pk]["completed"] for m in modules), len(modules)


def student_final_status(course, student):
    exam = CourseFinalExam.objects.filter(course=course, is_published=True).first()
    certificate = CourseCertificate.objects.filter(course=course, student=student).first()
    if exam is None:
        return None
    ready, module_count = course_completion_ready(course, student)
    attempts = CourseFinalAttempt.objects.filter(exam=exam, student=student)
    used = attempts.count()
    passed = attempts.filter(passed=True).exists()
    return {
        "id": exam.pk, "title": exam.title, "passing_percent": exam.passing_percent,
        "max_attempts": exam.max_attempts, "attempts_used": used,
        "attempts_remaining": max(0, exam.max_attempts - used),
        "passed": passed, "unlocked": ready, "required_modules": module_count,
        "best_score_percent": attempts.order_by("-score_percent").values_list("score_percent", flat=True).first(),
        "certificate_id": str(certificate.public_id) if certificate and not certificate.revoked_at else None,
    }


class ManagedCourseFinalExamAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request, course_id):
        course = _course(request.user, course_id)
        exam = CourseFinalExam.objects.filter(course=course).first()
        return Response({"exam": _staff_exam(exam) if exam else None})

    def put(self, request, course_id):
        course = _course(request.user, course_id)
        data = request.data
        if not isinstance(data, dict):
            return Response({"detail": "Provide exam settings."}, status=400)
        title, passing, attempts = (
            data.get("title"), data.get("passing_percent", 70), data.get("max_attempts", 3),
        )
        if (not isinstance(title, str) or not 1 <= len(title.strip()) <= 180
                or type(passing) is not int or not 1 <= passing <= 100
                or type(attempts) is not int or not 1 <= attempts <= 10):
            return Response({"detail": "Provide a title, pass mark (1-100) and attempts (1-10)."}, status=400)
        with transaction.atomic():
            exam = CourseFinalExam.objects.select_for_update().filter(course=course).first()
            if exam and (exam.is_published or exam.attempts.exists()):
                return Response({"detail": "Published exams and attempted exams cannot be edited."}, status=409)
            if not exam:
                exam = CourseFinalExam(course=course)
            exam.title, exam.passing_percent, exam.max_attempts = title.strip(), passing, attempts
            exam.full_clean()
            exam.save()
        return Response({"exam": _staff_exam(exam)})

    def patch(self, request, course_id):
        if request.user.role != "college_admin":
            return Response({"detail": "Only College Admin may publish final exams."}, status=403)
        course = _course(request.user, course_id)
        if not isinstance(request.data, dict) or type(request.data.get("is_published")) is not bool:
            return Response({"detail": "is_published must be a boolean."}, status=400)
        with transaction.atomic():
            exam = get_object_or_404(CourseFinalExam.objects.select_for_update(), course=course)
            desired = request.data["is_published"]
            if exam.attempts.exists() and desired != exam.is_published:
                return Response({"detail": "Exam publication cannot change after attempts."}, status=409)
            if desired and not exam.is_published:
                modules = CourseModule.objects.filter(course=course, is_published=True)
                if not modules.exists() or any(not m.lessons.filter(is_active=True).exists() for m in modules):
                    return Response({"detail": "Publish at least one module with an active lesson first."}, status=400)
                if not exam.questions.exists():
                    return Response({"detail": "Add questions before publishing."}, status=400)
            exam.is_published = desired
            exam.save(update_fields=["is_published", "updated_at"])
        return Response({"exam": _staff_exam(exam)})


class ManagedCourseFinalQuestionsAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def post(self, request, course_id):
        course = _course(request.user, course_id)
        data = request.data
        if not isinstance(data, dict):
            return Response({"detail": "Question object required."}, status=400)
        prompt, choices, correct = data.get("prompt"), data.get("choices"), data.get("correct_index")
        if (not isinstance(prompt, str) or not 1 <= len(prompt.strip()) <= 1000
                or not isinstance(choices, list) or not 2 <= len(choices) <= 6
                or any(not isinstance(c, str) or not 1 <= len(c.strip()) <= 400 for c in choices)
                or type(correct) is not int or not 0 <= correct < len(choices)):
            return Response({"detail": "Provide a prompt, 2-6 choices and a correct option."}, status=400)
        with transaction.atomic():
            exam = get_object_or_404(CourseFinalExam.objects.select_for_update(), course=course)
            if exam.is_published or exam.attempts.exists():
                return Response({"detail": "Exam questions are locked."}, status=409)
            position = (exam.questions.aggregate(last=Max("position"))["last"] or 0) + 1
            CourseFinalQuestion.objects.create(
                exam=exam, prompt=prompt.strip(), choices=[s.strip() for s in choices],
                correct_index=correct, position=position,
            )
        return Response({"exam": _staff_exam(exam)}, status=201)


class StudentCourseFinalExamAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def _access(self, request, course_id):
        course = get_object_or_404(RecordedCourse, pk=course_id,
                                   organization=request.user.organization, is_active=True)
        student, access = _student_access(request.user, course.pk)
        return course, student, access

    def get(self, request, course_id):
        course, student, access = self._access(request, course_id)
        if student is None or access is None:
            return Response({"detail": "Active course access required."}, status=403)
        exam = get_object_or_404(CourseFinalExam, course=course, is_published=True)
        status = student_final_status(course, student)
        body = {"exam": status}
        if status["unlocked"] and status["attempts_remaining"] and not status["passed"]:
            body["questions"] = [
                {"id": q.pk, "prompt": q.prompt,
                 "choices": [{"index": i, "text": choice} for i, choice in enumerate(q.choices)]}
                for q in exam.questions.all()
            ]
        return Response(body)

    def post(self, request, course_id):
        course, student, access = self._access(request, course_id)
        if student is None or access is None:
            return Response({"detail": "Active course access required."}, status=403)
        data = request.data
        answers = data.get("answers") if isinstance(data, dict) else None
        if not isinstance(answers, dict):
            return Response({"detail": "Provide answers indexed by question ID."}, status=400)
        with transaction.atomic():
            from accounts.models import StudentProfile
            StudentProfile.objects.select_for_update().get(pk=student.pk)
            exam = get_object_or_404(
                CourseFinalExam.objects.select_for_update(), course=course, is_published=True,
            )
            status = student_final_status(course, student)
            if not status["unlocked"]:
                return Response({"detail": "Complete all published course modules first."}, status=403)
            if status["passed"]:
                return Response({"detail": "Final exam already passed."}, status=409)
            if not status["attempts_remaining"]:
                return Response({"detail": "No final exam attempts remaining."}, status=403)
            questions = list(exam.questions.all())
            if not questions or set(answers) != {str(q.pk) for q in questions}:
                return Response({"detail": "Answer every question exactly once."}, status=400)
            for q in questions:
                v = answers[str(q.pk)]
                if type(v) is not int or not 0 <= v < len(q.choices):
                    return Response({"detail": "One or more answers are invalid."}, status=400)
            correct = sum(answers[str(q.pk)] == q.correct_index for q in questions)
            score = round(100 * correct / len(questions))
            passed = score >= exam.passing_percent
            attempt = CourseFinalAttempt.objects.create(
                exam=exam, student=student, attempt_number=status["attempts_used"] + 1,
                answers=answers, correct_count=correct, question_count=len(questions),
                score_percent=score, passed=passed,
            )
            cert = None
            if passed:
                cert, _ = CourseCertificate.objects.get_or_create(
                    course=course, student=student,
                    defaults={
                        "organization": course.organization, "final_attempt": attempt,
                        "course_title_at_issue": course.title,
                        "organization_name_at_issue": course.organization.name,
                        "student_name_at_issue": student.user.get_full_name() or student.user.username,
                        "module_count_at_issue": status["required_modules"],
                        "score_percent": score,
                    },
                )
        return Response({
            "attempt": {
                "id": attempt.pk, "score_percent": score, "passed": passed,
                "attempt_number": attempt.attempt_number,
                "correct_count": correct, "question_count": len(questions),
            },
            "exam": student_final_status(course, student),
            "certificate_id": str(cert.public_id) if cert and not cert.revoked_at else None,
        }, status=201)


def _masked_name(name):
    tokens = name.split()
    return " ".join(t[0] + "*" * min(max(len(t)-1, 1), 6) for t in tokens if t)


class PublicCourseCertificateVerificationAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, public_id):
        certificate = get_object_or_404(
            CourseCertificate.objects.select_related("course"), public_id=public_id,
        )
        return Response({
            "certificate_id": str(certificate.public_id),
            "valid": certificate.revoked_at is None,
            "status": "revoked" if certificate.revoked_at else "issued",
            "student": _masked_name(certificate.student_name_at_issue),
            "course": certificate.course_title_at_issue,
            "organization": certificate.organization_name_at_issue,
            "issued_at": certificate.issued_at.date().isoformat(),
        })


class ManagedCertificateAPIView(APIView):
    """Review or revoke certificates only within the admin's institution."""
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request, course_id):
        if request.user.role != "college_admin":
            return Response({"detail": "College Admin required."}, status=403)
        course = _course(request.user, course_id)
        certificates = CourseCertificate.objects.filter(course=course).select_related("student__user")
        return Response({"certificates": [
            {
                "id": str(c.public_id), "student": c.student_name_at_issue,
                "issued_at": c.issued_at, "score_percent": c.score_percent,
                "status": "revoked" if c.revoked_at else "issued",
            } for c in certificates
        ]})

    def patch(self, request, course_id):
        if request.user.role != "college_admin":
            return Response({"detail": "College Admin required."}, status=403)
        course = _course(request.user, course_id)
        data = request.data
        if not isinstance(data, dict) or not isinstance(data.get("certificate_id"), str):
            return Response({"detail": "certificate_id and revocation reason required."}, status=400)
        reason = data.get("reason")
        if not isinstance(reason, str) or not 1 <= len(reason.strip()) <= 500:
            return Response({"detail": "Provide a reason (up to 500 characters)."}, status=400)
        try:
            certificate_id = UUID(data["certificate_id"])
        except (ValueError, TypeError, AttributeError):
            return Response({"detail": "certificate_id must be a valid UUID."}, status=400)
        with transaction.atomic():
            certificate = get_object_or_404(
                CourseCertificate.objects.select_for_update(),
                public_id=certificate_id, course=course,
            )
            if certificate.revoked_at:
                return Response({"detail": "Certificate is already revoked."}, status=409)
            certificate.revoked_at = timezone.now()
            certificate.revocation_reason = reason.strip()
            certificate.save(update_fields=["revoked_at", "revocation_reason"])
        return Response({"certificate_id": str(certificate.public_id), "status": "revoked"})
