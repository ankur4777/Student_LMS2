from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from accounts.models import TeacherProfile
from academics.models import TeacherAssignment, StudentEnrollment

from accounts.models import StudentProfile
from .models import StudentAttendance
from .serializers import StudentAttendanceSerializer
from .models import AttendanceSession, StudentAttendance
from academics.models import TeacherAssignment, StudentEnrollment

class StudentAttendanceAPIView(APIView):
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

        attendance_records = StudentAttendance.objects.filter(
            student=student_profile,
            attendance_session__organization=user.organization
        ).select_related(
            'attendance_session',
            'attendance_session__subject',
            'attendance_session__section',
            'attendance_session__teacher__user'
        ).order_by(
            '-attendance_session__date',
            '-attendance_session__start_time'
        )

        serializer = StudentAttendanceSerializer(
            attendance_records,
            many=True
        )

        return Response(serializer.data)
    
class StudentAttendanceSummaryAPIView(APIView):
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

        records = StudentAttendance.objects.filter(
            student=student_profile,
            attendance_session__organization=user.organization
        )

        total_classes = records.count()

        present = records.filter(
            status=StudentAttendance.Status.PRESENT
        ).count()

        absent = records.filter(
            status=StudentAttendance.Status.ABSENT
        ).count()

        late = records.filter(
            status=StudentAttendance.Status.LATE
        ).count()

        excused = records.filter(
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

        return Response({
            'total_classes': total_classes,
            'present': present,
            'absent': absent,
            'late': late,
            'excused': excused,
            'attendance_percentage': attendance_percentage,
        })
        
class TeacherAttendanceSetupAPIView(APIView):
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

        assignments = TeacherAssignment.objects.filter(
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization
        ).select_related(
            'subject',
            'section',
            'section__classroom'
        ).order_by(
            'section__classroom__name',
            'section__name',
            'subject__name'
        )

        data = []

        for assignment in assignments:
            students = StudentEnrollment.objects.filter(
                section=assignment.section,
                is_active=True,
                student__user__organization=user.organization
            ).select_related(
                'student__user'
            ).order_by(
                'roll_number',
                'student__user__first_name',
                'student__user__last_name'
            )

            student_data = []

            for enrollment in students:
                student_user = enrollment.student.user

                student_name = (
                    student_user.get_full_name().strip()
                    or student_user.username
                )

                student_data.append({
                    'student_profile_id': enrollment.student.id,
                    'username': student_user.username,
                    'name': student_name,
                    'roll_number': enrollment.roll_number,
                })

            data.append({
                'assignment_id': assignment.id,
                'subject_id': assignment.subject.id,
                'subject_name': assignment.subject.name,
                'section_id': assignment.section.id,
                'section_name': assignment.section.name,
                'classroom_name': assignment.section.classroom.name,
                'students': student_data,
            })

        return Response({
            'count': len(data),
            'assignments': data,
        })
        
class TeacherSaveAttendanceAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if user.role != 'teacher':
            return Response(
                {
                    'detail': 'Only teachers can mark attendance.'
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

        assignment_id = request.data.get('assignment_id')
        attendance_date = request.data.get('date')
        attendance_records = request.data.get('attendance', [])

        if not assignment_id:
            return Response(
                {
                    'detail': 'assignment_id is required.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not attendance_date:
            return Response(
                {
                    'detail': 'date is required.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(attendance_records, list):
            return Response(
                {
                    'detail': 'attendance must be a list.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        assignment = TeacherAssignment.objects.filter(
            id=assignment_id,
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization
        ).select_related(
            'subject',
            'section'
        ).first()

        if not assignment:
            return Response(
                {
                    'detail': 'Teaching assignment not found.'
                },
                status=status.HTTP_404_NOT_FOUND
            )

        valid_statuses = {
            StudentAttendance.Status.PRESENT,
            StudentAttendance.Status.ABSENT,
            StudentAttendance.Status.LATE,
            StudentAttendance.Status.EXCUSED,
        }

        attendance_session, created = AttendanceSession.objects.get_or_create(
    organization=user.organization,
    section=assignment.section,
    subject=assignment.subject,
    teacher=teacher_profile,
    date=attendance_date,
)

        # if attendance_session.is_locked:
        #     return Response(
        #         {
        #             'detail': 'Attendance for this session is locked.'
        #         },
        #         status=status.HTTP_400_BAD_REQUEST
        #     )

        saved_records = []

        for item in attendance_records:
            student_profile_id = item.get('student_profile_id')
            attendance_status = item.get('status')
            remarks = item.get('remarks', '')

            if not student_profile_id:
                return Response(
                    {
                        'detail': 'student_profile_id is required for every attendance record.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if attendance_status not in valid_statuses:
                return Response(
                    {
                        'detail': f'Invalid attendance status for student {student_profile_id}.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            enrollment = StudentEnrollment.objects.filter(
                student_id=student_profile_id,
                section=assignment.section,
                is_active=True,
                student__user__organization=user.organization
            ).select_related(
                'student__user'
            ).first()

            if not enrollment:
                return Response(
                    {
                        'detail': f'Student {student_profile_id} is not enrolled in this section.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            student_attendance, _ = StudentAttendance.objects.update_or_create(
                attendance_session=attendance_session,
                student=enrollment.student,
                defaults={
                    'status': attendance_status,
                    'remarks': remarks,
                }
            )

            saved_records.append({
                'student_profile_id': enrollment.student.id,
                'status': student_attendance.status,
                'remarks': student_attendance.remarks,
            })

        return Response({
            'message': 'Attendance saved successfully.',
            'session_id': attendance_session.id,
            'created': created,
            'date': attendance_session.date,
            'subject': assignment.subject.name,
            'section': assignment.section.name,
            'records_saved': len(saved_records),
            'attendance': saved_records,
        })
        
class TeacherAttendanceSessionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != 'teacher':
            return Response(
                {'detail': 'Only teachers can access attendance.'},
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

        assignment_id = request.query_params.get('assignment_id')
        attendance_date = request.query_params.get('date')

        if not assignment_id:
            return Response(
                {'detail': 'assignment_id is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not attendance_date:
            return Response(
                {'detail': 'date is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        assignment = TeacherAssignment.objects.filter(
            id=assignment_id,
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization
        ).select_related(
            'subject',
            'section'
        ).first()

        if not assignment:
            return Response(
                {'detail': 'Teaching assignment not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        attendance_session = AttendanceSession.objects.filter(
            organization=user.organization,
            section=assignment.section,
            subject=assignment.subject,
            teacher=teacher_profile,
            date=attendance_date
        ).first()

        if not attendance_session:
            return Response({
                'exists': False,
                'session_id': None,
                'attendance': [],
            })

        records = StudentAttendance.objects.filter(
            attendance_session=attendance_session
        ).select_related(
            'student__user'
        )

        attendance_data = []

        for record in records:
            student_user = record.student.user

            attendance_data.append({
                'student_profile_id': record.student.id,
                'name': (
                    student_user.get_full_name().strip()
                    or student_user.username
                ),
                'status': record.status,
                'remarks': record.remarks,
            })

        return Response({
            'exists': True,
            'session_id': attendance_session.id,
            'date': attendance_session.date,
            'attendance': attendance_data,
        })