"""Private College Admin certificate registry export for one course."""
import csv

from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .learning_access import OrganizationLearningEnabled
from .learning_content import _course
from .learning_finals import _certificate_filters, _certificate_queryset
from .learning_progress_exports import _safe_cell


class ManagedCertificateCSVAPIView(APIView):
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]
    MAX_CERTIFICATES = 5000

    def get(self, request, course_id):
        if request.user.role != "college_admin":
            return Response({"detail": "College Admin required."}, status=403)
        course = _course(request.user, course_id)
        search, status_filter, error = _certificate_filters(request)
        if error:
            return Response({"detail": error}, status=400)
        qs = _certificate_queryset(course, search, status_filter)
        if qs.count() > self.MAX_CERTIFICATES:
            return Response({
                "detail": "Certificate export is limited to 5,000 rows. Narrow your search or status.",
            }, status=413)

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="mysls-course-{course.pk}-certificates.csv"'
        )
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        response["Vary"] = "Authorization"
        response.write("\ufeff")
        writer = csv.writer(response)
        writer.writerow([
            "Certificate ID", "Course", "Organization",
            "Student", "Admission Number", "Final Exam Score (%)",
            "Issued At (UTC)", "Status", "Revoked At (UTC)",
            "Revocation Reason",
        ])
        for cert in qs.iterator(chunk_size=200):
            writer.writerow([_safe_cell(value) for value in (
                str(cert.public_id), cert.course_title_at_issue,
                cert.organization_name_at_issue, cert.student_name_at_issue,
                cert.student.admission_number, cert.score_percent,
                cert.issued_at.isoformat(), "revoked" if cert.revoked_at else "issued",
                cert.revoked_at.isoformat() if cert.revoked_at else "",
                cert.revocation_reason if cert.revoked_at else "",
            )])
        return response
