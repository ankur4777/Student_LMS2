from decimal import Decimal

from django.db.models import Count, Q, Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.models import ClassRoom, Section, StudentEnrollment, Subject
from accounts.models import StudentProfile, TeacherProfile
from assignments.models import Assignment, AssignmentSubmission
from attendance.models import StudentAttendance
from fees.models import FeePayment, StudentFee
from liveclasses.models import LiveClass
from studentresults.models import Exam, StudentResult


ZERO = Decimal("0.00")


def college_admin_organization(user):
    if user.role != "college_admin" or not user.is_active:
        return None

    return user.organization


def decimal_or_zero(value):
    return value or ZERO


class CollegeAdminOverviewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response(
                {"detail": "College admin access required."},
                status=403,
            )

        attendance_counts = StudentAttendance.objects.filter(
            attendance_session__organization=organization,
        ).aggregate(
            present=Count("id", filter=Q(status=StudentAttendance.Status.PRESENT)),
            absent=Count("id", filter=Q(status=StudentAttendance.Status.ABSENT)),
            late=Count("id", filter=Q(status=StudentAttendance.Status.LATE)),
            excused=Count("id", filter=Q(status=StudentAttendance.Status.EXCUSED)),
        )
        present = attendance_counts["present"]
        absent = attendance_counts["absent"]
        late = attendance_counts["late"]
        excused = attendance_counts["excused"]
        counted = present + absent + late
        overall_percentage = round(((present + late) / counted) * 100, 2) if counted else 0

        assignments = Assignment.objects.filter(organization=organization)
        total_assignments = assignments.count()
        total_submissions = AssignmentSubmission.objects.filter(
            assignment__organization=organization,
        ).count()
        expected_submissions = 0
        for assignment in assignments.select_related("teacher_assignment__section"):
            expected_submissions += StudentEnrollment.objects.filter(
                section=assignment.teacher_assignment.section,
                student__user__organization=organization,
                is_active=True,
            ).count()
        pending_submissions = max(expected_submissions - total_submissions, 0)

        live_classes = LiveClass.objects.filter(organization=organization)
        live_class_counts = live_classes.aggregate(
            scheduled=Count("id", filter=Q(status=LiveClass.Status.SCHEDULED)),
            completed=Count("id", filter=Q(status=LiveClass.Status.COMPLETED)),
            cancelled=Count("id", filter=Q(status=LiveClass.Status.CANCELLED)),
        )

        student_fees = StudentFee.objects.filter(organization=organization)
        fee_totals = student_fees.aggregate(
            expected=Sum("payable_amount"),
        )
        collected = decimal_or_zero(
            FeePayment.objects.filter(
                organization=organization,
            ).aggregate(total=Sum("amount"))["total"]
        )
        expected = decimal_or_zero(fee_totals["expected"])
        pending = expected - collected

        published_exams = Exam.objects.filter(
            organization=organization,
            is_published=True,
        )

        return Response(
            {
                "academic": {
                    "total_students": StudentProfile.objects.filter(
                        user__organization=organization,
                        user__role="student",
                    ).count(),
                    "total_teachers": TeacherProfile.objects.filter(
                        user__organization=organization,
                        user__role="teacher",
                    ).count(),
                    "total_classes": ClassRoom.objects.filter(
                        organization=organization,
                    ).count(),
                    "total_sections": Section.objects.filter(
                        organization=organization,
                    ).count(),
                    "total_subjects": Subject.objects.filter(
                        organization=organization,
                    ).count(),
                },
                "attendance": {
                    "overall_percentage": overall_percentage,
                    "present": present,
                    "absent": absent,
                    "late": late,
                    "excused": excused,
                },
                "assignments": {
                    "total_assignments": total_assignments,
                    "total_submissions": total_submissions,
                    "expected_submissions": expected_submissions,
                    "pending_submissions": pending_submissions,
                },
                "live_classes": {
                    "total_live_classes": live_classes.count(),
                    "scheduled": live_class_counts["scheduled"],
                    "completed": live_class_counts["completed"],
                    "cancelled": live_class_counts["cancelled"],
                },
                "fees": {
                    "total_expected_amount": expected,
                    "total_collected_amount": collected,
                    "total_pending_amount": pending,
                    "paid_count": student_fees.filter(
                        status=StudentFee.Status.PAID,
                    ).count(),
                    "pending_count": student_fees.filter(
                        status__in=[
                            StudentFee.Status.PENDING,
                            StudentFee.Status.PARTIALLY_PAID,
                            StudentFee.Status.OVERDUE,
                        ],
                    ).count(),
                },
                "results": {
                    "published_exams": published_exams.count(),
                    "published_results": StudentResult.objects.filter(
                        exam__in=published_exams,
                    ).count(),
                },
            }
        )
