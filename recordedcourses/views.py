from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import RecordedCourse, RecordedLesson


def college_admin_organization(user):
    if user.role != "college_admin" or not user.is_active:
        return None
    if not user.organization or not user.organization.is_active:
        return None
    return user.organization


def serialize_lesson(lesson):
    return {
        "id": lesson.id,
        "title": lesson.title,
        "description": lesson.description,
        "position": lesson.position,
        "is_active": lesson.is_active,
        "created_at": lesson.created_at,
        "updated_at": lesson.updated_at,
    }


def serialize_course(course, include_lessons=False):
    data = {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "price": course.price,
        "access_duration_days": course.access_duration_days,
        "is_active": course.is_active,
        "lesson_count": getattr(course, "lesson_count", course.lessons.count()),
        "created_at": course.created_at,
        "updated_at": course.updated_at,
    }
    if include_lessons:
        data["lessons"] = [serialize_lesson(lesson) for lesson in course.lessons.all()]
    return data


def parse_price(value):
    try:
        price = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return price if price >= 0 else None


def parse_positive_int(value):
    try:
        value = int(value)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def parse_bool(value, default=True):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"1", "true", "yes", "on"}


class CollegeAdminRecordedCoursesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can access recorded courses."}, status=403)

        courses = RecordedCourse.objects.filter(organization=organization).prefetch_related("lessons")
        search = request.query_params.get("search", "").strip()
        if search:
            courses = courses.filter(title__icontains=search)
        return Response({"courses": [serialize_course(course) for course in courses]})

    def post(self, request):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can create recorded courses."}, status=403)

        title = str(request.data.get("title", "")).strip()
        price = parse_price(request.data.get("price"))
        duration = parse_positive_int(request.data.get("access_duration_days", 180))
        errors = {}
        if not title:
            errors["title"] = "Title is required."
        if price is None:
            errors["price"] = "Enter a valid non-negative price."
        if duration is None:
            errors["access_duration_days"] = "Access duration must be greater than zero."
        if errors:
            return Response(errors, status=400)

        try:
            course = RecordedCourse(
                organization=organization,
                title=title,
                description=str(request.data.get("description", "")).strip(),
                price=price,
                access_duration_days=duration,
                is_active=parse_bool(request.data.get("is_active"), True),
            )
            course.full_clean()
            course.save()
        except (ValidationError, IntegrityError):
            return Response({"detail": "A recorded course with these details already exists or is invalid."}, status=400)

        return Response({"message": "Recorded course created successfully.", "course": serialize_course(course)}, status=201)


class CollegeAdminRecordedCourseDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_course(self, user, course_id):
        organization = college_admin_organization(user)
        if not organization:
            return None
        return RecordedCourse.objects.filter(id=course_id, organization=organization).prefetch_related("lessons").first()

    def get(self, request, course_id):
        course = self.get_course(request.user, course_id)
        if not course:
            return Response({"detail": "Recorded course not found."}, status=404)
        return Response({"course": serialize_course(course, include_lessons=True)})

    def patch(self, request, course_id):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can update recorded courses."}, status=403)

        course = RecordedCourse.objects.filter(id=course_id, organization=organization).first()
        if not course:
            return Response({"detail": "Recorded course not found."}, status=404)

        if "title" in request.data:
            title = str(request.data.get("title", "")).strip()
            if not title:
                return Response({"title": "Title is required."}, status=400)
            course.title = title
        if "description" in request.data:
            course.description = str(request.data.get("description", "")).strip()
        if "price" in request.data:
            price = parse_price(request.data.get("price"))
            if price is None:
                return Response({"price": "Enter a valid non-negative price."}, status=400)
            course.price = price
        if "access_duration_days" in request.data:
            duration = parse_positive_int(request.data.get("access_duration_days"))
            if duration is None:
                return Response({"access_duration_days": "Access duration must be greater than zero."}, status=400)
            course.access_duration_days = duration
        if "is_active" in request.data:
            course.is_active = parse_bool(request.data.get("is_active"))

        try:
            course.full_clean()
            course.save()
        except (ValidationError, IntegrityError):
            return Response({"detail": "Recorded course update is invalid."}, status=400)

        return Response({"message": "Recorded course updated successfully.", "course": serialize_course(course)})


class CollegeAdminRecordedCourseLessonsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_course(self, user, course_id):
        organization = college_admin_organization(user)
        if not organization:
            return None
        return RecordedCourse.objects.filter(id=course_id, organization=organization).first()

    def get(self, request, course_id):
        course = self.get_course(request.user, course_id)
        if not course:
            return Response({"detail": "Recorded course not found."}, status=404)
        return Response({"lessons": [serialize_lesson(lesson) for lesson in course.lessons.all()]})

    def post(self, request, course_id):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can upload recorded lessons."}, status=403)

        course = RecordedCourse.objects.filter(id=course_id, organization=organization).first()
        if not course:
            return Response({"detail": "Recorded course not found."}, status=404)

        title = str(request.data.get("title", "")).strip()
        position = parse_positive_int(request.data.get("position"))
        video = request.FILES.get("video")
        errors = {}
        if not title:
            errors["title"] = "Title is required."
        if position is None:
            errors["position"] = "Position must be greater than zero."
        if not video:
            errors["video"] = "Video file is required."
        if errors:
            return Response(errors, status=400)

        try:
            with transaction.atomic():
                lesson = RecordedLesson(
                    course=course,
                    title=title,
                    description=str(request.data.get("description", "")).strip(),
                    position=position,
                    video=video,
                    is_active=parse_bool(request.data.get("is_active"), True),
                )
                lesson.full_clean()
                lesson.save()
        except (ValidationError, IntegrityError):
            return Response({"detail": "Lesson is invalid or that position is already in use."}, status=400)

        return Response({"message": "Recorded lesson uploaded successfully.", "lesson": serialize_lesson(lesson)}, status=201)


class CollegeAdminRecordedLessonDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_lesson(self, user, lesson_id):
        organization = college_admin_organization(user)
        if not organization:
            return None
        return RecordedLesson.objects.select_related("course").filter(
            id=lesson_id, course__organization=organization
        ).first()

    def patch(self, request, lesson_id):
        lesson = self.get_lesson(request.user, lesson_id)
        if not lesson:
            return Response({"detail": "Recorded lesson not found."}, status=404)

        if "title" in request.data:
            title = str(request.data.get("title", "")).strip()
            if not title:
                return Response({"title": "Title is required."}, status=400)
            lesson.title = title
        if "description" in request.data:
            lesson.description = str(request.data.get("description", "")).strip()
        if "position" in request.data:
            position = parse_positive_int(request.data.get("position"))
            if position is None:
                return Response({"position": "Position must be greater than zero."}, status=400)
            lesson.position = position
        if "is_active" in request.data:
            lesson.is_active = parse_bool(request.data.get("is_active"))
        if request.FILES.get("video"):
            lesson.video = request.FILES["video"]

        try:
            lesson.full_clean()
            lesson.save()
        except (ValidationError, IntegrityError):
            return Response({"detail": "Lesson update is invalid or that position is already in use."}, status=400)

        return Response({"message": "Recorded lesson updated successfully.", "lesson": serialize_lesson(lesson)})
