from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from accounts.models import TeacherProfile
from academics.models import TeacherAssignment, StudentEnrollment


class TeacherResultsSetupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can access results."},
                status=status.HTTP_403_FORBIDDEN,
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {"detail": "Teacher profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        assignments = TeacherAssignment.objects.filter(
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization,
            subject__organization=user.organization,
        ).select_related(
            "subject",
            "section",
            "section__classroom",
        )

        data = []

        for assignment in assignments:
            enrollments = StudentEnrollment.objects.filter(
                section=assignment.section,
                is_active=True,
                student__user__organization=user.organization,
            ).select_related(
                "student",
                "student__user",
            ).order_by("roll_number")

            students = []

            for enrollment in enrollments:
                student_user = enrollment.student.user

                students.append({
                    "student_profile_id": enrollment.student.id,
                    "username": student_user.username,
                    "name": (
                        student_user.get_full_name().strip()
                        or student_user.username
                    ),
                    "roll_number": enrollment.roll_number,
                })

            data.append({
                "teacher_assignment_id": assignment.id,
                "subject_id": assignment.subject.id,
                "subject_name": assignment.subject.name,
                "section_id": assignment.section.id,
                "section_name": assignment.section.name,
                "classroom_name": assignment.section.classroom.name,
                "students": students,
            })

        return Response({
            "assignments": data
        })