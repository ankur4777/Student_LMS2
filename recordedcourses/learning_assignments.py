"""Organization-safe module assignment authoring, submissions and grading."""
import mimetypes
from pathlib import Path

from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .learning_access import OrganizationLearningEnabled
from .learning_content import _module, _authorized_courses
from .learning_progression import is_module_unlocked
from .student_learning import _student_access
from .models import (
    CourseModule, ModuleAssignment, ModuleAssignmentSubmission,
    LessonLearningProgress,
)


def _assignment_data(assignment):
    return {
        "id": assignment.pk, "module_id": assignment.module_id,
        "title": assignment.title, "instructions": assignment.instructions,
        "passing_percent": assignment.passing_percent,
        "max_attempts": assignment.max_attempts,
        "is_published": assignment.is_published,
        "submission_count": assignment.submissions.count(),
    }


def _submission_data(submission):
    return {
        "id": submission.pk, "student_id": submission.student_id,
        "student_name": submission.student.user.get_full_name() or submission.student.user.username,
        "answer_text": submission.answer_text, "has_file": bool(submission.file),
        "attempt_number": submission.attempt_number,
        "submitted_at": submission.submitted_at,
        "score_percent": submission.score_percent, "feedback": submission.feedback,
        "graded_at": submission.graded_at,
    }


def student_assignment_status(module, student):
    assignment = ModuleAssignment.objects.filter(
        module=module, is_published=True,
    ).first()
    if assignment is None:
        return None
    attempts = ModuleAssignmentSubmission.objects.filter(
        student=student, assignment=assignment,
    )
    used = attempts.count()
    last = attempts.select_related("student__user").order_by("-attempt_number").first()
    passed = attempts.filter(
        graded_at__isnull=False, score_percent__gte=assignment.passing_percent,
    ).exists()
    lessons = module.lessons.filter(is_active=True)
    total = lessons.count()
    watched = LessonLearningProgress.objects.filter(
        student=student, lesson__in=lessons, completed_at__isnull=False,
    ).count()
    return {
        "id": assignment.pk, "title": assignment.title,
        "instructions": assignment.instructions,
        "passing_percent": assignment.passing_percent, "max_attempts": assignment.max_attempts,
        "attempts_used": used, "attempts_remaining": max(0, assignment.max_attempts - used),
        "passed": passed, "unlocked": total > 0 and watched == total,
        "pending_review": bool(last and last.graded_at is None),
        "latest_submission": _submission_data(last) if last else None,
    }


class ManagedModuleAssignmentAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request, module_id):
        module = _module(request.user, module_id)
        assignment = ModuleAssignment.objects.filter(module=module).first()
        return Response({"assignment": _assignment_data(assignment) if assignment else None})

    def put(self, request, module_id):
        module = _module(request.user, module_id)
        data = request.data
        if not isinstance(data, dict):
            return Response({"detail": "Provide assignment settings."}, status=400)
        title, instructions = data.get("title"), data.get("instructions")
        passing, attempts = data.get("passing_percent", 60), data.get("max_attempts", 3)
        if (not isinstance(title, str) or not 1 <= len(title.strip()) <= 180
                or not isinstance(instructions, str) or not 1 <= len(instructions.strip()) <= 12000
                or type(passing) is not int or not 1 <= passing <= 100
                or type(attempts) is not int or not 1 <= attempts <= 10):
            return Response({"detail": "Valid title, instructions, passing mark and attempts required."}, status=400)
        with transaction.atomic():
            assignment = ModuleAssignment.objects.select_for_update().filter(module=module).first()
            if assignment and (assignment.is_published or assignment.submissions.exists()):
                return Response({"detail": "Cannot change published or submitted assignments."}, status=409)
            if not assignment:
                assignment = ModuleAssignment(module=module)
            assignment.title, assignment.instructions = title.strip(), instructions.strip()
            assignment.passing_percent, assignment.max_attempts = passing, attempts
            assignment.full_clean()
            assignment.save()
        return Response({"assignment": _assignment_data(assignment)})

    def patch(self, request, module_id):
        if request.user.role != "college_admin":
            return Response({"detail": "Only College Admin may publish assignments."}, status=403)
        module = _module(request.user, module_id)
        if not isinstance(request.data, dict) or type(request.data.get("is_published")) is not bool:
            return Response({"detail": "is_published must be true or false."}, status=400)
        with transaction.atomic():
            assignment = get_object_or_404(
                ModuleAssignment.objects.select_for_update(), module=module,
            )
            desired = request.data["is_published"]
            if assignment.submissions.exists() and desired != assignment.is_published:
                return Response({"detail": "Assignment with student submissions cannot be unpublished."}, status=409)
            if desired and (not module.is_published or not module.lessons.filter(is_active=True).exists()):
                return Response({"detail": "Publish the module with an active lecture first."}, status=400)
            assignment.is_published = desired
            assignment.save(update_fields=["is_published", "updated_at"])
        return Response({"assignment": _assignment_data(assignment)})


class ManagedAssignmentSubmissionsAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request, module_id):
        module = _module(request.user, module_id)
        assignment = get_object_or_404(ModuleAssignment, module=module)
        submissions = assignment.submissions.select_related("student__user").order_by(
            "-submitted_at", "-pk",
        )
        return Response({"submissions": [_submission_data(s) for s in submissions]})


class ManagedAssignmentGradeAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def patch(self, request, submission_id):
        if request.user.role not in ("college_admin", "teacher"):
            return Response({"detail": "Teacher or College Admin required."}, status=403)
        data = request.data
        score, feedback = data.get("score_percent"), data.get("feedback", "")
        if (not isinstance(data, dict) or type(score) is not int or not 0 <= score <= 100
                or not isinstance(feedback, str) or len(feedback) > 5000):
            return Response({"detail": "Score 0-100 and optional feedback required."}, status=400)
        with transaction.atomic():
            submission = get_object_or_404(
                ModuleAssignmentSubmission.objects.select_for_update().select_related(
                    "assignment__module__course", "student__user",
                ).filter(assignment__module__course__in=_authorized_courses(request.user)),
                pk=submission_id,
            )
            if submission.graded_at is not None:
                return Response({"detail": "This submission has already been graded."}, status=409)
            submission.score_percent = score
            submission.feedback = feedback.strip()
            submission.graded_by = request.user
            submission.graded_at = timezone.now()
            submission.save(update_fields=["score_percent", "feedback", "graded_by", "graded_at"])
        return Response({"submission": _submission_data(submission)})


class ManagedSubmissionDownloadAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request, submission_id):
        submission = get_object_or_404(
            ModuleAssignmentSubmission.objects.select_related(
                "assignment__module__course",
            ).filter(assignment__module__course__in=_authorized_courses(request.user)),
            pk=submission_id,
        )
        if not submission.file:
            return Response({"detail": "No attachment."}, status=404)
        try:
            handle = submission.file.open("rb")
        except (OSError, FileNotFoundError):
            return Response({"detail": "Attachment unavailable."}, status=404)
        extension = Path(submission.file.name).suffix.lower()
        content_type = mimetypes.guess_type("file" + extension)[0] or "application/octet-stream"
        response = FileResponse(
            handle, as_attachment=True, filename="assignment-submission" + extension,
            content_type=content_type,
        )
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class StudentModuleAssignmentAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def _context(self, request, module_id):
        module = get_object_or_404(
            CourseModule.objects.select_related("course").filter(
                pk=module_id, is_published=True, course__is_active=True,
                course__organization=request.user.organization,
            ),
        )
        student, access = _student_access(request.user, module.course_id)
        return module, student, access

    def get(self, request, module_id):
        module, student, access = self._context(request, module_id)
        if student is None or access is None:
            return Response({"detail": "Active course access required."}, status=403)
        if not is_module_unlocked(module, student):
            return Response({"detail": "Complete the previous module first."}, status=403)
        status = student_assignment_status(module, student)
        if not status:
            return Response({"detail": "No published assignment."}, status=404)
        return Response({"assignment": status})

    def post(self, request, module_id):
        module, student, access = self._context(request, module_id)
        if student is None or access is None:
            return Response({"detail": "Active course access required."}, status=403)
        assignment = get_object_or_404(
            ModuleAssignment, module=module, is_published=True,
        )
        answer = request.data.get("answer_text", "")
        upload = request.FILES.get("file")
        if not isinstance(answer, str) or len(answer) > 20000 or (not answer.strip() and not upload):
            return Response({"detail": "Provide a written answer or file (max 25 MB)."}, status=400)
        if upload and upload.size > 25 * 1024 * 1024:
            return Response({"detail": "Attachment must not exceed 25 MB."}, status=400)
        with transaction.atomic():
            from accounts.models import StudentProfile
            StudentProfile.objects.select_for_update().get(pk=student.pk)
            if not is_module_unlocked(module, student):
                return Response({"detail": "Complete the previous module first."}, status=403)
            status = student_assignment_status(module, student)
            if not status or not status["unlocked"]:
                return Response({"detail": "Finish this module's video lessons first."}, status=403)
            if status["passed"]:
                return Response({"detail": "Assignment already passed."}, status=409)
            if status["pending_review"]:
                return Response({"detail": "Previous submission is awaiting grading."}, status=409)
            if status["attempts_remaining"] == 0:
                return Response({"detail": "No submission attempts remaining."}, status=403)
            submission = ModuleAssignmentSubmission(
                assignment=assignment, student=student,
                attempt_number=status["attempts_used"] + 1,
                answer_text=answer.strip(), file=upload,
            )
            try:
                submission.full_clean()
            except ValidationError as exc:
                return Response({"detail": "; ".join(exc.messages)}, status=400)
            submission.save()
        return Response({"submission": _submission_data(submission)}, status=201)
