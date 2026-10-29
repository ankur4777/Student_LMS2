"""Tenant-aware module quiz authoring and student auto-grading."""
from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .learning_access import OrganizationLearningEnabled
from .learning_progression import is_module_unlocked
from .learning_content import _module
from .student_learning import _student_access
from .models import (
    ModuleQuiz, ModuleQuizQuestion, ModuleQuizAttempt, CourseModule,
    LessonLearningProgress,
)


def _staff_quiz(quiz):
    return {
        "id": quiz.pk, "module_id": quiz.module_id, "title": quiz.title,
        "passing_percent": quiz.passing_percent,
        "max_attempts": quiz.max_attempts, "is_published": quiz.is_published,
        "question_count": quiz.questions.count(), "attempt_count": quiz.attempts.count(),
        "questions": [
            {"id": q.pk, "prompt": q.prompt, "position": q.position,
             "choices": q.choices, "correct_index": q.correct_index}
            for q in quiz.questions.all()
        ],
    }


def student_quiz_status(module, student):
    quiz = ModuleQuiz.objects.filter(module=module, is_published=True).first()
    if quiz is None:
        return None
    lessons = module.lessons.filter(is_active=True)
    total = lessons.count()
    watched = LessonLearningProgress.objects.filter(
        student=student, lesson__in=lessons, completed_at__isnull=False,
    ).count()
    attempts = ModuleQuizAttempt.objects.filter(quiz=quiz, student=student)
    n = attempts.count()
    return {
        "id": quiz.pk, "title": quiz.title, "passing_percent": quiz.passing_percent,
        "max_attempts": quiz.max_attempts, "attempts_used": n,
        "attempts_remaining": max(0, quiz.max_attempts - n),
        "passed": attempts.filter(passed=True).exists(),
        "best_score_percent": attempts.order_by("-score_percent").values_list("score_percent", flat=True).first(),
        "unlocked": total > 0 and watched == total,
    }


class ManagedModuleQuizAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request, module_id):
        module = _module(request.user, module_id)
        quiz = ModuleQuiz.objects.filter(module=module).first()
        return Response({"quiz": _staff_quiz(quiz) if quiz else None})

    def put(self, request, module_id):
        module = _module(request.user, module_id)
        data = request.data
        if not isinstance(data, dict):
            return Response({"detail": "Provide quiz settings."}, status=400)
        title = data.get("title")
        passing = data.get("passing_percent", 70)
        attempts = data.get("max_attempts", 3)
        if (not isinstance(title, str) or not 1 <= len(title.strip()) <= 180
                or type(passing) is not int or not 1 <= passing <= 100
                or type(attempts) is not int or not 1 <= attempts <= 10):
            return Response({"detail": "Title, passing_percent (1-100) and max_attempts (1-10) required."}, status=400)
        with transaction.atomic():
            quiz = ModuleQuiz.objects.select_for_update().filter(module=module).first()
            if quiz and (quiz.is_published or quiz.attempts.exists()):
                return Response({"detail": "A published quiz or quiz with attempts cannot be edited."}, status=409)
            if quiz is None:
                quiz = ModuleQuiz(module=module)
            quiz.title = title.strip()
            quiz.passing_percent = passing
            quiz.max_attempts = attempts
            quiz.full_clean()
            quiz.save()
        return Response({"quiz": _staff_quiz(quiz)})

    def patch(self, request, module_id):
        if request.user.role != "college_admin":
            return Response({"detail": "Only College Admin can publish quizzes."}, status=403)
        module = _module(request.user, module_id)
        if not isinstance(request.data, dict) or type(request.data.get("is_published")) is not bool:
            return Response({"detail": "is_published must be true or false."}, status=400)
        with transaction.atomic():
            quiz = get_object_or_404(ModuleQuiz.objects.select_for_update(), module=module)
            desired = request.data["is_published"]
            if quiz.attempts.exists() and desired != quiz.is_published:
                return Response({"detail": "A quiz with attempts cannot be unpublished."}, status=409)
            if desired and not quiz.is_published:
                if not module.is_published or not module.lessons.filter(is_active=True).exists():
                    return Response({"detail": "Publish the module and add an active video first."}, status=400)
                if not quiz.questions.exists():
                    return Response({"detail": "Add at least one question before publishing."}, status=400)
            quiz.is_published = desired
            quiz.save(update_fields=["is_published", "updated_at"])
        return Response({"quiz": _staff_quiz(quiz)})


class ManagedModuleQuizQuestionsAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def post(self, request, module_id):
        module = _module(request.user, module_id)
        data = request.data
        if not isinstance(data, dict):
            return Response({"detail": "Provide a question object."}, status=400)
        prompt, choices, correct = data.get("prompt"), data.get("choices"), data.get("correct_index")
        if (not isinstance(prompt, str) or not 1 <= len(prompt.strip()) <= 1000
                or not isinstance(choices, list) or not 2 <= len(choices) <= 6
                or any(not isinstance(c, str) or not 1 <= len(c.strip()) <= 400 for c in choices)
                or type(correct) is not int or not 0 <= correct < len(choices)):
            return Response({"detail": "Question, 2-6 choices and valid correct_index required."}, status=400)
        with transaction.atomic():
            quiz = get_object_or_404(ModuleQuiz.objects.select_for_update(), module=module)
            if quiz.is_published or quiz.attempts.exists():
                return Response({"detail": "Quiz is locked after publication or attempts."}, status=409)
            position = (quiz.questions.aggregate(last=Max("position"))["last"] or 0) + 1
            ModuleQuizQuestion.objects.create(
                quiz=quiz, prompt=prompt.strip(), position=position,
                choices=[c.strip() for c in choices], correct_index=correct,
            )
        return Response({"quiz": _staff_quiz(quiz)}, status=201)


class StudentModuleQuizAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def _context(self, request, module_id):
        module = get_object_or_404(CourseModule.objects.select_related("course").filter(
            pk=module_id, is_published=True, course__is_active=True,
            course__organization=request.user.organization,
        ))
        student, access = _student_access(request.user, module.course_id)
        return module, student, access

    def get(self, request, module_id):
        module, student, access = self._context(request, module_id)
        if student is None or access is None:
            return Response({"detail": "Active course access is required."}, status=403)
        if not is_module_unlocked(module, student):
            return Response({"detail": "Complete the previous module first."}, status=403)
        quiz = get_object_or_404(ModuleQuiz, module=module, is_published=True)
        status = student_quiz_status(module, student)
        body = {"quiz": status}
        if status["unlocked"] and status["attempts_remaining"] and not status["passed"]:
            body["questions"] = [
                {"id": q.pk, "prompt": q.prompt,
                 "choices": [{"index": i, "text": text} for i, text in enumerate(q.choices)]}
                for q in quiz.questions.all()
            ]
        return Response(body)

    def post(self, request, module_id):
        module, student, access = self._context(request, module_id)
        if student is None or access is None:
            return Response({"detail": "Active course access is required."}, status=403)
        if not is_module_unlocked(module, student):
            return Response({"detail": "Complete the previous module first."}, status=403)
        quiz = get_object_or_404(ModuleQuiz, module=module, is_published=True)
        data = request.data
        answers = data.get("answers") if isinstance(data, dict) else None
        if not isinstance(answers, dict):
            return Response({"detail": "Provide answers by question ID."}, status=400)
        with transaction.atomic():
            from accounts.models import StudentProfile
            StudentProfile.objects.select_for_update().get(pk=student.pk)
            status = student_quiz_status(module, student)
            if not status["unlocked"]:
                return Response({"detail": "Finish all active module videos first."}, status=403)
            if status["passed"]:
                return Response({"detail": "Quiz already passed."}, status=409)
            if not status["attempts_remaining"]:
                return Response({"detail": "No attempts remaining."}, status=403)
            questions = list(quiz.questions.all())
            if not questions or set(answers) != {str(q.pk) for q in questions}:
                return Response({"detail": "Answer each question exactly once."}, status=400)
            for q in questions:
                idx = answers[str(q.pk)]
                if type(idx) is not int or idx < 0 or idx >= len(q.choices):
                    return Response({"detail": "One or more answers are invalid."}, status=400)
            count = sum(answers[str(q.pk)] == q.correct_index for q in questions)
            score = round(100 * count / len(questions))
            attempt = ModuleQuizAttempt.objects.create(
                quiz=quiz, student=student, attempt_number=status["attempts_used"] + 1,
                answers=answers, correct_count=count, question_count=len(questions),
                score_percent=score, passed=score >= quiz.passing_percent,
            )
        return Response({"attempt": {
            "id": attempt.pk, "score_percent": attempt.score_percent,
            "passed": attempt.passed, "correct_count": attempt.correct_count,
            "question_count": attempt.question_count, "attempt_number": attempt.attempt_number,
        }, "quiz": student_quiz_status(module, student)}, status=201)
