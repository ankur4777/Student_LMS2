"""College Admin organization-level Recorded Learning analytics.

Aggregates only the authenticated institution; no student names, answer
keys or external organization identifiers are returned.
"Course graduated" means a certificate record exists (including revoked
certificates), rather than self-reported video attendance.
"""
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .learning_access import OrganizationLearningEnabled
from .models import (
    CourseCertificate, CourseFinalAttempt, CourseModule,
    ModuleAssignmentSubmission, RecordedCourse, RecordedCourseAccess,
)


class OrganizationLearningAnalyticsAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]
    MAX_COURSES = 200

    def get(self, request):
        if request.user.role != "college_admin":
            return Response({"detail": "College Admin required."}, status=403)
        organization = request.user.organization
        courses = list(RecordedCourse.objects.filter(
            organization=organization,
        ).order_by("title", "pk").values("id", "title", "is_active")[:self.MAX_COURSES + 1])
        if len(courses) > self.MAX_COURSES:
            return Response({
                "detail": "Analytics supports up to 200 courses. Contact an administrator for an extended report.",
            }, status=413)
        course_ids = [c["id"] for c in courses]
        now = timezone.now()
        active_filter = (
            Q(is_active=True, revoked_at__isnull=True, starts_at__lte=now)
            & (Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        )
        access_stats = {
            row["course_id"]: row
            for row in RecordedCourseAccess.objects.filter(
                course_id__in=course_ids, organization=organization,
                student__user__organization=organization,
            ).values("course_id").annotate(
                enrolled=Count("student_id", distinct=True),
                active=Count("student_id", filter=active_filter, distinct=True),
                active_manual=Count(
                    "student_id",
                    filter=active_filter & Q(purchase__isnull=True), distinct=True,
                ),
                active_paid=Count(
                    "student_id",
                    filter=active_filter & Q(purchase__isnull=False), distinct=True,
                ),
                expired=Count(
                    "student_id",
                    filter=Q(revoked_at__isnull=True, expires_at__lte=now),
                    distinct=True,
                ),
                revoked_access=Count(
                    "student_id", filter=Q(revoked_at__isnull=False), distinct=True,
                ),
            )
        }
        module_stats = {
            row["course_id"]: row
            for row in CourseModule.objects.filter(
                course_id__in=course_ids, is_published=True,
            ).values("course_id").annotate(
                modules=Count("id", distinct=True),
            )
        }
        exam_stats = {
            row["exam__course_id"]: row
            for row in CourseFinalAttempt.objects.filter(
                exam__course_id__in=course_ids,
                student__user__organization=organization,
            ).values("exam__course_id").annotate(
                attempts=Count("id"),
                attempted_students=Count("student_id", distinct=True),
                passed_students=Count(
                    "student_id", filter=Q(passed=True), distinct=True,
                ),
                mean_attempt_score=Avg("score_percent"),
            )
        }
        pending_grades = {
            row["assignment__module__course_id"]: row["pending"]
            for row in ModuleAssignmentSubmission.objects.filter(
                assignment__module__course_id__in=course_ids,
                assignment__module__is_published=True,
                assignment__is_published=True,
                student__user__organization=organization,
                graded_at__isnull=True,
            ).values("assignment__module__course_id").annotate(pending=Count("pk"))
        }
        certificate_stats = {
            row["course_id"]: row
            for row in CourseCertificate.objects.filter(
                course_id__in=course_ids, organization=organization,
                student__user__organization=organization,
            ).values("course_id").annotate(
                graduated_students=Count("student_id", distinct=True),
                valid_certificates=Count(
                    "pk", filter=Q(revoked_at__isnull=True),
                ),
                revoked_certificates=Count(
                    "pk", filter=Q(revoked_at__isnull=False),
                ),
            )
        }
        rows = []
        for course in courses:
            cid = course["id"]
            access, exam = access_stats.get(cid, {}), exam_stats.get(cid, {})
            cert = certificate_stats.get(cid, {})
            enrolled = access.get("enrolled", 0)
            graduated = cert.get("graduated_students", 0)
            rows.append({
                "course_id": cid, "title": course["title"], "active": course["is_active"],
                "published_modules": module_stats.get(cid, {}).get("modules", 0),
                "enrolled_students": enrolled,
                "active_enrollments": access.get("active", 0),
                "manual_active": access.get("active_manual", 0),
                "purchased_active": access.get("active_paid", 0),
                "expired_enrollments": access.get("expired", 0),
                "revoked_enrollments": access.get("revoked_access", 0),
                "final_attempts": exam.get("attempts", 0),
                "students_attempted_final": exam.get("attempted_students", 0),
                "students_passed_final": exam.get("passed_students", 0),
                "average_attempt_score": (
                    round(exam["mean_attempt_score"], 1)
                    if exam.get("mean_attempt_score") is not None else None
                ),
                "pending_assignment_grading": pending_grades.get(cid, 0),
                "graduated_students": graduated,
                "valid_certificates": cert.get("valid_certificates", 0),
                "revoked_certificates": cert.get("revoked_certificates", 0),
                "graduation_percent": round(100 * graduated / enrolled)
                    if enrolled else 0,
            })
        sums = (
            "enrolled_students", "active_enrollments", "manual_active",
            "purchased_active", "expired_enrollments", "revoked_enrollments",
            "final_attempts", "students_attempted_final", "students_passed_final",
            "pending_assignment_grading", "graduated_students",
            "valid_certificates", "revoked_certificates",
        )
        totals = {key: sum(row[key] for row in rows) for key in sums}
        totals["courses"] = len(rows)
        totals["active_courses"] = sum(1 for c in courses if c["is_active"])
        totals["graduation_percent"] = round(
            100 * totals["graduated_students"] / totals["enrolled_students"]
        ) if totals["enrolled_students"] else 0
        return Response({
            "totals": totals, "courses": rows,
            "definitions": {
                "enrolled_students": "Course-student access records, counted once per course.",
                "graduated_students": "Students with issued certificate records, including certificates later revoked.",
                "graduation_percent": "Graduated students divided by enrolled students per course.",
                "average_attempt_score": "Average score across final-exam attempts, not each student's best score.",
                "active_enrollments": "Access is enabled, started, not revoked and not expired.",
            },
        })
