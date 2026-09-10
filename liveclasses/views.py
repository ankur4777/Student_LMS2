import mimetypes

from django.http import FileResponse
from django.shortcuts import get_object_or_404

from .models import LiveClass, LiveClassRecording
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.models import StudentProfile
from django.utils import timezone

from .serializers import LiveClassSerializer
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework import status

from accounts.models import StudentProfile, TeacherProfile

from .serializers import (
    LiveClassSerializer,
    TeacherRecordingUploadSerializer,
    TeacherRecordingUpdateSerializer,
)




class StudentLiveClassesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        user = request.user

        # Only students can access this endpoint
        if user.role != 'student':
            return Response(
                {'detail': 'Only students can access this endpoint.'},
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

        # Get active enrollment
        enrollment = student_profile.enrollments.filter(
            is_active=True
        ).select_related('section').first()

        if not enrollment:
            return Response(
                {'detail': 'No active student enrollment found.'},
                status=404
            )

        live_classes = LiveClass.objects.filter(
            organization=user.organization,
            teacher_assignment__section=enrollment.section
        ).select_related(
            'teacher_assignment__teacher__user',
            'teacher_assignment__subject',
            'teacher_assignment__section'
        ).order_by(
            'class_date',
            'start_time'
        )

        serializer = LiveClassSerializer(
            live_classes,
            many=True
        )

        return Response(serializer.data)    

class StudentTodayClassesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != 'student':
            return Response(
                {'detail': 'Only students can access this endpoint.'},
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
        ).select_related('section').first()

        if not enrollment:
            return Response(
                {'detail': 'No active student enrollment found.'},
                status=404
            )

        today = timezone.localdate()

        live_classes = LiveClass.objects.filter(
            organization=user.organization,
            teacher_assignment__section=enrollment.section,
            class_date=today
        ).select_related(
            'teacher_assignment__teacher__user',
            'teacher_assignment__subject',
            'teacher_assignment__section'
        ).order_by('start_time')

        serializer = LiveClassSerializer(
            live_classes,
            many=True
        )

        return Response(serializer.data)
    
class StudentUpcomingClassesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != 'student':
            return Response(
                {'detail': 'Only students can access this endpoint.'},
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
        ).select_related('section').first()

        if not enrollment:
            return Response(
                {'detail': 'No active student enrollment found.'},
                status=404
            )

        today = timezone.localdate()

        live_classes = LiveClass.objects.filter(
            organization=user.organization,
            teacher_assignment__section=enrollment.section,
            class_date__gt=today,
            status=LiveClass.Status.SCHEDULED
        ).select_related(
            'teacher_assignment__teacher__user',
            'teacher_assignment__subject',
            'teacher_assignment__section'
        ).order_by(
            'class_date',
            'start_time'
        )

        serializer = LiveClassSerializer(
            live_classes,
            many=True
        )

        return Response(serializer.data)
    
class StudentCompletedClassesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != 'student':
            return Response(
                {'detail': 'Only students can access this endpoint.'},
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
        ).select_related('section').first()

        if not enrollment:
            return Response(
                {'detail': 'No active student enrollment found.'},
                status=404
            )

        live_classes = LiveClass.objects.filter(
            organization=user.organization,
            teacher_assignment__section=enrollment.section,
            status=LiveClass.Status.COMPLETED
        ).select_related(
            'teacher_assignment__teacher__user',
            'teacher_assignment__subject',
            'teacher_assignment__section'
        ).order_by(
            '-class_date',
            '-start_time'
        )

        serializer = LiveClassSerializer(
            live_classes,
            many=True
        )

        return Response(serializer.data)
    
class StudentRecordedClassesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != 'student':
            return Response(
                {'detail': 'Only students can access this endpoint.'},
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
        ).select_related('section').first()

        if not enrollment:
            return Response(
                {'detail': 'No active student enrollment found.'},
                status=404
            )

        live_classes = LiveClass.objects.filter(
            organization=user.organization,
            teacher_assignment__section=enrollment.section,
            status=LiveClass.Status.COMPLETED,
            recording__is_available=True
        ).exclude(
            recording__video=''
        ).select_related(
            'teacher_assignment__teacher__user',
            'teacher_assignment__subject',
            'teacher_assignment__section',
            'recording'
        ).order_by(
            '-class_date',
            '-start_time'
        )

        serializer = LiveClassSerializer(
            live_classes,
            many=True,
            context={'request': request}
        )

        return Response(serializer.data)
    
class StudentRecordingPlaybackAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, public_id):
        user = request.user

        # Only students can watch through this endpoint
        if user.role != 'student':
            return Response(
                {'detail': 'Only students can access this recording.'},
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

        recording = get_object_or_404(
            LiveClassRecording.objects.select_related(
                'live_class',
                'live_class__teacher_assignment__section'
            ),
            public_id=public_id,
            is_available=True
        )

        live_class = recording.live_class

        # College / tenant protection
        if live_class.organization_id != user.organization_id:
            return Response(
                {'detail': 'You are not authorized to access this recording.'},
                status=403
            )

        # Recording should be available only for completed classes
        if live_class.status != LiveClass.Status.COMPLETED:
            return Response(
                {'detail': 'This recording is not available yet.'},
                status=403
            )

        section = live_class.teacher_assignment.section

        # Student must currently belong to this section
        is_enrolled = student_profile.enrollments.filter(
            section=section,
            is_active=True
        ).exists()

        if not is_enrolled:
            return Response(
                {'detail': 'You are not enrolled in this class.'},
                status=403
            )

        if not recording.video:
            return Response(
                {'detail': 'Recording file not found.'},
                status=404
            )

        content_type, _ = mimetypes.guess_type(
            recording.video.name
        )

        response = FileResponse(
            recording.video.open('rb'),
            content_type=content_type or 'application/octet-stream'
        )

        response['Content-Disposition'] = (
            f'inline; filename="{recording.video.name.split("/")[-1]}"'
        )

        response['X-Content-Type-Options'] = 'nosniff'

        return response
    
class TeacherRecordingUploadAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user = request.user

        # Only teachers can upload recordings
        if user.role != 'teacher':
            return Response(
                {'detail': 'Only teachers can upload recordings.'},
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {'detail': 'Teacher profile not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = TeacherRecordingUploadSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        live_class = serializer.validated_data['live_class']

        # Teacher and live class must belong to same college
        if live_class.organization_id != user.organization_id:
            return Response(
                {'detail': 'You cannot upload recordings for another college.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Teacher can upload only for their own assigned live class
        if live_class.teacher_assignment.teacher_id != teacher_profile.id:
            return Response(
                {'detail': 'You are not assigned to this live class.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Recording allowed only after class is completed
        if live_class.status != LiveClass.Status.COMPLETED:
            return Response(
                {'detail': 'Recording can be uploaded only for a completed class.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # One recording per live class for now
        if LiveClassRecording.objects.filter(
            live_class=live_class
        ).exists():
            return Response(
                {'detail': 'A recording already exists for this live class.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        recording = serializer.save(
            uploaded_by=teacher_profile
        )

        return Response(
            {
                'message': 'Recording uploaded successfully.',
                'recording_id': recording.id,
                'public_id': recording.public_id,
                'title': recording.title,
                'live_class': recording.live_class.title,
            },
            status=status.HTTP_201_CREATED
        )
        
class TeacherRecordingEligibleClassesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != 'teacher':
            return Response(
                {'detail': 'Only teachers can access this endpoint.'},
                status=403
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {'detail': 'Teacher profile not found.'},
                status=404
            )

        live_classes = LiveClass.objects.filter(
            organization=user.organization,
            teacher_assignment__teacher=teacher_profile,
            status=LiveClass.Status.COMPLETED,
            recording__isnull=True
        ).select_related(
            'teacher_assignment__subject',
            'teacher_assignment__section'
        ).order_by(
            '-class_date',
            '-start_time'
        )

        serializer = LiveClassSerializer(
            live_classes,
            many=True
        )

        return Response(serializer.data)
    
class TeacherRecordingsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Only teachers can access this endpoint
        if user.role != 'teacher':
            return Response(
                {'detail': 'Only teachers can access this endpoint.'},
                status=403
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {'detail': 'Teacher profile not found.'},
                status=404
            )

        recordings = LiveClassRecording.objects.filter(
            uploaded_by=teacher_profile,
            live_class__organization=user.organization
        ).select_related(
            'live_class',
            'live_class__teacher_assignment__subject',
            'live_class__teacher_assignment__section'
        ).order_by('-uploaded_at')

        data = []

        for recording in recordings:
            data.append({
                'id': recording.id,
                'public_id': recording.public_id,
                'title': recording.title,
                'live_class': recording.live_class.title,
                'subject': recording.live_class.teacher_assignment.subject.name,
                'section': recording.live_class.teacher_assignment.section.name,
                'class_date': recording.live_class.class_date,
                'is_available': recording.is_available,
                'uploaded_at': recording.uploaded_at,
            })

        return Response(data)
    
class TeacherRecordingDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    def patch(self, request, public_id):
        user = request.user

        if user.role != 'teacher':
            return Response(
                {'detail': 'Only teachers can manage recordings.'},
                status=403
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {'detail': 'Teacher profile not found.'},
                status=404
            )

        recording = get_object_or_404(
            LiveClassRecording,
            public_id=public_id,
            uploaded_by=teacher_profile,
            live_class__organization=user.organization
        )

        old_video_name = (
            recording.video.name
            if recording.video
            else None
        )

        serializer = TeacherRecordingUpdateSerializer(
            recording,
            data=request.data,
            partial=True
        )

        serializer.is_valid(raise_exception=True)

        updated_recording = serializer.save()

        if (
            old_video_name
            and 'video' in request.FILES
            and old_video_name != updated_recording.video.name
        ):
            updated_recording.video.storage.delete(
                old_video_name
            )

        return Response({
            'message': 'Recording updated successfully.',
            'public_id': updated_recording.public_id,
            'title': updated_recording.title,
            'is_available': updated_recording.is_available,
        })
class TeacherLiveClassesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Only teachers
        if user.role != 'teacher':
            return Response(
                {
                    'detail':
                    'Only teachers can access this endpoint.'
                },
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {
                    'detail':
                    'Teacher profile not found.'
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # Tenant + teacher protection
        live_classes = LiveClass.objects.filter(
            organization=user.organization,
            teacher_assignment__teacher=teacher_profile,
            teacher_assignment__is_active=True
        ).select_related(
            'teacher_assignment__subject',
            'teacher_assignment__section',
            'teacher_assignment__section__classroom'
        ).order_by(
            '-class_date',
            '-start_time'
        )

        today = timezone.localdate()

        data = []

        for live_class in live_classes:

            # Useful UI category
            if (
                live_class.status
                == LiveClass.Status.COMPLETED
            ):
                category = 'completed'

            elif live_class.class_date == today:
                category = 'today'

            elif live_class.class_date > today:
                category = 'upcoming'

            else:
                category = 'past'

            data.append({
                'id': live_class.id,
                'title': live_class.title,
                'description': live_class.description,

                'class_date': live_class.class_date,
                'start_time': live_class.start_time,
                'end_time': live_class.end_time,

                'meeting_link':
                    live_class.meeting_link,

                'status':
                    live_class.status,

                'category':
                    category,

                'subject_name':
                    live_class
                    .teacher_assignment
                    .subject
                    .name,

                'section_name':
                    live_class
                    .teacher_assignment
                    .section
                    .name,

                'classroom_name':
                    live_class
                    .teacher_assignment
                    .section
                    .classroom
                    .name,

                'has_recording':
                    hasattr(
                        live_class,
                        'recording'
                    ),
            })

        return Response({
            'count': len(data),
            'classes': data,
        })
        
    class TeacherLiveClassesAPIView(APIView):
        permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != 'teacher':
            return Response(
                {
                    'detail': 'Only teachers can access this endpoint.'
                },
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {
                    'detail': 'Teacher profile not found.'
                },
                status=status.HTTP_404_NOT_FOUND
            )

        live_classes = LiveClass.objects.filter(
            organization=user.organization,
            teacher_assignment__teacher=teacher_profile,
            teacher_assignment__is_active=True
        ).select_related(
            'teacher_assignment__subject',
            'teacher_assignment__section',
            'teacher_assignment__section__classroom'
        ).order_by(
            '-class_date',
            '-start_time'
        )

        today = timezone.localdate()

        data = []

        for live_class in live_classes:

            if live_class.status == LiveClass.Status.COMPLETED:
                category = 'completed'

            elif live_class.class_date == today:
                category = 'today'

            elif live_class.class_date > today:
                category = 'upcoming'

            else:
                category = 'past'

            data.append({
                'id': live_class.id,
                'title': live_class.title,
                'description': live_class.description,
                'class_date': live_class.class_date,
                'start_time': live_class.start_time,
                'end_time': live_class.end_time,
                'meeting_link': live_class.meeting_link,
                'status': live_class.status,
                'category': category,

                'subject_name':
                    live_class.teacher_assignment.subject.name,

                'section_name':
                    live_class.teacher_assignment.section.name,

                'classroom_name':
                    live_class.teacher_assignment.section.classroom.name,

                'has_recording':
                    hasattr(live_class, 'recording'),
            })

        return Response({
            'count': len(data),
            'classes': data,
        })