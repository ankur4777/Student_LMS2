"""Private CSV export of the same student progress data shown in staff UI."""
import csv

from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .learning_access import OrganizationLearningEnabled
from .learning_content import _course, ManagedCourseProgressAPIView


def _safe_cell(value):
    """Guard Excel and other spreadsheet readers against CSV formula injection."""
    if value is None:
        return ""
    if not isinstance(value, str):
        return value
    if value and (value[0] in "\t\r\n\ufeff" or value.lstrip().startswith(("=", "+", "-", "@"))):
        return "'" + value
    return value


class ManagedCourseProgressCSVAPIView(APIView):
    """Export all search matches, not only the current dashboard page."""
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]
    MAX_STUDENTS = 2000
    MAX_ROWS = 10000
    PAGE_SIZE = 100

    def get(self, request, course_id):
        # Keep teacher assignment, role, and organization restrictions identical
        # to the existing staff progress dashboard.
        course = _course(request.user, course_id)
        search = request.query_params.get("search", "").strip()
        if len(search) > 80:
            return Response({"detail": "Search is limited to 80 characters."}, status=400)

        first = ManagedCourseProgressAPIView.report_page(
            course, 1, search, page_size=self.PAGE_SIZE,
        )
        count = first["students_total"]
        module_count = len(first["students"][0]["modules"]) if first["students"] else 0
        if count > self.MAX_STUDENTS or count * max(1, module_count) > self.MAX_ROWS:
            return Response({
                "detail": "Export is limited to 2,000 students and 10,000 rows. Narrow your search.",
            }, status=413)

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="mysls-course-{course.pk}-progress.csv"'
        )
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        response["Vary"] = "Authorization"
        response.write("\ufeff")  # UTF-8 BOM for Excel import compatibility
        writer = csv.writer(response)
        writer.writerow([
            "Student ID", "Student Name", "Admission Number", "Access Active",
            "Modules Completed", "Modules Total", "Course Progress (%)",
            "Lectures Viewed", "Lectures Total", "Session-Backed Lectures",
            "Final Exam Passed", "Final Exam Best (%)", "Certificate Status",
            "Module Position", "Module Title", "Module Completed",
            "Module Lectures Viewed", "Module Lectures Total",
            "Module Session-Backed Lectures", "Quiz Status", "Quiz Best (%)",
            "Assignment Status", "Assignment Best (%)",
        ])

        page = first
        while True:
            for student in page["students"]:
                # A zero-module course still gets one row per student.
                modules = student["modules"] or [None]
                for module in modules:
                    row = [
                        student["student_id"], student["student_name"],
                        student["admission_number"], student["access_active"],
                        student["modules_completed"], student["modules_total"],
                        student["progress_percent"], student["lectures_viewed"],
                        student["lectures_total"], student["session_backed_lectures"],
                        student["final_exam_passed"],
                        student["final_exam_best_percent"], student["certificate_status"],
                        module["position"] if module else "",
                        module["title"] if module else "",
                        module["completed"] if module else "",
                        module["lectures_viewed"] if module else "",
                        module["lectures_total"] if module else "",
                        module["session_backed_lectures"] if module else "",
                        module["quiz_status"] if module else "",
                        module["quiz_best_percent"] if module else "",
                        module["assignment_status"] if module else "",
                        module["assignment_best_percent"] if module else "",
                    ]
                    writer.writerow([_safe_cell(cell) for cell in row])
            if not page["has_next"]:
                break
            page = ManagedCourseProgressAPIView.report_page(
                course, page["page"] + 1, search, page_size=self.PAGE_SIZE,
            )
        return response
