"""College Admin course grants. Purchase-backed access is deliberately immutable here."""
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StudentProfile
from .learning_access import OrganizationLearningEnabled
from .models import RecordedCourse, RecordedCourseAccess, RecordedCoursePurchase


class ManagedCourseEnrollmentsAPIView(APIView):
    """Organization-scoped manual grants; never overwrite a paid entitlement."""
    permission_classes = [IsAuthenticated, OrganizationLearningEnabled]
    page_size = 25

    def course_for_admin(self, request, course_id):
        if request.user.role != "college_admin":
            return None
        return get_object_or_404(
            RecordedCourse, pk=course_id, organization=request.user.organization,
            is_active=True,
        )

    @staticmethod
    def access_data(access):
        if access is None:
            return {"status": "not_enrolled", "source": None, "expires_at": None}
        source = "purchase" if access.purchase_id else "manual"
        if access.has_access:
            status = "active"
        elif access.revoked_at:
            status = "revoked"
        elif access.expires_at and access.expires_at <= timezone.now():
            status = "expired"
        else:
            status = "inactive"
        return {
            "status": status, "source": source, "starts_at": access.starts_at,
            "expires_at": access.expires_at,
            "revoke_reason": access.revoke_reason if source == "manual" else "",
        }

    @staticmethod
    def student_id(data):
        if not isinstance(data, dict):
            return None
        value = data.get("student_id")
        if type(value) is not int or value <= 0:
            return None
        return value

    def get(self, request, course_id):
        course = self.course_for_admin(request, course_id)
        if course is None:
            return Response({"detail": "College Admin required."}, status=403)
        page_text = request.query_params.get("page", "1")
        if not page_text.isascii() or not page_text.isdecimal() or len(page_text) > 6:
            return Response({"detail": "Invalid page number."}, status=400)
        page = int(page_text)
        if not 1 <= page <= 100000:
            return Response({"detail": "Invalid page number."}, status=400)
        search = request.query_params.get("search", "").strip()
        if len(search) > 80:
            return Response({"detail": "Search must contain at most 80 characters."}, status=400)
        students = StudentProfile.objects.filter(
            user__organization=course.organization,
            user__role="student", user__is_active=True,
        ).select_related("user").order_by("user__username", "pk")
        if search:
            students = students.filter(
                Q(user__username__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(admission_number__icontains=search)
            )
        total = students.count()
        start = (page - 1) * self.page_size
        listed = list(students[start:start + self.page_size])
        accesses = {
            access.student_id: access
            for access in RecordedCourseAccess.objects.filter(
                course=course, organization=course.organization,
                student_id__in=[student.pk for student in listed],
            )
        }
        return Response({
            "course_id": course.pk, "course_title": course.title,
            "students_total": total, "page": page, "page_size": self.page_size,
            "has_next": start + self.page_size < total,
            "students": [{
                "id": student.pk,
                "name": student.user.get_full_name() or student.user.username,
                "username": student.user.username,
                "admission_number": student.admission_number,
                "access": self.access_data(accesses.get(student.pk)),
            } for student in listed],
        })

    def post(self, request, course_id):
        course = self.course_for_admin(request, course_id)
        if course is None:
            return Response({"detail": "College Admin required."}, status=403)
        student_id = self.student_id(request.data)
        duration = request.data.get("duration_days", course.access_duration_days) if isinstance(request.data, dict) else None
        if student_id is None or type(duration) is not int or not 1 <= duration <= 3650:
            return Response({"detail": "Valid student_id and duration_days (1-3650) required."}, status=400)
        with transaction.atomic():
            # Lock the course row to serialize simultaneous grants for this course.
            course = RecordedCourse.objects.select_for_update().get(pk=course.pk)
            student = get_object_or_404(
                StudentProfile.objects.select_related("user"),
                pk=student_id, user__organization=course.organization,
                user__role="student", user__is_active=True,
            )
            access = RecordedCourseAccess.objects.select_for_update().filter(
                course=course, student=student, organization=course.organization,
            ).first()
            if access is not None and access.purchase_id:
                return Response({"detail": "Purchase-backed access cannot be changed by manual enrollment."}, status=409)
            if RecordedCoursePurchase.objects.filter(
                course=course, student=student,
                organization=course.organization,
                status=RecordedCoursePurchase.Status.PAID,
            ).exists():
                return Response({"detail": "This student has a paid entitlement; use the purchase workflow."}, status=409)
            if access and access.has_access:
                return Response({"detail": "This student already has active course access."}, status=409)
            now = timezone.now()
            if access is None:
                access = RecordedCourseAccess(
                    organization=course.organization, course=course, student=student,
                )
            access.purchase = None
            access.starts_at = now
            access.expires_at = now + timedelta(days=duration)
            access.is_active = True
            access.revoked_at = None
            access.revoke_reason = ""
            access.save()
        return Response({
            "message": "Manual course access granted.",
            "student_id": student.pk,
            "access": self.access_data(access),
        }, status=201)

    def patch(self, request, course_id):
        course = self.course_for_admin(request, course_id)
        if course is None:
            return Response({"detail": "College Admin required."}, status=403)
        student_id = self.student_id(request.data)
        reason = request.data.get("reason") if isinstance(request.data, dict) else None
        if student_id is None or not isinstance(reason, str) or not 1 <= len(reason.strip()) <= 255:
            return Response({"detail": "Valid student_id and revocation reason (1-255 characters) required."}, status=400)
        with transaction.atomic():
            access = get_object_or_404(
                RecordedCourseAccess.objects.select_for_update(),
                course=course, student_id=student_id,
                organization=course.organization,
                student__user__organization=course.organization,
            )
            if access.purchase_id:
                return Response({"detail": "Purchase-backed access cannot be revoked here."}, status=409)
            if access.revoked_at is not None or not access.is_active:
                return Response({"detail": "Manual course access has already been revoked."}, status=409)
            access.revoked_at = timezone.now()
            access.revoke_reason = reason.strip()
            access.is_active = False
            access.save(update_fields=[
                "revoked_at", "revoke_reason", "is_active", "updated_at",
            ])
        return Response({
            "message": "Manual course access revoked.",
            "student_id": student_id,
            "access": self.access_data(access),
        })
