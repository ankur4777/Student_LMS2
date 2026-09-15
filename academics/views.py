from django.db import IntegrityError
from django.utils.dateparse import parse_date

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AcademicSession


def college_admin_organization(user):
    if user.role != "college_admin" or not user.is_active:
        return None

    if not user.organization or not user.organization.is_active:
        return None

    return user.organization


def serialize_academic_session(session):
    return {
        "id": session.id,
        "name": session.name,
        "start_date": session.start_date,
        "end_date": session.end_date,
        "is_active": session.is_active,
    }


def college_academic_session_queryset(organization):
    return AcademicSession.objects.filter(
        organization=organization
    )


def validate_session_payload(data, organization, session=None):
    name = session.name if session else ""
    start_date = session.start_date if session else None
    end_date = session.end_date if session else None
    is_active = session.is_active if session else False

    if "name" in data or not session:
        name = data.get("name", "").strip()

        if not name:
            return None, {"detail": "Academic session name is required."}, 400

    if "start_date" in data or not session:
        start_date = parse_date(data.get("start_date", ""))

        if not start_date:
            return None, {"detail": "Start date is required."}, 400

    if "end_date" in data or not session:
        end_date = parse_date(data.get("end_date", ""))

        if not end_date:
            return None, {"detail": "End date is required."}, 400

    if end_date < start_date:
        return (
            None,
            {"detail": "End date must not be before start date."},
            400,
        )

    if "is_active" in data:
        value = data.get("is_active")
        is_active = (
            value.lower() in ["true", "1", "yes", "on"]
            if isinstance(value, str)
            else bool(value)
        )

    duplicate = AcademicSession.objects.filter(
        organization=organization,
        name=name,
    )

    if session:
        duplicate = duplicate.exclude(id=session.id)

    if duplicate.exists():
        return (
            None,
            {
                "detail": (
                    "An academic session with this name already exists."
                )
            },
            400,
        )

    return {
        "name": name,
        "start_date": start_date,
        "end_date": end_date,
        "is_active": is_active,
    }, None, None


class CollegeAdminAcademicSessionsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can view academic sessions."},
                status=403
            )

        sessions = college_academic_session_queryset(
            organization
        ).order_by(
            "-is_active",
            "-start_date",
            "name",
        )

        return Response({
            "academic_sessions": [
                serialize_academic_session(session)
                for session in sessions
            ]
        })

    def post(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {
                    "detail": (
                        "Only college admins can create academic sessions."
                    )
                },
                status=403
            )

        values, error, status_code = validate_session_payload(
            request.data,
            organization,
        )

        if error:
            return Response(error, status=status_code)

        try:
            session = AcademicSession.objects.create(
                organization=organization,
                **values
            )
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "An academic session with this name already exists."
                    )
                },
                status=400
            )

        return Response(
            {
                "message": "Academic session saved successfully.",
                "academic_session": serialize_academic_session(session),
            },
            status=201
        )


class CollegeAdminAcademicSessionDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_session(self, user, session_id):
        organization = college_admin_organization(user)

        if not organization:
            return None

        return college_academic_session_queryset(
            organization
        ).filter(
            id=session_id
        ).first()

    def get(self, request, session_id):
        session = self.get_session(request.user, session_id)

        if not session:
            return Response(
                {"detail": "Academic session not found."},
                status=404
            )

        return Response({
            "academic_session": serialize_academic_session(session)
        })

    def patch(self, request, session_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {
                    "detail": (
                        "Only college admins can update academic sessions."
                    )
                },
                status=403
            )

        session = self.get_session(request.user, session_id)

        if not session:
            return Response(
                {"detail": "Academic session not found."},
                status=404
            )

        values, error, status_code = validate_session_payload(
            request.data,
            organization,
            session=session,
        )

        if error:
            return Response(error, status=status_code)

        session.name = values["name"]
        session.start_date = values["start_date"]
        session.end_date = values["end_date"]
        session.is_active = values["is_active"]

        try:
            session.save(
                update_fields=[
                    "name",
                    "start_date",
                    "end_date",
                    "is_active",
                ]
            )
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "An academic session with this name already exists."
                    )
                },
                status=400
            )

        return Response({
            "message": "Academic session updated successfully.",
            "academic_session": serialize_academic_session(session),
        })
