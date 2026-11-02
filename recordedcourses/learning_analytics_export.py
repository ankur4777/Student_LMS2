"""CSV download for College Admin learning analytics."""
import csv

from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .learning_access import OrganizationLearningEnabled
from .learning_analytics import OrganizationLearningAnalyticsAPIView
from .learning_progress_exports import _safe_cell

FIELDS = (
    ("Course ID", "course_id"),
    ("Course", "title"),
    ("Course Active", "active"),
    ("Published Modules", "published_modules"),
    ("Enrolled Students (per course)", "enrolled_students"),
    ("Active Enrollments", "active_enrollments"),
    ("Manual Active", "manual_active"),
    ("Purchased Active", "purchased_active"),
    ("Expired Enrollments", "expired_enrollments"),
    ("Revoked Enrollments", "revoked_enrollments"),
    ("Final Attempts", "final_attempts"),
    ("Students Attempted Final", "students_attempted_final"),
    ("Students Passed Final", "students_passed_final"),
    ("Average Attempt Score (%)", "average_attempt_score"),
    ("Pending Grading", "pending_assignment_grading"),
    ("Graduated Students", "graduated_students"),
    ("Valid Certificates", "valid_certificates"),
    ("Revoked Certificates", "revoked_certificates"),
    ("Graduation Rate (%)", "graduation_percent"),
)


class OrganizationLearningAnalyticsCSVAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]

    def get(self, request):
        if request.user.role != "college_admin":
            return Response({"detail": "College Admin required."}, status=403)
        search = request.query_params.get("search", "").strip()
        if len(search) > 80:
            return Response({"detail": "Search is limited to 80 characters."}, status=400)
        data = OrganizationLearningAnalyticsAPIView.summary_for_organization(
            request.user.organization,
        )
        if data is None:
            return Response({"detail": "Analytics supports up to 200 courses."}, status=413)
        rows = data["courses"]
        if search:
            rows = [row for row in rows if search.casefold() in row["title"].casefold()]

        result = HttpResponse(content_type="text/csv; charset=utf-8")
        result["Content-Disposition"] = 'attachment; filename="mysls-learning-analytics.csv"'
        result["Cache-Control"] = "private, no-store"
        result["X-Content-Type-Options"] = "nosniff"
        result["Vary"] = "Authorization"
        result.write("\ufeff")
        writer = csv.writer(result)
        writer.writerow([heading for heading, _ in FIELDS])
        additive = [key for _, key in FIELDS if key not in (
            "course_id", "title", "active", "average_attempt_score", "graduation_percent",
        )]
        total = {key: sum(row[key] for row in rows) for key in additive}
        total["title"] = "TOTAL (matching courses)"
        total["graduation_percent"] = (
            round(100 * total["graduated_students"] / total["enrolled_students"])
            if total["enrolled_students"] else 0
        )
        writer.writerow([_safe_cell(total.get(key)) for _, key in FIELDS])
        for row in rows:
            writer.writerow([_safe_cell(row.get(key)) for _, key in FIELDS])
        return result
