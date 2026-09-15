from django.utils import timezone
from django.db import IntegrityError, transaction
from django.db.models import Count, Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import StudentProfile, User

from attendance.models import StudentAttendance
from liveclasses.models import LiveClass, LiveClassRecording
from liveclasses.serializers import LiveClassSerializer

from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import TeacherProfile, ParentProfile
from academics.models import (
    AcademicSession,
    ClassRoom,
    Section,
    Subject,
    TeacherAssignment,
    StudentEnrollment,
    ParentStudent,
)


class StudentDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Only students
        if user.role != 'student':
            return Response(
                {'detail': 'Only students can access this dashboard.'},
                status=403
            )

        student_profile = StudentProfile.objects.filter(
            user=user
        ).first()

        if not student_profile:
            return Response(
                {'detail': 'Student profile not found.'},
                status=404
            )

        enrollment = student_profile.enrollments.filter(
            is_active=True
        ).select_related(
            'section',
            'section__classroom'
        ).first()

        if not enrollment:
            return Response(
                {'detail': 'No active enrollment found.'},
                status=404
            )

        section = enrollment.section
        today = timezone.localdate()

        # Today's classes
        today_classes = LiveClass.objects.filter(
            organization=user.organization,
            teacher_assignment__section=section,
            class_date=today
        ).select_related(
            'teacher_assignment__teacher__user',
            'teacher_assignment__subject',
            'teacher_assignment__section'
        ).order_by('start_time')

        # Upcoming classes
        upcoming_classes = LiveClass.objects.filter(
            organization=user.organization,
            teacher_assignment__section=section,
            class_date__gt=today,
            status=LiveClass.Status.SCHEDULED
        ).select_related(
            'teacher_assignment__teacher__user',
            'teacher_assignment__subject',
            'teacher_assignment__section'
        ).order_by(
            'class_date',
            'start_time'
        )[:5]

        # Available recorded classes
        recorded_classes = LiveClass.objects.filter(
            organization=user.organization,
            teacher_assignment__section=section,
            status=LiveClass.Status.COMPLETED,
            recording__is_available=True
        ).select_related(
            'teacher_assignment__teacher__user',
            'teacher_assignment__subject',
            'teacher_assignment__section',
            'recording'
        ).order_by('-class_date')[:5]

        # Attendance
        attendance_records = StudentAttendance.objects.filter(
            student=student_profile,
            attendance_session__organization=user.organization
        )

        total_classes = attendance_records.count()

        present = attendance_records.filter(
            status=StudentAttendance.Status.PRESENT
        ).count()

        absent = attendance_records.filter(
            status=StudentAttendance.Status.ABSENT
        ).count()

        late = attendance_records.filter(
            status=StudentAttendance.Status.LATE
        ).count()

        excused = attendance_records.filter(
            status=StudentAttendance.Status.EXCUSED
        ).count()

        attended_classes = present + late
        counted_classes = present + late + absent

        attendance_percentage = 0

        if counted_classes > 0:
            attendance_percentage = round(
                (attended_classes / counted_classes) * 100,
                2
            )

        full_name = user.get_full_name().strip() or user.username

        return Response({
            'student': {
                'username': user.username,
                'name': full_name,
                'admission_number': student_profile.admission_number,
                'organization': (
                    user.organization.name
                    if user.organization
                    else None
                ),
                'classroom': section.classroom.name,
                'section': section.name,
                'roll_number': enrollment.roll_number,
            },

            'attendance': {
                'total_classes': total_classes,
                'present': present,
                'absent': absent,
                'late': late,
                'excused': excused,
                'attended_classes': attended_classes,
                'attendance_percentage': attendance_percentage,
            },

            'today_classes': LiveClassSerializer(
                today_classes,
                many=True
            ).data,

            'upcoming_classes': LiveClassSerializer(
                upcoming_classes,
                many=True
            ).data,

            'recorded_classes': LiveClassSerializer(
                recorded_classes,
                many=True
            ).data,
        })


class StudentProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != "student":
            return Response(
                {"detail": "Only students can access profile details."},
                status=403
            )

        student_profile = StudentProfile.objects.filter(
            user=user
        ).first()

        if not student_profile:
            return Response(
                {"detail": "Student profile not found."},
                status=404
            )

        if student_profile.user.organization_id != user.organization_id:
            return Response(
                {"detail": "Profile organization mismatch."},
                status=403
            )

        enrollment = StudentEnrollment.objects.filter(
            student=student_profile,
            is_active=True,
            section__organization=user.organization,
        ).select_related(
            "section",
            "section__classroom",
        ).first()

        return Response({
            "profile": {
                "student_profile_id": student_profile.id,
                "name": (
                    user.get_full_name().strip()
                    or user.username
                ),
                "username": user.username,
                "email": user.email,
                "organization": (
                    user.organization.name
                    if user.organization
                    else None
                ),
                "admission_number": (
                    student_profile.admission_number
                ),
                "phone": student_profile.phone,
                "date_of_birth": student_profile.date_of_birth,
                "admission_date": student_profile.admission_date,
            },
            "enrollment": (
                {
                    "roll_number": enrollment.roll_number,
                    "classroom_name": (
                        enrollment.section.classroom.name
                    ),
                    "section_name": enrollment.section.name,
                    "is_active": enrollment.is_active,
                    "enrolled_at": enrollment.enrolled_at,
                }
                if enrollment
                else None
            ),
        })


class StudentLoginAPIView(APIView):

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        user = authenticate(
            username=username,
            password=password
        )

        if not user:
            return Response(
                {'detail': 'Invalid username or password.'},
                status=401
            )

        if user.role != 'student':
            return Response(
                {'detail': 'Only students can login here.'},
                status=403
            )

        if not user.is_active:
            return Response(
                {'detail': 'This account is inactive.'},
                status=403
            )

        refresh = RefreshToken.for_user(user)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'username': user.username,
                'role': user.role,
                'organization': (
                    user.organization.name
                    if user.organization
                    else None
                ),
            }
        })
        
        
class TeacherDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Only teachers can access this dashboard
        if user.role != "teacher":
            return Response(
                {"detail": "Teacher access only."},
                status=403
            )

        try:
            teacher = TeacherProfile.objects.get(user=user)
        except TeacherProfile.DoesNotExist:
            return Response(
                {"detail": "Teacher profile not found."},
                status=404
            )

        organization = user.organization

        if not organization:
            return Response(
                {"detail": "Teacher organization not found."},
                status=400
            )

        today = timezone.localdate()

        # Teacher assignments
        assignments = TeacherAssignment.objects.filter(
            teacher=teacher,
            is_active=True,
            section__organization=organization
        ).select_related(
            "subject",
            "section"
        )

        assignment_ids = assignments.values_list(
            "id",
            flat=True
        )

        # Classes belonging to this teacher
        classes = LiveClass.objects.filter(
            organization=organization,
            teacher_assignment_id__in=assignment_ids
        ).select_related(
            "teacher_assignment__subject",
            "teacher_assignment__section"
        )

        today_classes = classes.filter(
            class_date=today
        ).order_by(
            "start_time"
        )

        upcoming_classes = classes.filter(
            class_date__gt=today,
            status=LiveClass.Status.SCHEDULED
        ).order_by(
            "class_date",
            "start_time"
        )

        # Recordings uploaded by this teacher
        recordings = LiveClassRecording.objects.filter(
            uploaded_by=teacher,
            live_class__organization=organization
        ).select_related(
            "live_class",
            "live_class__teacher_assignment__subject",
            "live_class__teacher_assignment__section"
        ).order_by(
            "-uploaded_at"
        )

        assignment_data = []

        for assignment in assignments:
            assignment_data.append({
                "id": assignment.id,
                "subject_name": assignment.subject.name,
                "section_name": str(assignment.section),
            })

        def serialize_class(live_class):
            return {
                "id": live_class.id,
                "title": live_class.title,
                "description": live_class.description,
                "class_date": live_class.class_date,
                "start_time": live_class.start_time,
                "end_time": live_class.end_time,
                "meeting_link": live_class.meeting_link,
                "status": live_class.status,
                "subject_name": (
                    live_class.teacher_assignment.subject.name
                ),
                "section_name": str(
                    live_class.teacher_assignment.section
                ),
            }

        recording_data = []

        for recording in recordings:
            recording_data.append({
                "public_id": str(recording.public_id),
                "title": recording.title,
                "class_title": recording.live_class.title,
                "class_date": recording.live_class.class_date,
                "subject_name": (
                    recording.live_class
                    .teacher_assignment
                    .subject
                    .name
                ),
                "section_name": str(
                    recording.live_class
                    .teacher_assignment
                    .section
                ),
                "is_available": recording.is_available,
                "uploaded_at": recording.uploaded_at,
            })

        teacher_name = (
            user.get_full_name().strip()
            or user.username
        )

        return Response({
            "teacher": {
                "username": user.username,
                "name": teacher_name,
                "organization": organization.name,
            },

            "summary": {
                "assigned_classes": assignments.count(),
                "today_classes": today_classes.count(),
                "upcoming_classes": upcoming_classes.count(),
                "recordings": recordings.count(),
            },

            "assignments": assignment_data,

            "today_classes": [
                serialize_class(item)
                for item in today_classes
            ],

            "upcoming_classes": [
                serialize_class(item)
                for item in upcoming_classes
            ],

            "recordings": recording_data,
        })


class TeacherProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can access profile details."},
                status=403
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {"detail": "Teacher profile not found."},
                status=404
            )

        if teacher_profile.user.organization_id != user.organization_id:
            return Response(
                {"detail": "Profile organization mismatch."},
                status=403
            )

        assignments = TeacherAssignment.objects.filter(
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization,
        ).select_related(
            "subject",
            "subject__classroom",
            "subject__classroom__academic_session",
            "section",
            "section__classroom",
            "section__classroom__academic_session",
        ).order_by(
            "section__classroom__name",
            "section__name",
            "subject__name",
        )

        assignment_data = []

        for assignment in assignments:
            classroom = assignment.section.classroom
            academic_session = classroom.academic_session

            assignment_data.append({
                "teacher_assignment_id": assignment.id,
                "subject_name": assignment.subject.name,
                "subject_code": assignment.subject.code,
                "classroom_name": classroom.name,
                "section_name": assignment.section.name,
                "academic_session": (
                    academic_session.name
                    if academic_session
                    else ""
                ),
            })

        return Response({
            "profile": {
                "teacher_profile_id": teacher_profile.id,
                "name": (
                    user.get_full_name().strip()
                    or user.username
                ),
                "username": user.username,
                "email": user.email,
                "organization": (
                    user.organization.name
                    if user.organization
                    else None
                ),
                "employee_id": teacher_profile.employee_id,
                "phone": teacher_profile.phone,
                "qualification": teacher_profile.qualification,
                "joining_date": teacher_profile.joining_date,
            },
            "assignments": assignment_data,
            "summary": {
                "active_assignments": len(assignment_data),
            },
        })


class TeacherLoginAPIView(APIView):

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        user = authenticate(
            username=username,
            password=password
        )

        if not user:
            return Response(
                {'detail': 'Invalid username or password.'},
                status=401
            )

        if user.role != 'teacher':
            return Response(
                {'detail': 'Only teachers can login here.'},
                status=403
            )

        if not user.is_active:
            return Response(
                {'detail': 'This account is inactive.'},
                status=403
            )

        refresh = RefreshToken.for_user(user)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'username': user.username,
                'name': (
                    user.get_full_name().strip()
                    or user.username
                ),
                'role': user.role,
                'organization': (
                    user.organization.name
                    if user.organization
                    else None
                ),
            }
        })


class CollegeAdminLoginAPIView(APIView):

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(
            username=username,
            password=password
        )

        if not user:
            return Response(
                {"detail": "Invalid username or password."},
                status=401
            )

        if user.role != "college_admin":
            return Response(
                {"detail": "Only college admins can login here."},
                status=403
            )

        if not user.is_active:
            return Response(
                {"detail": "This account is inactive."},
                status=403
            )

        if not user.organization:
            return Response(
                {"detail": "College admin organization not found."},
                status=403
            )

        if not user.organization.is_active:
            return Response(
                {"detail": "This organization is inactive."},
                status=403
            )

        refresh = RefreshToken.for_user(user)

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "username": user.username,
                "name": (
                    user.get_full_name().strip()
                    or user.username
                ),
                "role": user.role,
                "organization": user.organization.name,
                "organization_code": user.organization.code,
            }
        })


class CollegeAdminDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != "college_admin":
            return Response(
                {"detail": "Only college admins can access this dashboard."},
                status=403
            )

        organization = user.organization

        if not organization:
            return Response(
                {"detail": "College admin organization not found."},
                status=403
            )

        if not organization.is_active:
            return Response(
                {"detail": "This organization is inactive."},
                status=403
            )

        users = User.objects.filter(
            organization=organization
        )

        return Response({
            "organization": {
                "name": organization.name,
                "code": organization.code,
                "is_active": organization.is_active,
            },
            "summary": {
                "total_students": users.filter(
                    role="student"
                ).count(),
                "total_teachers": users.filter(
                    role="teacher"
                ).count(),
                "total_parents": users.filter(
                    role="parent"
                ).count(),
                "academic_sessions": AcademicSession.objects.filter(
                    organization=organization
                ).count(),
                "classrooms": ClassRoom.objects.filter(
                    organization=organization
                ).count(),
                "sections": Section.objects.filter(
                    organization=organization
                ).count(),
                "subjects": Subject.objects.filter(
                    organization=organization
                ).count(),
                "active_student_enrollments": (
                    StudentEnrollment.objects.filter(
                        is_active=True,
                        section__organization=organization,
                    ).count()
                ),
                "active_teacher_assignments": (
                    TeacherAssignment.objects.filter(
                        is_active=True,
                        section__organization=organization,
                    ).count()
                ),
            },
        })


def college_admin_organization(user):
    if user.role != "college_admin" or not user.is_active:
        return None

    if not user.organization or not user.organization.is_active:
        return None

    return user.organization


def serialize_college_student(user):
    student_profile = getattr(user, "student_profile", None)

    return {
        "id": user.id,
        "name": (
            user.get_full_name().strip()
            or user.username
        ),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active,
        "date_joined": user.date_joined,
        "profile": (
            {
                "student_profile_id": student_profile.id,
                "admission_number": (
                    student_profile.admission_number
                ),
                "phone": student_profile.phone,
                "date_of_birth": student_profile.date_of_birth,
                "admission_date": student_profile.admission_date,
            }
            if student_profile
            else None
        ),
    }


def college_student_queryset(organization):
    return User.objects.filter(
        role="student",
        organization=organization,
    ).select_related(
        "student_profile"
    )


def serialize_parent_student_link(link):
    student = link.student
    student_user = student.user
    enrollment = StudentEnrollment.objects.filter(
        student=student,
        is_active=True,
        section__organization=student_user.organization,
    ).select_related(
        "section",
        "section__classroom",
    ).first()

    return {
        "link_id": link.id,
        "student_id": student_user.id,
        "student_profile_id": student.id,
        "name": (
            student_user.get_full_name().strip()
            or student_user.username
        ),
        "username": student_user.username,
        "admission_number": student.admission_number,
        "relationship": link.relationship,
        "classroom_name": (
            enrollment.section.classroom.name
            if enrollment
            else ""
        ),
        "section_name": (
            enrollment.section.name
            if enrollment
            else ""
        ),
    }


def serialize_college_parent(user, include_links=False):
    parent_profile = getattr(user, "parent_profile", None)
    linked_students = []

    if include_links and parent_profile:
        links = ParentStudent.objects.filter(
            parent=parent_profile,
            student__user__organization=user.organization,
        ).select_related(
            "student",
            "student__user",
        ).order_by(
            "student__user__first_name",
            "student__user__last_name",
            "student__user__username",
        )
        linked_students = [
            serialize_parent_student_link(link)
            for link in links
        ]

    return {
        "id": user.id,
        "name": (
            user.get_full_name().strip()
            or user.username
        ),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active,
        "date_joined": user.date_joined,
        "profile": (
            {
                "parent_profile_id": parent_profile.id,
                "phone": parent_profile.phone,
                "occupation": parent_profile.occupation,
            }
            if parent_profile
            else None
        ),
        "linked_students_count": (
            getattr(user, "linked_students_count", None)
            if not include_links
            else len(linked_students)
        ) or 0,
        "linked_students": linked_students,
    }


def college_parent_queryset(organization):
    return User.objects.filter(
        role="parent",
        organization=organization,
    ).select_related(
        "parent_profile",
    )


def serialize_college_teacher(user):
    teacher_profile = getattr(user, "teacher_profile", None)
    assignments = []

    if teacher_profile:
        assignments = [
            {
                "id": assignment.id,
                "subject_name": assignment.subject.name,
                "classroom_name": assignment.section.classroom.name,
                "section_name": assignment.section.name,
            }
            for assignment in teacher_profile.teaching_assignments.filter(
                is_active=True,
                subject__organization=user.organization,
                section__organization=user.organization,
            ).select_related(
                "subject",
                "section",
                "section__classroom",
            )
        ]

    return {
        "id": user.id,
        "name": (
            user.get_full_name().strip()
            or user.username
        ),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active,
        "date_joined": user.date_joined,
        "organization": (
            user.organization.name
            if user.organization
            else ""
        ),
        "profile": (
            {
                "teacher_profile_id": teacher_profile.id,
                "employee_id": teacher_profile.employee_id,
                "phone": teacher_profile.phone,
                "qualification": teacher_profile.qualification,
                "joining_date": teacher_profile.joining_date,
            }
            if teacher_profile
            else None
        ),
        "assignment_count": len(assignments),
        "assignments": assignments,
    }


def college_teacher_queryset(organization):
    return User.objects.filter(
        role="teacher",
        organization=organization,
    ).select_related(
        "organization",
        "teacher_profile",
    )


class CollegeAdminTeachersAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can manage teachers."},
                status=403
            )

        teachers = college_teacher_queryset(
            organization
        ).order_by(
            "-date_joined"
        )

        search = request.query_params.get("search", "").strip()

        if search:
            teachers = teachers.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )

        return Response({
            "teachers": [
                serialize_college_teacher(teacher)
                for teacher in teachers
            ]
        })

    def post(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can create teachers."},
                status=403
            )

        username = request.data.get("username", "").strip()
        password = request.data.get("password", "")
        first_name = request.data.get("first_name", "").strip()
        last_name = request.data.get("last_name", "").strip()
        email = request.data.get("email", "").strip()
        employee_id = request.data.get("employee_id", "").strip()
        phone = request.data.get("phone", "").strip()
        qualification = request.data.get("qualification", "").strip()
        joining_date = request.data.get("joining_date") or None

        if not username:
            return Response(
                {"detail": "Username is required."},
                status=400
            )

        if not password:
            return Response(
                {"detail": "Password is required."},
                status=400
            )

        if not employee_id:
            return Response(
                {"detail": "Employee ID is required."},
                status=400
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"detail": "Username already exists."},
                status=400
            )

        if TeacherProfile.objects.filter(employee_id=employee_id).exists():
            return Response(
                {"detail": "Employee ID already exists."},
                status=400
            )

        with transaction.atomic():
            teacher = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role="teacher",
                organization=organization,
            )

            TeacherProfile.objects.create(
                user=teacher,
                employee_id=employee_id,
                phone=phone,
                qualification=qualification,
                joining_date=joining_date,
            )

        return Response(
            {
                "message": "Teacher created successfully.",
                "teacher": serialize_college_teacher(teacher),
            },
            status=201
        )


class CollegeAdminTeacherDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_teacher(self, user, teacher_id):
        organization = college_admin_organization(user)

        if not organization:
            return None

        return college_teacher_queryset(organization).filter(
            id=teacher_id
        ).first()

    def get(self, request, teacher_id):
        if request.user.role != "college_admin":
            return Response(
                {"detail": "Only college admins can view teachers."},
                status=403
            )

        teacher = self.get_teacher(request.user, teacher_id)

        if not teacher:
            return Response(
                {"detail": "Teacher not found."},
                status=404
            )

        return Response({
            "teacher": serialize_college_teacher(teacher)
        })

    def patch(self, request, teacher_id):
        if request.user.role != "college_admin":
            return Response(
                {"detail": "Only college admins can update teachers."},
                status=403
            )

        teacher = self.get_teacher(request.user, teacher_id)

        if not teacher:
            return Response(
                {"detail": "Teacher not found."},
                status=404
            )

        profile = getattr(teacher, "teacher_profile", None)

        if not profile:
            return Response(
                {"detail": "Teacher profile not found."},
                status=404
            )

        if "username" in request.data:
            username = request.data.get("username", "").strip()

            if not username:
                return Response(
                    {"detail": "Username cannot be empty."},
                    status=400
                )

            if User.objects.filter(
                username=username
            ).exclude(id=teacher.id).exists():
                return Response(
                    {"detail": "Username already exists."},
                    status=400
                )

            teacher.username = username

        if "first_name" in request.data:
            teacher.first_name = request.data.get(
                "first_name",
                ""
            ).strip()

        if "last_name" in request.data:
            teacher.last_name = request.data.get(
                "last_name",
                ""
            ).strip()

        if "email" in request.data:
            teacher.email = request.data.get("email", "").strip()

        if "is_active" in request.data:
            value = request.data.get("is_active")
            teacher.is_active = (
                value.lower() in ["true", "1", "yes", "on"]
                if isinstance(value, str)
                else bool(value)
            )

        if "employee_id" in request.data:
            employee_id = request.data.get(
                "employee_id",
                ""
            ).strip()

            if not employee_id:
                return Response(
                    {"detail": "Employee ID cannot be empty."},
                    status=400
                )

            if TeacherProfile.objects.filter(
                employee_id=employee_id
            ).exclude(id=profile.id).exists():
                return Response(
                    {"detail": "Employee ID already exists."},
                    status=400
                )

            profile.employee_id = employee_id

        if "phone" in request.data:
            profile.phone = request.data.get("phone", "").strip()

        if "qualification" in request.data:
            profile.qualification = request.data.get(
                "qualification",
                ""
            ).strip()

        if "joining_date" in request.data:
            profile.joining_date = (
                request.data.get("joining_date") or None
            )

        with transaction.atomic():
            teacher.save(
                update_fields=[
                    "username",
                    "first_name",
                    "last_name",
                    "email",
                    "is_active",
                ]
            )
            profile.save(
                update_fields=[
                    "employee_id",
                    "phone",
                    "qualification",
                    "joining_date",
                ]
            )

        return Response({
            "message": "Teacher updated successfully.",
            "teacher": serialize_college_teacher(teacher),
        })


class CollegeAdminStudentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can manage students."},
                status=403
            )

        students = college_student_queryset(
            organization
        ).order_by(
            "-date_joined"
        )

        search = request.query_params.get("search", "").strip()

        if search:
            students = students.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )

        return Response({
            "students": [
                serialize_college_student(student)
                for student in students
            ]
        })

    def post(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can create students."},
                status=403
            )

        username = request.data.get("username", "").strip()
        password = request.data.get("password", "")
        first_name = request.data.get("first_name", "").strip()
        last_name = request.data.get("last_name", "").strip()
        email = request.data.get("email", "").strip()
        admission_number = request.data.get(
            "admission_number",
            ""
        ).strip()
        phone = request.data.get("phone", "").strip()
        date_of_birth = request.data.get("date_of_birth") or None
        admission_date = request.data.get("admission_date") or None

        if not username:
            return Response(
                {"detail": "Username is required."},
                status=400
            )

        if not password:
            return Response(
                {"detail": "Password is required."},
                status=400
            )

        if not admission_number:
            return Response(
                {"detail": "Admission number is required."},
                status=400
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"detail": "Username already exists."},
                status=400
            )

        if StudentProfile.objects.filter(
            admission_number=admission_number
        ).exists():
            return Response(
                {"detail": "Admission number already exists."},
                status=400
            )

        with transaction.atomic():
            student = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role="student",
                organization=organization,
            )

            StudentProfile.objects.create(
                user=student,
                admission_number=admission_number,
                phone=phone,
                date_of_birth=date_of_birth,
                admission_date=admission_date,
            )

        return Response(
            {
                "message": "Student created successfully.",
                "student": serialize_college_student(student),
            },
            status=201
        )


class CollegeAdminStudentDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_student(self, user, student_id):
        organization = college_admin_organization(user)

        if not organization:
            return None

        return college_student_queryset(organization).filter(
            id=student_id
        ).first()

    def get(self, request, student_id):
        if request.user.role != "college_admin":
            return Response(
                {"detail": "Only college admins can view students."},
                status=403
            )

        student = self.get_student(request.user, student_id)

        if not student:
            return Response(
                {"detail": "Student not found."},
                status=404
            )

        return Response({
            "student": serialize_college_student(student)
        })

    def patch(self, request, student_id):
        if request.user.role != "college_admin":
            return Response(
                {"detail": "Only college admins can update students."},
                status=403
            )

        student = self.get_student(request.user, student_id)

        if not student:
            return Response(
                {"detail": "Student not found."},
                status=404
            )

        profile = getattr(student, "student_profile", None)

        if not profile:
            return Response(
                {"detail": "Student profile not found."},
                status=404
            )

        if "username" in request.data:
            username = request.data.get("username", "").strip()

            if not username:
                return Response(
                    {"detail": "Username cannot be empty."},
                    status=400
                )

            if User.objects.filter(
                username=username
            ).exclude(id=student.id).exists():
                return Response(
                    {"detail": "Username already exists."},
                    status=400
                )

            student.username = username

        if "first_name" in request.data:
            student.first_name = request.data.get(
                "first_name",
                ""
            ).strip()

        if "last_name" in request.data:
            student.last_name = request.data.get(
                "last_name",
                ""
            ).strip()

        if "email" in request.data:
            student.email = request.data.get("email", "").strip()

        if "is_active" in request.data:
            student.is_active = bool(request.data.get("is_active"))

        if "admission_number" in request.data:
            admission_number = request.data.get(
                "admission_number",
                ""
            ).strip()

            if not admission_number:
                return Response(
                    {"detail": "Admission number cannot be empty."},
                    status=400
                )

            if StudentProfile.objects.filter(
                admission_number=admission_number
            ).exclude(id=profile.id).exists():
                return Response(
                    {"detail": "Admission number already exists."},
                    status=400
                )

            profile.admission_number = admission_number

        if "phone" in request.data:
            profile.phone = request.data.get("phone", "").strip()

        if "date_of_birth" in request.data:
            profile.date_of_birth = (
                request.data.get("date_of_birth") or None
            )

        if "admission_date" in request.data:
            profile.admission_date = (
                request.data.get("admission_date") or None
            )

        with transaction.atomic():
            student.save(
                update_fields=[
                    "username",
                    "first_name",
                    "last_name",
                    "email",
                    "is_active",
                ]
            )
            profile.save(
                update_fields=[
                    "admission_number",
                    "phone",
                    "date_of_birth",
                    "admission_date",
                ]
            )

        return Response({
            "message": "Student updated successfully.",
            "student": serialize_college_student(student),
        })


class CollegeAdminParentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can manage parents."},
                status=403
            )

        parents = college_parent_queryset(
            organization
        ).annotate(
            linked_students_count=Count(
                "parent_profile__student_links",
                distinct=True,
            )
        ).order_by(
            "-date_joined"
        )

        search = request.query_params.get("search", "").strip()

        if search:
            parents = parents.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )

        return Response({
            "parents": [
                serialize_college_parent(parent)
                for parent in parents
            ]
        })

    def post(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can create parents."},
                status=403
            )

        username = request.data.get("username", "").strip()
        password = request.data.get("password", "")
        first_name = request.data.get("first_name", "").strip()
        last_name = request.data.get("last_name", "").strip()
        email = request.data.get("email", "").strip()
        phone = request.data.get("phone", "").strip()
        occupation = request.data.get("occupation", "").strip()

        if not username:
            return Response(
                {"detail": "Username is required."},
                status=400
            )

        if not password:
            return Response(
                {"detail": "Password is required."},
                status=400
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"detail": "Username already exists."},
                status=400
            )

        with transaction.atomic():
            parent = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role="parent",
                organization=organization,
            )

            ParentProfile.objects.create(
                user=parent,
                phone=phone,
                occupation=occupation,
            )

        return Response(
            {
                "message": "Parent created successfully.",
                "parent": serialize_college_parent(parent),
            },
            status=201
        )


class CollegeAdminParentDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_parent(self, user, parent_id):
        organization = college_admin_organization(user)

        if not organization:
            return None

        return college_parent_queryset(organization).filter(
            id=parent_id
        ).first()

    def get(self, request, parent_id):
        if request.user.role != "college_admin":
            return Response(
                {"detail": "Only college admins can view parents."},
                status=403
            )

        parent = self.get_parent(request.user, parent_id)

        if not parent:
            return Response(
                {"detail": "Parent not found."},
                status=404
            )

        return Response({
            "parent": serialize_college_parent(
                parent,
                include_links=True,
            )
        })

    def patch(self, request, parent_id):
        if request.user.role != "college_admin":
            return Response(
                {"detail": "Only college admins can update parents."},
                status=403
            )

        parent = self.get_parent(request.user, parent_id)

        if not parent:
            return Response(
                {"detail": "Parent not found."},
                status=404
            )

        profile = getattr(parent, "parent_profile", None)

        if not profile:
            return Response(
                {"detail": "Parent profile not found."},
                status=404
            )

        if "username" in request.data:
            username = request.data.get("username", "").strip()

            if not username:
                return Response(
                    {"detail": "Username cannot be empty."},
                    status=400
                )

            if User.objects.filter(
                username=username
            ).exclude(id=parent.id).exists():
                return Response(
                    {"detail": "Username already exists."},
                    status=400
                )

            parent.username = username

        if "first_name" in request.data:
            parent.first_name = request.data.get(
                "first_name",
                ""
            ).strip()

        if "last_name" in request.data:
            parent.last_name = request.data.get(
                "last_name",
                ""
            ).strip()

        if "email" in request.data:
            parent.email = request.data.get("email", "").strip()

        if "is_active" in request.data:
            value = request.data.get("is_active")
            parent.is_active = (
                value.lower() in ["true", "1", "yes", "on"]
                if isinstance(value, str)
                else bool(value)
            )

        if "phone" in request.data:
            profile.phone = request.data.get("phone", "").strip()

        if "occupation" in request.data:
            profile.occupation = request.data.get(
                "occupation",
                ""
            ).strip()

        with transaction.atomic():
            parent.save(
                update_fields=[
                    "username",
                    "first_name",
                    "last_name",
                    "email",
                    "is_active",
                ]
            )
            profile.save(
                update_fields=[
                    "phone",
                    "occupation",
                ]
            )

        return Response({
            "message": "Parent updated successfully.",
            "parent": serialize_college_parent(
                parent,
                include_links=True,
            ),
        })


class CollegeAdminParentLinkOptionsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, parent_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can manage parent links."},
                status=403
            )

        parent = college_parent_queryset(organization).filter(
            id=parent_id
        ).first()

        if not parent:
            return Response(
                {"detail": "Parent not found."},
                status=404
            )

        parent_profile = getattr(parent, "parent_profile", None)

        if not parent_profile:
            return Response(
                {"detail": "Parent profile not found."},
                status=404
            )

        linked_student_ids = ParentStudent.objects.filter(
            parent=parent_profile,
            student__user__organization=organization,
        ).values_list(
            "student_id",
            flat=True,
        )

        students = StudentProfile.objects.filter(
            user__role="student",
            user__organization=organization,
        ).exclude(
            id__in=linked_student_ids,
        ).select_related(
            "user",
        ).order_by(
            "user__first_name",
            "user__last_name",
            "user__username",
        )

        return Response({
            "students": [
                {
                    "student_profile_id": student.id,
                    "student_id": student.user_id,
                    "name": (
                        student.user.get_full_name().strip()
                        or student.user.username
                    ),
                    "username": student.user.username,
                    "admission_number": student.admission_number,
                }
                for student in students
            ],
            "relationships": [
                {
                    "value": value,
                    "label": label,
                }
                for value, label in ParentStudent.Relationship.choices
            ],
        })


class CollegeAdminParentStudentLinksAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, parent_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can link students."},
                status=403
            )

        parent = college_parent_queryset(organization).filter(
            id=parent_id
        ).first()

        if not parent:
            return Response(
                {"detail": "Parent not found."},
                status=404
            )

        parent_profile = getattr(parent, "parent_profile", None)

        if not parent_profile:
            return Response(
                {"detail": "Parent profile not found."},
                status=404
            )

        student_profile_id = request.data.get("student_profile_id")
        relationship = request.data.get(
            "relationship",
            ParentStudent.Relationship.GUARDIAN,
        )

        valid_relationships = [
            choice[0]
            for choice in ParentStudent.Relationship.choices
        ]

        if relationship not in valid_relationships:
            return Response(
                {"detail": "Invalid relationship."},
                status=400
            )

        student = StudentProfile.objects.filter(
            id=student_profile_id,
            user__role="student",
            user__organization=organization,
        ).select_related(
            "user",
        ).first()

        if not student:
            return Response(
                {"detail": "Student not found."},
                status=404
            )

        if ParentStudent.objects.filter(
            parent=parent_profile,
            student=student,
        ).exists():
            return Response(
                {"detail": "Student is already linked to this parent."},
                status=400
            )

        link = ParentStudent.objects.create(
            parent=parent_profile,
            student=student,
            relationship=relationship,
        )

        return Response(
            {
                "message": "Student linked successfully.",
                "link": serialize_parent_student_link(link),
            },
            status=201
        )


class CollegeAdminParentStudentLinkDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, parent_id, link_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can unlink students."},
                status=403
            )

        parent = college_parent_queryset(organization).filter(
            id=parent_id
        ).first()

        if not parent:
            return Response(
                {"detail": "Parent not found."},
                status=404
            )

        parent_profile = getattr(parent, "parent_profile", None)

        if not parent_profile:
            return Response(
                {"detail": "Parent profile not found."},
                status=404
            )

        link = ParentStudent.objects.filter(
            id=link_id,
            parent=parent_profile,
            student__user__organization=organization,
        ).first()

        if not link:
            return Response(
                {"detail": "Parent-student link not found."},
                status=404
            )

        link.delete()

        return Response({
            "message": "Student unlinked successfully."
        })


def serialize_college_enrollment(enrollment):
    student_user = enrollment.student.user
    section = enrollment.section
    classroom = section.classroom
    academic_session = classroom.academic_session

    return {
        "enrollment_id": enrollment.id,
        "student_id": enrollment.student_id,
        "academic_session_id": academic_session.id,
        "class_id": classroom.id,
        "section_id": section.id,
        "student_name": (
            student_user.get_full_name().strip()
            or student_user.username
        ),
        "username": student_user.username,
        "roll_number": enrollment.roll_number,
        "classroom_name": classroom.name,
        "section_name": section.name,
        "academic_session": academic_session.name,
        "is_active": enrollment.is_active,
        "enrolled_at": enrollment.enrolled_at,
    }


def college_enrollment_queryset(organization):
    return StudentEnrollment.objects.filter(
        section__organization=organization,
        student__user__organization=organization,
        student__user__role="student",
    ).select_related(
        "student",
        "student__user",
        "section",
        "section__classroom",
        "section__classroom__academic_session",
    )


def serialize_college_teacher_assignment(assignment):
    section = assignment.section
    classroom = section.classroom
    session = classroom.academic_session

    return {
        "assignment_id": assignment.id,
        "teacher_id": assignment.teacher.user_id,
        "teacher_name": (
            assignment.teacher.user.get_full_name().strip()
            or assignment.teacher.user.username
        ),
        "subject_id": assignment.subject_id,
        "subject_name": assignment.subject.name,
        "subject_code": assignment.subject.code,
        "section_id": section.id,
        "section_name": section.name,
        "class_id": classroom.id,
        "class_name": classroom.name,
        "academic_session_id": session.id,
        "academic_session": session.name,
        "is_active": assignment.is_active,
    }


def college_teacher_assignment_queryset(organization):
    return TeacherAssignment.objects.filter(
        teacher__user__organization=organization,
        teacher__user__role="teacher",
        subject__organization=organization,
        subject__classroom__organization=organization,
        subject__classroom__academic_session__organization=organization,
        section__organization=organization,
        section__classroom__organization=organization,
        section__classroom__academic_session__organization=organization,
    ).select_related(
        "teacher",
        "teacher__user",
        "subject",
        "subject__classroom",
        "section",
        "section__classroom",
        "section__classroom__academic_session",
    )


def parse_boolean(value):
    return (
        value.lower() in ["true", "1", "yes", "on"]
        if isinstance(value, str)
        else bool(value)
    )


def get_college_teacher_profile(teacher_id, organization):
    return TeacherProfile.objects.filter(
        user_id=teacher_id,
        user__role="teacher",
        user__is_active=True,
        user__organization=organization,
    ).select_related("user").first()


def get_college_subject(subject_id, organization):
    return Subject.objects.filter(
        id=subject_id,
        organization=organization,
        classroom__organization=organization,
        classroom__academic_session__organization=organization,
    ).select_related(
        "classroom",
        "classroom__academic_session",
    ).first()


def get_college_section(section_id, organization):
    return Section.objects.filter(
        id=section_id,
        organization=organization,
        classroom__organization=organization,
        classroom__academic_session__organization=organization,
    ).select_related(
        "classroom",
        "classroom__academic_session",
    ).first()


def validate_teacher_assignment_payload(
    data,
    organization,
    assignment=None,
):
    teacher = assignment.teacher if assignment else None
    subject = assignment.subject if assignment else None
    section = assignment.section if assignment else None
    is_active = assignment.is_active if assignment else True

    if "teacher_id" in data or not assignment:
        teacher = get_college_teacher_profile(
            data.get("teacher_id"),
            organization,
        )

        if not teacher:
            return None, {"detail": "Teacher not found."}, 404

    if "subject_id" in data or not assignment:
        subject = get_college_subject(
            data.get("subject_id"),
            organization,
        )

        if not subject:
            return None, {"detail": "Subject not found."}, 404

    if "section_id" in data or not assignment:
        section = get_college_section(
            data.get("section_id"),
            organization,
        )

        if not section:
            return None, {"detail": "Section not found."}, 404

    if subject.classroom_id != section.classroom_id:
        return (
            None,
            {"detail": "Subject and section must belong to the same class."},
            400,
        )

    if "is_active" in data:
        is_active = parse_boolean(data.get("is_active"))

    duplicate = TeacherAssignment.objects.filter(
        teacher=teacher,
        subject=subject,
        section=section,
    )

    if assignment:
        duplicate = duplicate.exclude(id=assignment.id)

    if duplicate.exists():
        return (
            None,
            {
                "detail": (
                    "This teacher is already assigned to this subject "
                    "and section."
                )
            },
            400,
        )

    return {
        "teacher": teacher,
        "subject": subject,
        "section": section,
        "is_active": is_active,
    }, None, None


class CollegeAdminTeacherAssignmentSetupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can manage assignments."},
                status=403
            )

        teachers = college_teacher_queryset(
            organization
        ).filter(
            is_active=True,
            teacher_profile__isnull=False,
        ).order_by(
            "first_name",
            "username",
        )

        sessions = AcademicSession.objects.filter(
            organization=organization
        ).order_by(
            "-is_active",
            "name",
        )

        classrooms = ClassRoom.objects.filter(
            organization=organization,
            academic_session__organization=organization,
        ).select_related(
            "academic_session"
        ).order_by(
            "name"
        )

        sections = Section.objects.filter(
            organization=organization,
            classroom__organization=organization,
            classroom__academic_session__organization=organization,
        ).select_related(
            "classroom",
            "classroom__academic_session",
        ).order_by(
            "classroom__name",
            "name",
        )

        subjects = Subject.objects.filter(
            organization=organization,
            classroom__organization=organization,
            classroom__academic_session__organization=organization,
        ).select_related(
            "classroom",
            "classroom__academic_session",
        ).order_by(
            "name"
        )

        return Response({
            "teachers": [
                {
                    "id": teacher.id,
                    "name": (
                        teacher.get_full_name().strip()
                        or teacher.username
                    ),
                    "username": teacher.username,
                }
                for teacher in teachers
            ],
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
                    "academic_session_id": (
                        classroom.academic_session_id
                    ),
                }
                for classroom in classrooms
            ],
            "sections": [
                {
                    "id": section.id,
                    "name": section.name,
                    "class_id": section.classroom_id,
                    "academic_session_id": (
                        section.classroom.academic_session_id
                    ),
                }
                for section in sections
            ],
            "subjects": [
                {
                    "id": subject.id,
                    "name": subject.name,
                    "code": subject.code,
                    "class_id": subject.classroom_id,
                    "academic_session_id": (
                        subject.classroom.academic_session_id
                    ),
                }
                for subject in subjects
            ],
        })


class CollegeAdminTeacherAssignmentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can view assignments."},
                status=403
            )

        assignments = college_teacher_assignment_queryset(
            organization
        ).order_by(
            "-is_active",
            "teacher__user__username",
            "subject__name",
        )

        search = request.query_params.get("search", "").strip()

        if search:
            assignments = assignments.filter(
                Q(teacher__user__username__icontains=search)
                | Q(teacher__user__first_name__icontains=search)
                | Q(teacher__user__last_name__icontains=search)
                | Q(subject__name__icontains=search)
                | Q(subject__code__icontains=search)
                | Q(section__name__icontains=search)
                | Q(section__classroom__name__icontains=search)
            )

        return Response({
            "assignments": [
                serialize_college_teacher_assignment(assignment)
                for assignment in assignments
            ]
        })

    def post(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can create assignments."},
                status=403
            )

        values, error, status_code = validate_teacher_assignment_payload(
            request.data,
            organization,
        )

        if error:
            return Response(error, status=status_code)

        try:
            assignment = TeacherAssignment.objects.create(**values)
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "This teacher is already assigned to this subject "
                        "and section."
                    )
                },
                status=400
            )

        return Response(
            {
                "message": "Teacher assignment saved successfully.",
                "assignment": serialize_college_teacher_assignment(
                    assignment
                ),
            },
            status=201
        )


class CollegeAdminTeacherAssignmentDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_assignment(self, user, assignment_id):
        organization = college_admin_organization(user)

        if not organization:
            return None

        return college_teacher_assignment_queryset(
            organization
        ).filter(
            id=assignment_id
        ).first()

    def get(self, request, assignment_id):
        assignment = self.get_assignment(
            request.user,
            assignment_id,
        )

        if not assignment:
            return Response(
                {"detail": "Teacher assignment not found."},
                status=404
            )

        return Response({
            "assignment": serialize_college_teacher_assignment(assignment)
        })

    def patch(self, request, assignment_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can update assignments."},
                status=403
            )

        assignment = self.get_assignment(
            request.user,
            assignment_id,
        )

        if not assignment:
            return Response(
                {"detail": "Teacher assignment not found."},
                status=404
            )

        values, error, status_code = validate_teacher_assignment_payload(
            request.data,
            organization,
            assignment=assignment,
        )

        if error:
            return Response(error, status=status_code)

        assignment.teacher = values["teacher"]
        assignment.subject = values["subject"]
        assignment.section = values["section"]
        assignment.is_active = values["is_active"]

        try:
            assignment.save(
                update_fields=[
                    "teacher",
                    "subject",
                    "section",
                    "is_active",
                ]
            )
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "This teacher is already assigned to this subject "
                        "and section."
                    )
                },
                status=400
            )

        return Response({
            "message": "Teacher assignment updated successfully.",
            "assignment": serialize_college_teacher_assignment(assignment),
        })


class CollegeAdminEnrollmentSetupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can manage enrollments."},
                status=403
            )

        students = college_student_queryset(
            organization
        ).order_by(
            "first_name",
            "username",
        )

        active_enrollments = {
            enrollment.student.user_id: enrollment
            for enrollment in college_enrollment_queryset(
                organization
            ).filter(is_active=True)
        }

        sessions = AcademicSession.objects.filter(
            organization=organization
        ).order_by(
            "-is_active",
            "name",
        )

        classrooms = ClassRoom.objects.filter(
            organization=organization
        ).select_related(
            "academic_session"
        ).order_by(
            "name"
        )

        sections = Section.objects.filter(
            organization=organization
        ).select_related(
            "classroom",
            "classroom__academic_session",
        ).order_by(
            "classroom__name",
            "name",
        )

        return Response({
            "students": [
                {
                    "id": student.id,
                    "name": (
                        student.get_full_name().strip()
                        or student.username
                    ),
                    "username": student.username,
                    "active_enrollment": (
                        serialize_college_enrollment(
                            active_enrollments[student.id]
                        )
                        if student.id in active_enrollments
                        else None
                    ),
                }
                for student in students
            ],
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
                    "academic_session_id": (
                        classroom.academic_session_id
                    ),
                }
                for classroom in classrooms
            ],
            "sections": [
                {
                    "id": section.id,
                    "name": section.name,
                    "class_id": section.classroom_id,
                    "academic_session_id": (
                        section.classroom.academic_session_id
                    ),
                }
                for section in sections
            ],
        })


class CollegeAdminEnrollmentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can view enrollments."},
                status=403
            )

        enrollments = college_enrollment_queryset(
            organization
        ).order_by(
            "-is_active",
            "student__user__username",
        )

        search = request.query_params.get("search", "").strip()

        if search:
            enrollments = enrollments.filter(
                Q(student__user__username__icontains=search)
                | Q(student__user__first_name__icontains=search)
                | Q(student__user__last_name__icontains=search)
                | Q(roll_number__icontains=search)
            )

        return Response({
            "enrollments": [
                serialize_college_enrollment(enrollment)
                for enrollment in enrollments
            ]
        })

    def post(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can create enrollments."},
                status=403
            )

        student_id = request.data.get("student_id")
        section_id = request.data.get("section_id")
        roll_number = request.data.get("roll_number", "").strip()

        student = StudentProfile.objects.filter(
            user_id=student_id,
            user__role="student",
            user__organization=organization,
        ).first()

        if not student:
            return Response(
                {"detail": "Student not found."},
                status=404
            )

        section = Section.objects.filter(
            id=section_id,
            organization=organization,
            classroom__organization=organization,
            classroom__academic_session__organization=organization,
        ).first()

        if not section:
            return Response(
                {"detail": "Section not found."},
                status=404
            )

        with transaction.atomic():
            StudentEnrollment.objects.filter(
                student=student,
                is_active=True,
            ).exclude(
                section=section
            ).update(
                is_active=False
            )

            enrollment, _created = StudentEnrollment.objects.get_or_create(
                student=student,
                section=section,
                defaults={
                    "roll_number": roll_number,
                    "is_active": True,
                },
            )

            enrollment.roll_number = roll_number
            enrollment.is_active = True
            enrollment.save(
                update_fields=[
                    "roll_number",
                    "is_active",
                ]
            )

        return Response(
            {
                "message": "Enrollment saved successfully.",
                "enrollment": serialize_college_enrollment(enrollment),
            },
            status=201
        )


class CollegeAdminStudentEnrollmentAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can view enrollments."},
                status=403
            )

        student = StudentProfile.objects.filter(
            user_id=student_id,
            user__role="student",
            user__organization=organization,
        ).first()

        if not student:
            return Response(
                {"detail": "Student not found."},
                status=404
            )

        enrollment = college_enrollment_queryset(
            organization
        ).filter(
            student=student,
            is_active=True,
        ).first()

        return Response({
            "enrollment": (
                serialize_college_enrollment(enrollment)
                if enrollment
                else None
            )
        })


class CollegeAdminEnrollmentDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_enrollment(self, user, enrollment_id):
        organization = college_admin_organization(user)

        if not organization:
            return None

        return college_enrollment_queryset(
            organization
        ).filter(
            id=enrollment_id
        ).first()

    def get(self, request, enrollment_id):
        enrollment = self.get_enrollment(
            request.user,
            enrollment_id,
        )

        if not enrollment:
            return Response(
                {"detail": "Enrollment not found."},
                status=404
            )

        return Response({
            "enrollment": serialize_college_enrollment(enrollment)
        })

    def patch(self, request, enrollment_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can update enrollments."},
                status=403
            )

        enrollment = self.get_enrollment(
            request.user,
            enrollment_id,
        )

        if not enrollment:
            return Response(
                {"detail": "Enrollment not found."},
                status=404
            )

        section = enrollment.section

        if "section_id" in request.data:
            section = Section.objects.filter(
                id=request.data.get("section_id"),
                organization=organization,
                classroom__organization=organization,
                classroom__academic_session__organization=organization,
            ).first()

            if not section:
                return Response(
                    {"detail": "Section not found."},
                    status=404
                )

        roll_number = (
            request.data.get(
                "roll_number",
                enrollment.roll_number,
            ).strip()
        )

        is_active = enrollment.is_active

        if "is_active" in request.data:
            value = request.data.get("is_active")
            is_active = (
                value.lower() in ["true", "1", "yes", "on"]
                if isinstance(value, str)
                else bool(value)
            )

        with transaction.atomic():
            if is_active:
                StudentEnrollment.objects.filter(
                    student=enrollment.student,
                    is_active=True,
                ).exclude(
                    id=enrollment.id
                ).update(
                    is_active=False
                )

            existing = StudentEnrollment.objects.filter(
                student=enrollment.student,
                section=section,
            ).exclude(
                id=enrollment.id
            ).first()

            if existing:
                enrollment.is_active = False
                enrollment.save(update_fields=["is_active"])

                existing.roll_number = roll_number
                existing.is_active = is_active
                existing.save(
                    update_fields=[
                        "roll_number",
                        "is_active",
                    ]
                )
                enrollment = existing
            else:
                enrollment.section = section
                enrollment.roll_number = roll_number
                enrollment.is_active = is_active
                enrollment.save(
                    update_fields=[
                        "section",
                        "roll_number",
                        "is_active",
                    ]
                )

        return Response({
            "message": "Enrollment updated successfully.",
            "enrollment": serialize_college_enrollment(enrollment),
        })


class ParentLoginAPIView(APIView):

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(
            username=username,
            password=password
        )

        if not user:
            return Response(
                {"detail": "Invalid username or password."},
                status=401
            )

        if user.role != "parent":
            return Response(
                {"detail": "Only parents can login here."},
                status=403
            )

        if not user.is_active:
            return Response(
                {"detail": "This account is inactive."},
                status=403
            )

        refresh = RefreshToken.for_user(user)

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "username": user.username,
                "name": (
                    user.get_full_name().strip()
                    or user.username
                ),
                "role": user.role,
                "organization": (
                    user.organization.name
                    if user.organization
                    else None
                ),
            }
        })
        
        
class ParentChildrenAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != "parent":
            return Response(
                {"detail": "Only parents can access linked students."},
                status=403
            )

        parent_profile = ParentProfile.objects.filter(
            user=user
        ).first()

        if not parent_profile:
            return Response(
                {"detail": "Parent profile not found."},
                status=404
            )

        links = ParentStudent.objects.filter(
            parent=parent_profile,
            student__user__organization=user.organization,
        ).select_related(
            "student",
            "student__user",
        )

        children = []

        for link in links:
            student = link.student
            student_user = student.user

            enrollment = StudentEnrollment.objects.filter(
                student=student,
                is_active=True,
                section__organization=user.organization,
            ).select_related(
                "section",
                "section__classroom",
            ).first()

            children.append({
                "student_profile_id": student.id,
                "name": (
                    student_user.get_full_name().strip()
                    or student_user.username
                ),
                "username": student_user.username,
                "roll_number": (
                    enrollment.roll_number
                    if enrollment
                    else ""
                ),
                "classroom_name": (
                    enrollment.section.classroom.name
                    if enrollment
                    else ""
                ),
                "section_name": (
                    enrollment.section.name
                    if enrollment
                    else ""
                ),
                "relationship": link.relationship,
            })

        return Response({
            "children": children
        })


class ParentProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != "parent":
            return Response(
                {"detail": "Only parents can access profile details."},
                status=403
            )

        parent_profile = ParentProfile.objects.filter(
            user=user
        ).first()

        if not parent_profile:
            return Response(
                {"detail": "Parent profile not found."},
                status=404
            )

        if parent_profile.user.organization_id != user.organization_id:
            return Response(
                {"detail": "Profile organization mismatch."},
                status=403
            )

        return Response({
            "profile": {
                "name": (
                    user.get_full_name().strip()
                    or user.username
                ),
                "username": user.username,
                "email": user.email,
                "phone": parent_profile.phone,
                "occupation": parent_profile.occupation,
                "organization": (
                    user.organization.name
                    if user.organization
                    else None
                ),
            }
        })
