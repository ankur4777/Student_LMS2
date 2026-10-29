"""On-demand certificate PDFs; never expose private student documents by public ID."""
from io import BytesIO

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from .models import CourseCertificate
from .student_learning import _student


def _fit(pdf, text, font, max_size, max_width, min_size=13):
    from reportlab.pdfbase.pdfmetrics import stringWidth
    size = max_size
    while size > min_size and stringWidth(text, font, size) > max_width:
        size -= 1
    if stringWidth(text, font, size) > max_width:
        while len(text) > 2 and stringWidth(text + "...", font, size) > max_width:
            text = text[:-1]
        text += "..."
    return text, size


def render_certificate(certificate, verification_url):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.utils import simpleSplit
    from reportlab.pdfgen.canvas import Canvas
    from reportlab.graphics.barcode.qr import QrCodeWidget
    from reportlab.graphics.shapes import Drawing
    from reportlab.graphics import renderPDF

    width, height = landscape(A4)
    stream = BytesIO()
    pdf = Canvas(stream, pagesize=(width, height), pageCompression=1)
    pdf.setTitle("MySLS Course Completion Certificate")
    pdf.setAuthor("MySLS Learning Center")
    navy, red, grey = colors.HexColor("#192841"), colors.HexColor("#CB3347"), colors.HexColor("#586881")
    pdf.setFillColor(colors.HexColor("#FBFCFE"))
    pdf.rect(0, 0, width, height, stroke=0, fill=1)
    pdf.setStrokeColor(navy)
    pdf.setLineWidth(2)
    pdf.roundRect(30, 29, width-60, height-58, 15, stroke=1, fill=0)
    pdf.setStrokeColor(colors.HexColor("#E8D0D4"))
    pdf.setLineWidth(1)
    pdf.roundRect(41, 40, width-82, height-80, 11, stroke=1, fill=0)

    pdf.setFillColor(red)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawCentredString(width/2, height-101, "SHABDD LEARNING SOLUTION  |  MySLS")
    pdf.setFillColor(navy)
    pdf.setFont("Helvetica-Bold", 30)
    pdf.drawCentredString(width/2, height-151, "Certificate of Completion")
    pdf.setFillColor(grey)
    pdf.setFont("Helvetica", 12)
    pdf.drawCentredString(width/2, height-189, "This certifies that")
    name, size = _fit(pdf, certificate.student_name_at_issue, "Helvetica-Bold", 25, width-150)
    pdf.setFillColor(navy)
    pdf.setFont("Helvetica-Bold", size)
    pdf.drawCentredString(width/2, height-225, name)
    pdf.setStrokeColor(red)
    pdf.setLineWidth(1.2)
    pdf.line(180, height-239, width-180, height-239)
    pdf.setFillColor(grey)
    pdf.setFont("Helvetica", 12)
    pdf.drawCentredString(width/2, height-271, "has successfully completed all required modules and passed the final exam for")
    course, size = _fit(pdf, certificate.course_title_at_issue, "Helvetica-Bold", 19, width-190)
    pdf.setFont("Helvetica-Bold", size)
    pdf.setFillColor(navy)
    pdf.drawCentredString(width/2, height-303, course)
    org, size = _fit(pdf, certificate.organization_name_at_issue, "Helvetica", 13, width-160)
    pdf.setFont("Helvetica", size)
    pdf.setFillColor(grey)
    pdf.drawCentredString(width/2, height-330, org)

    pdf.setFont("Helvetica", 10)
    pdf.drawString(90, 154, "Issued on")
    pdf.drawString(290, 154, "Final Exam Result")
    pdf.drawString(495, 154, "Completed Modules")
    pdf.setFont("Helvetica-Bold", 13)
    pdf.setFillColor(navy)
    pdf.drawString(90, 134, certificate.issued_at.strftime("%d %B %Y"))
    pdf.drawString(290, 134, f"{certificate.score_percent}%")
    pdf.drawString(495, 134, str(certificate.module_count_at_issue))
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(grey)
    pdf.drawString(90, 86, f"Certificate ID: {certificate.public_id}")
    pdf.drawString(90, 70, "Verify using the QR code or certificate ID.")
    qr = QrCodeWidget(verification_url)
    bounds = qr.getBounds()
    qr_size = 78
    drawing = Drawing(qr_size, qr_size, transform=[
        qr_size / (bounds[2]-bounds[0]), 0, 0,
        qr_size / (bounds[3]-bounds[1]), 0, 0,
    ])
    drawing.add(qr)
    renderPDF.draw(drawing, pdf, width-145, 70)
    pdf.save()
    stream.seek(0)
    return stream.getvalue()


class StudentCertificatePDFAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, public_id):
        student = _student(request.user)
        if student is None:
            return HttpResponse(status=403)
        certificate = get_object_or_404(
            CourseCertificate,
            public_id=public_id, student=student,
            organization=request.user.organization,
        )
        if certificate.revoked_at:
            return HttpResponse("Certificate was revoked.", status=410, content_type="text/plain")
        # QR opens the friendly public verification page on the configured frontend.
        # LMS_FRONTEND_URL defaults to http://localhost:3000 for local development.
        from django.conf import settings
        verification_url = (
            settings.LMS_FRONTEND_URL.rstrip("/")
            + f"/verify/certificate/{certificate.public_id}"
        )
        output = render_certificate(certificate, verification_url)
        response = HttpResponse(output, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="mysls-certificate-{certificate.public_id}.pdf"'
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class StudentCertificatesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        student = _student(request.user)
        if student is None:
            return HttpResponse(status=403)
        certificates = CourseCertificate.objects.filter(
            student=student, organization=request.user.organization,
        )
        from rest_framework.response import Response
        return Response({"certificates": [{
            "id": str(c.public_id), "course_id": c.course_id,
            "course_title": c.course_title_at_issue, "issued_at": c.issued_at,
            "score_percent": c.score_percent, "revoked": c.revoked_at is not None,
        } for c in certificates]})
