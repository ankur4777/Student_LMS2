from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.models import AcademicSession, ClassRoom

from .models import FeeComponent, FeeStructure


def college_admin_organization(user):
    if user.role != "college_admin" or not user.is_active:
        return None

    if not user.organization or not user.organization.is_active:
        return None

    return user.organization


def parse_money(value, field_name):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None, {field_name: "Enter a valid amount."}

    amount = amount.quantize(Decimal("0.01"))

    if amount < Decimal("0.00"):
        return None, {field_name: "Amount cannot be negative."}

    return amount, None


def validation_error_response(error):
    if hasattr(error, "message_dict"):
        return Response(error.message_dict, status=400)

    return Response({"detail": str(error)}, status=400)


def serialize_fee_component(component):
    return {
        "id": component.id,
        "name": component.name,
        "amount": component.amount,
        "description": component.description,
    }


def serialize_fee_structure(fee_structure, include_components=False):
    classroom = fee_structure.class_room
    data = {
        "id": fee_structure.id,
        "name": fee_structure.name,
        "description": fee_structure.description,
        "total_amount": fee_structure.total_amount,
        "due_date": fee_structure.due_date,
        "is_active": fee_structure.is_active,
        "academic_session": {
            "id": fee_structure.academic_session_id,
            "name": fee_structure.academic_session.name,
        },
        "class_room": {
            "id": classroom.id,
            "name": classroom.name,
        },
        "created_at": fee_structure.created_at,
        "updated_at": fee_structure.updated_at,
    }

    if include_components:
        data["components"] = [
            serialize_fee_component(component)
            for component in fee_structure.components.all()
        ]

    return data


def fee_structure_queryset(organization):
    return FeeStructure.objects.filter(
        organization=organization,
        academic_session__organization=organization,
        class_room__organization=organization,
    ).select_related(
        "academic_session",
        "class_room",
    ).prefetch_related(
        "components",
    )


def validate_components(component_data, total_amount):
    if not isinstance(component_data, list) or len(component_data) == 0:
        return None, {"components": "At least one fee component is required."}

    components = []
    component_total = Decimal("0.00")

    for index, item in enumerate(component_data):
        name = str(item.get("name", "")).strip()
        description = str(item.get("description", "") or "").strip()

        if not name:
            return None, {
                "components": f"Component {index + 1} name is required."
            }

        amount, error = parse_money(
            item.get("amount"),
            "amount",
        )

        if error:
            return None, {
                "components": f"Component {index + 1}: {error['amount']}"
            }

        components.append({
            "name": name,
            "amount": amount,
            "description": description,
        })
        component_total += amount

    if component_total != total_amount:
        return None, {
            "components": "Component total must match fee structure total."
        }

    return components, None


def validate_fee_structure_payload(data, organization, instance=None):
    is_create = instance is None
    values = {}

    if is_create or "academic_session_id" in data:
        academic_session = AcademicSession.objects.filter(
            id=data.get("academic_session_id"),
            organization=organization,
        ).first()

        if not academic_session:
            return None, {"detail": "Academic session not found."}, 404

        values["academic_session"] = academic_session

    if is_create or "class_room_id" in data:
        class_room = ClassRoom.objects.filter(
            id=data.get("class_room_id"),
            organization=organization,
        ).select_related(
            "academic_session"
        ).first()

        if not class_room:
            return None, {"detail": "Class not found."}, 404

        values["class_room"] = class_room

    academic_session = values.get(
        "academic_session",
        instance.academic_session if instance else None,
    )
    class_room = values.get(
        "class_room",
        instance.class_room if instance else None,
    )

    if (
        academic_session
        and class_room
        and class_room.academic_session_id != academic_session.id
    ):
        return (
            None,
            {"detail": "Class must belong to the academic session."},
            400,
        )

    if is_create or "name" in data:
        name = str(data.get("name", "")).strip()

        if not name:
            return None, {"detail": "Name is required."}, 400

        values["name"] = name

    if "description" in data:
        values["description"] = str(data.get("description") or "").strip()
    elif is_create:
        values["description"] = ""

    if is_create or "total_amount" in data:
        total_amount, error = parse_money(
            data.get("total_amount"),
            "total_amount",
        )

        if error:
            return None, error, 400

        values["total_amount"] = total_amount

    if "due_date" in data or is_create:
        values["due_date"] = data.get("due_date") or None

    if "is_active" in data:
        value = data.get("is_active")
        values["is_active"] = (
            value.lower() in ["true", "1", "yes", "on"]
            if isinstance(value, str)
            else bool(value)
        )
    elif is_create:
        values["is_active"] = True

    total_amount = values.get(
        "total_amount",
        instance.total_amount if instance else Decimal("0.00"),
    )

    if is_create or "components" in data:
        components, error = validate_components(
            data.get("components", []),
            total_amount,
        )

        if error:
            return None, error, 400

        values["components"] = components

    return values, None, None


class CollegeAdminFeeSetupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can access fee setup."},
                status=403,
            )

        sessions = AcademicSession.objects.filter(
            organization=organization
        ).order_by("-is_active", "name")
        classes = ClassRoom.objects.filter(
            organization=organization,
            academic_session__organization=organization,
        ).select_related("academic_session").order_by("name")

        return Response({
            "academic_sessions": [
                {
                    "id": session.id,
                    "name": session.name,
                    "is_active": session.is_active,
                }
                for session in sessions
            ],
            "classes": [
                {
                    "id": classroom.id,
                    "name": classroom.name,
                    "academic_session_id": classroom.academic_session_id,
                }
                for classroom in classes
            ],
        })


class CollegeAdminFeeStructuresAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can access fee structures."},
                status=403,
            )

        structures = fee_structure_queryset(organization).order_by(
            "-is_active",
            "name",
        )
        search = request.query_params.get("search", "").strip()

        if search:
            structures = structures.filter(name__icontains=search)

        return Response({
            "structures": [
                serialize_fee_structure(structure)
                for structure in structures
            ]
        })

    def post(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can create fee structures."},
                status=403,
            )

        values, error, status_code = validate_fee_structure_payload(
            request.data,
            organization,
        )

        if error:
            return Response(error, status=status_code)

        components = values.pop("components")

        try:
            with transaction.atomic():
                fee_structure = FeeStructure(
                    organization=organization,
                    **values,
                )
                fee_structure.full_clean()
                fee_structure.save()

                for component_data in components:
                    component = FeeComponent(
                        fee_structure=fee_structure,
                        **component_data,
                    )
                    component.full_clean()
                    component.save()
        except ValidationError as exc:
            return validation_error_response(exc)
        except IntegrityError:
            return Response(
                {"detail": "A fee structure with these details already exists."},
                status=400,
            )

        return Response(
            {
                "message": "Fee structure created successfully.",
                "structure": serialize_fee_structure(
                    fee_structure,
                    include_components=True,
                ),
            },
            status=201,
        )


class CollegeAdminFeeStructureDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_structure(self, user, structure_id):
        organization = college_admin_organization(user)

        if not organization:
            return None

        return fee_structure_queryset(organization).filter(
            id=structure_id
        ).first()

    def get(self, request, structure_id):
        structure = self.get_structure(request.user, structure_id)

        if not structure:
            return Response(
                {"detail": "Fee structure not found."},
                status=404,
            )

        return Response({
            "structure": serialize_fee_structure(
                structure,
                include_components=True,
            )
        })

    def patch(self, request, structure_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can update fee structures."},
                status=403,
            )

        structure = self.get_structure(request.user, structure_id)

        if not structure:
            return Response(
                {"detail": "Fee structure not found."},
                status=404,
            )

        values, error, status_code = validate_fee_structure_payload(
            request.data,
            organization,
            instance=structure,
        )

        if error:
            return Response(error, status=status_code)

        components = values.pop("components", None)

        try:
            with transaction.atomic():
                for field, value in values.items():
                    setattr(structure, field, value)

                structure.full_clean()
                structure.save()

                if components is not None:
                    structure.components.all().delete()
                    for component_data in components:
                        component = FeeComponent(
                            fee_structure=structure,
                            **component_data,
                        )
                        component.full_clean()
                        component.save()
        except ValidationError as exc:
            return validation_error_response(exc)
        except IntegrityError:
            return Response(
                {"detail": "A fee structure with these details already exists."},
                status=400,
            )

        return Response({
            "message": "Fee structure updated successfully.",
            "structure": serialize_fee_structure(
                structure,
                include_components=True,
            ),
        })
