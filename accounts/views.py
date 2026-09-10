from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import StudentProfile

from attendance.models import StudentAttendance
from liveclasses.models import LiveClass, LiveClassRecording
from liveclasses.serializers import LiveClassSerializer

from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import TeacherProfile
from academics.models import TeacherAssignment


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