from pathlib import Path

from django.http import FileResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StudentProfile, TeacherProfile
from academics.models import StudentEnrollment, TeacherAssignment

from .models import Document


MAX_DOCUMENT_SIZE = 20 * 1024 * 1024


def teacher_profile_for(user):
    if user.role != "teacher":
        return None

    return TeacherProfile.objects.filter(user=user).first()


def serialize_assignment(assignment):
    return {
        "teacher_assignment_id": assignment.id,
        "subject_name": assignment.subject.name,
        "classroom_name": assignment.section.classroom.name,
        "section_name": assignment.section.name,
    }


def serialize_document(document):
    assignment = document.teacher_assignment
    filename = Path(document.file.name).name if document.file else ""

    return {
        "id": document.id,
        "title": document.title,
        "description": document.description,
        "document_type": document.document_type,
        "is_published": document.is_published,
        "created_at": document.created_at,
        "updated_at": document.updated_at,
        "subject_name": assignment.subject.name,
        "classroom_name": assignment.section.classroom.name,
        "section_name": assignment.section.name,
        "filename": filename,
    }


def serialize_student_document(document):
    assignment = document.teacher_assignment
    teacher_user = assignment.teacher.user
    filename = Path(document.file.name).name if document.file else ""

    return {
        "id": document.id,
        "title": document.title,
        "description": document.description,
        "document_type": document.document_type,
        "created_at": document.created_at,
        "subject_name": assignment.subject.name,
        "teacher_name": (
            teacher_user.get_full_name().strip()
            or teacher_user.username
        ),
        "classroom_name": assignment.section.classroom.name,
        "section_name": assignment.section.name,
        "filename": filename,
    }


def student_enrollment_for(user):
    if user.role != "student":
        return None, None

    student_profile = StudentProfile.objects.filter(
        user=user
    ).first()

    if not student_profile:
        return None, None

    enrollment = StudentEnrollment.objects.filter(
        student=student_profile,
        is_active=True,
        section__organization=user.organization,
    ).select_related(
        "section",
        "section__classroom",
    ).first()

    return student_profile, enrollment


def teacher_assignments(user, teacher_profile):
    return TeacherAssignment.objects.filter(
        teacher=teacher_profile,
        is_active=True,
        section__organization=user.organization,
    ).select_related(
        "subject",
        "section",
        "section__classroom",
    )


def teacher_document(user, teacher_profile, document_id):
    return Document.objects.filter(
        id=document_id,
        organization=user.organization,
        uploaded_by=user,
        teacher_assignment__teacher=teacher_profile,
        teacher_assignment__section__organization=user.organization,
    ).select_related(
        "teacher_assignment",
        "teacher_assignment__subject",
        "teacher_assignment__section",
        "teacher_assignment__section__classroom",
    ).first()


class TeacherDocumentSetupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        teacher_profile = teacher_profile_for(request.user)

        if not teacher_profile:
            return Response(
                {"detail": "Only teachers can access documents."},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignments = teacher_assignments(
            request.user,
            teacher_profile,
        ).order_by(
            "section__classroom__name",
            "section__name",
            "subject__name",
        )

        return Response({
            "assignments": [
                serialize_assignment(assignment)
                for assignment in assignments
            ]
        })


class TeacherDocumentListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        teacher_profile = teacher_profile_for(request.user)

        if not teacher_profile:
            return Response(
                {"detail": "Only teachers can access documents."},
                status=status.HTTP_403_FORBIDDEN,
            )

        documents = Document.objects.filter(
            organization=request.user.organization,
            uploaded_by=request.user,
            teacher_assignment__teacher=teacher_profile,
            teacher_assignment__section__organization=request.user.organization,
        ).select_related(
            "teacher_assignment",
            "teacher_assignment__subject",
            "teacher_assignment__section",
            "teacher_assignment__section__classroom",
        )

        return Response({
            "documents": [
                serialize_document(document)
                for document in documents
            ]
        })


class TeacherDocumentUploadAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        teacher_profile = teacher_profile_for(request.user)

        if not teacher_profile:
            return Response(
                {"detail": "Only teachers can upload documents."},
                status=status.HTTP_403_FORBIDDEN,
            )

        teacher_assignment_id = request.data.get("teacher_assignment_id")
        title = request.data.get("title", "").strip()
        description = request.data.get("description", "").strip()
        document_type = request.data.get("document_type", Document.Type.OTHER)
        upload = request.FILES.get("file")
        is_published = request.data.get("is_published", False)

        if not teacher_assignment_id:
            return Response(
                {"detail": "teacher_assignment_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not title:
            return Response(
                {"detail": "Title is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if document_type not in Document.Type.values:
            return Response(
                {"detail": "Invalid document type."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not upload:
            return Response(
                {"detail": "File is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if upload.size > MAX_DOCUMENT_SIZE:
            return Response(
                {"detail": "File size cannot exceed 20 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment = teacher_assignments(
            request.user,
            teacher_profile,
        ).filter(id=teacher_assignment_id).first()

        if not assignment:
            return Response(
                {"detail": "Teaching assignment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if isinstance(is_published, str):
            publish = is_published.lower() in ["true", "1", "yes", "on"]
        else:
            publish = bool(is_published)

        document = Document.objects.create(
            organization=request.user.organization,
            uploaded_by=request.user,
            teacher_assignment=assignment,
            title=title,
            description=description,
            document_type=document_type,
            file=upload,
            is_published=publish,
            published_at=timezone.now() if publish else None,
        )

        return Response(
            {
                "message": "Document uploaded successfully.",
                "document": serialize_document(document),
            },
            status=status.HTTP_201_CREATED,
        )


class TeacherDocumentDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, document_id):
        teacher_profile = teacher_profile_for(request.user)

        if not teacher_profile:
            return Response(
                {"detail": "Only teachers can update documents."},
                status=status.HTTP_403_FORBIDDEN,
            )

        document = teacher_document(
            request.user,
            teacher_profile,
            document_id,
        )

        if not document:
            return Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if "title" in request.data:
            title = request.data.get("title", "").strip()

            if not title:
                return Response(
                    {"detail": "Title cannot be empty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            document.title = title

        if "description" in request.data:
            document.description = request.data.get("description", "").strip()

        if "document_type" in request.data:
            document_type = request.data.get("document_type")

            if document_type not in Document.Type.values:
                return Response(
                    {"detail": "Invalid document type."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            document.document_type = document_type

        if "is_published" in request.data:
            value = request.data.get("is_published")

            if isinstance(value, str):
                publish = value.lower() in ["true", "1", "yes", "on"]
            else:
                publish = bool(value)

            if publish and not document.is_published:
                document.published_at = timezone.now()
            elif not publish:
                document.published_at = None

            document.is_published = publish

        document.save()

        return Response({
            "message": "Document updated successfully.",
            "document": serialize_document(document),
        })

    def delete(self, request, document_id):
        teacher_profile = teacher_profile_for(request.user)

        if not teacher_profile:
            return Response(
                {"detail": "Only teachers can delete documents."},
                status=status.HTTP_403_FORBIDDEN,
            )

        document = teacher_document(
            request.user,
            teacher_profile,
            document_id,
        )

        if not document:
            return Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if document.file:
            document.file.delete(save=False)

        document.delete()

        return Response({
            "message": "Document deleted successfully."
        })


class TeacherDocumentDownloadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, document_id):
        teacher_profile = teacher_profile_for(request.user)

        if not teacher_profile:
            return Response(
                {"detail": "Only teachers can download documents."},
                status=status.HTTP_403_FORBIDDEN,
            )

        document = teacher_document(
            request.user,
            teacher_profile,
            document_id,
        )

        if not document or not document.file:
            return Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        filename = Path(document.file.name).name

        return FileResponse(
            document.file.open("rb"),
            as_attachment=True,
            filename=filename,
        )


class StudentDocumentListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        student_profile, enrollment = student_enrollment_for(
            request.user
        )

        if request.user.role != "student":
            return Response(
                {"detail": "Only students can access documents."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not student_profile:
            return Response(
                {"detail": "Student profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not enrollment:
            return Response(
                {"detail": "Active enrollment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        documents = Document.objects.filter(
            organization=request.user.organization,
            is_published=True,
            teacher_assignment__section=enrollment.section,
            teacher_assignment__section__organization=request.user.organization,
        ).select_related(
            "teacher_assignment",
            "teacher_assignment__subject",
            "teacher_assignment__teacher",
            "teacher_assignment__teacher__user",
            "teacher_assignment__section",
            "teacher_assignment__section__classroom",
        ).order_by(
            "-created_at"
        )

        return Response({
            "documents": [
                serialize_student_document(document)
                for document in documents
            ]
        })


class StudentDocumentDownloadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, document_id):
        student_profile, enrollment = student_enrollment_for(
            request.user
        )

        if request.user.role != "student":
            return Response(
                {"detail": "Only students can download documents."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not student_profile:
            return Response(
                {"detail": "Student profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not enrollment:
            return Response(
                {"detail": "Active enrollment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        document = Document.objects.filter(
            id=document_id,
            organization=request.user.organization,
            is_published=True,
            teacher_assignment__section=enrollment.section,
            teacher_assignment__section__organization=request.user.organization,
        ).select_related(
            "teacher_assignment",
            "teacher_assignment__section",
        ).first()

        if not document or not document.file:
            return Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        filename = Path(document.file.name).name

        return FileResponse(
            document.file.open("rb"),
            as_attachment=True,
            filename=filename,
        )
