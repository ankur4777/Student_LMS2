"""Teacher/College Admin operational checklist for course certification readiness.

Read-only, organization-scoped. Does not change the publishing or certification
rules and does not leak student identity or answer keys.
"""
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .learning_access import OrganizationLearningEnabled
from .learning_content import _course
from .models import (
    CourseModule, ModuleQuiz, ModuleAssignment, CourseFinalExam,
    RecordedCourseAccess, ModuleAssignmentSubmission, CourseCertificate,
)


def _check(code, passed, message):
    return {"code": code, "passed": bool(passed), "message": message}


class ManagedCourseReadinessAPIView(APIView):
    """Operational preflight for the configured published-learning curriculum."""
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request, course_id):
        # Reuses course-scoped teacher assignment and College Admin tenant checks.
        course = _course(request.user, course_id)
        modules = list(
            CourseModule.objects.filter(course=course).annotate(
                active_lessons=Count(
                    "lessons", filter=Q(lessons__is_active=True), distinct=True,
                ),
                verified_lessons=Count(
                    "lessons", filter=Q(
                        lessons__is_active=True,
                        lessons__verified_duration_seconds__isnull=False,
                    ), distinct=True,
                ),
            ).order_by("position", "pk")
        )
        quizzes = {q.module_id: q for q in ModuleQuiz.objects.filter(
            module__course=course,
        ).annotate(question_count=Count("questions"))}
        assignments = {a.module_id: a for a in ModuleAssignment.objects.filter(
            module__course=course,
        )}
        published = [m for m in modules if m.is_published]
        exam = CourseFinalExam.objects.filter(course=course).annotate(
            question_count=Count("questions"),
        ).first()
        checks = [
            _check("active_course", course.is_active, "Course is active."),
            _check(
                "published_modules", bool(published),
                "At least one course module is published.",
            ),
            _check(
                "published_lessons",
                bool(published) and all(m.active_lessons > 0 for m in published),
                "Every published module contains an active recorded lesson.",
            ),
            _check(
                "video_durations_verified",
                bool(published) and all(
                    m.active_lessons > 0 and m.verified_lessons == m.active_lessons
                    for m in published
                ),
                "Every published active video has a server-verified duration.",
            ),
            _check(
                "final_exam_published", bool(exam and exam.is_published),
                "The final course examination is published.",
            ),
            _check(
                "final_exam_questions",
                bool(exam and exam.question_count > 0),
                "The final examination contains at least one question.",
            ),
        ]
        detail = []
        warnings = []
        for module in modules:
            quiz = quizzes.get(module.pk)
            assignment = assignments.get(module.pk)
            if not module.is_published:
                warnings.append("Module " + str(module.position) + " remains a draft and does not count toward completion.")
            if module.is_published and module.verified_lessons < module.active_lessons:
                warnings.append(
                    "Module " + str(module.position) + " has " +
                    str(module.active_lessons - module.verified_lessons) +
                    " video(s) awaiting server-side duration verification."
                )
            if module.is_published and quiz and not quiz.is_published:
                warnings.append("Draft quiz in module " + str(module.position) + " does not gate progression.")
            if module.is_published and assignment and not assignment.is_published:
                warnings.append("Draft assignment in module " + str(module.position) + " does not gate progression.")
            detail.append({
                "id": module.pk, "position": module.position, "title": module.title,
                "published": module.is_published,
                "active_lessons": module.active_lessons,
                "verified_lessons": module.verified_lessons,
                "quiz_status": "not_configured" if not quiz else
                    ("published" if quiz.is_published else "draft"),
                "quiz_questions": quiz.question_count if quiz else 0,
                "assignment_status": "not_configured" if not assignment else
                    ("published" if assignment.is_published else "draft"),
            })

        accesses = RecordedCourseAccess.objects.filter(
            course=course, organization=course.organization,
            student__user__organization=course.organization,
        )
        now = timezone.now()
        # Access values are a dashboard snapshot, not a payment or access decision.
        active = accesses.filter(
            is_active=True, revoked_at__isnull=True,
            starts_at__lte=now,
        ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        active_count = active.count()
        purchased_count = active.filter(purchase__isnull=False).count()
        enrollment = {
            "active": active_count,
            "manual_active": active_count - purchased_count,
            "purchased_active": purchased_count,
            "expired": accesses.filter(
                expires_at__lte=now, revoked_at__isnull=True,
            ).count(),
            "revoked": accesses.filter(revoked_at__isnull=False).count(),
            "pending_grading": ModuleAssignmentSubmission.objects.filter(
                assignment__module__course=course,
                assignment__module__is_published=True,
                assignment__is_published=True,
                graded_at__isnull=True,
            ).count(),
            "issued_certificates": CourseCertificate.objects.filter(
                course=course, revoked_at__isnull=True,
            ).count(),
        }
        return Response({
            "course_id": course.pk, "course_title": course.title,
            "ready_for_final_exam": all(item["passed"] for item in checks),
            "checks": checks, "warnings": warnings,
            "modules": detail, "enrollments": enrollment,
        })
