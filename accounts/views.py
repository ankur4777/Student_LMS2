from django.utils import timezone
from django.db import transaction
from django.db.models import Q

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
