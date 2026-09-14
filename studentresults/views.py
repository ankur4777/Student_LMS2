from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from accounts.models import TeacherProfile
from academics.models import TeacherAssignment, StudentEnrollment, ParentStudent
from datetime import datetime

from studentresults.models import Exam, StudentResult
from notifications.services import notify_exam_published


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
        
class TeacherExamCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can create exams."},
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

        teacher_assignment_id = request.data.get(
            "teacher_assignment_id"
        )
        name = str(request.data.get("name", "")).strip()
        exam_date = request.data.get("exam_date")

        if not teacher_assignment_id:
            return Response(
                {"detail": "Class and subject are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not name:
            return Response(
                {"detail": "Exam name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not exam_date:
            return Response(
                {"detail": "Exam date is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            parsed_exam_date = datetime.strptime(
                exam_date,
                "%Y-%m-%d",
            ).date()
        except (TypeError, ValueError):
            return Response(
                {"detail": "Invalid exam date."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment = TeacherAssignment.objects.filter(
            id=teacher_assignment_id,
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization,
            subject__organization=user.organization,
        ).select_related(
            "section",
            "subject",
        ).first()

        if not assignment:
            return Response(
                {"detail": "Teacher assignment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        exam, created = Exam.objects.get_or_create(
            organization=user.organization,
            section=assignment.section,
            name=name,
            defaults={
                "exam_date": parsed_exam_date,
                "is_published": False,
            },
        )

        if not created:
            return Response(
                {
                    "detail": (
                        "An exam with this name already exists "
                        "for this section."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Exam created successfully.",
                "exam": {
                    "id": exam.id,
                    "name": exam.name,
                    "exam_date": exam.exam_date,
                    "section_id": exam.section.id,
                    "section_name": exam.section.name,
                    "classroom_name": exam.section.classroom.name,
                    "is_published": exam.is_published,
                },
            },
            status=status.HTTP_201_CREATED,
        )
        
class TeacherExamStudentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, exam_id):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can access exam marks."},
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

        teacher_assignment_id = request.query_params.get(
            "teacher_assignment_id"
        )

        if not teacher_assignment_id:
            return Response(
                {"detail": "teacher_assignment_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment = TeacherAssignment.objects.filter(
            id=teacher_assignment_id,
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization,
            subject__organization=user.organization,
        ).select_related(
            "section",
            "section__classroom",
            "subject",
        ).first()

        if not assignment:
            return Response(
                {"detail": "Teacher assignment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        exam = Exam.objects.filter(
            id=exam_id,
            organization=user.organization,
            section=assignment.section,
        ).first()

        if not exam:
            return Response(
                {"detail": "Exam not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        enrollments = StudentEnrollment.objects.filter(
            section=assignment.section,
            is_active=True,
            student__user__organization=user.organization,
        ).select_related(
            "student",
            "student__user",
        ).order_by("roll_number")

        existing_results = StudentResult.objects.filter(
            exam=exam,
            subject=assignment.subject,
            teacher=teacher_profile,
        )

        result_map = {
            result.student_id: result
            for result in existing_results
        }

        students = []

        for enrollment in enrollments:
            student_profile = enrollment.student
            student_user = student_profile.user

            result = result_map.get(student_profile.id)

            students.append({
                "student_profile_id": student_profile.id,
                "name": (
                    student_user.get_full_name().strip()
                    or student_user.username
                ),
                "username": student_user.username,
                "roll_number": enrollment.roll_number,
                "marks_obtained": (
                    str(result.marks_obtained)
                    if result
                    else None
                ),
                "maximum_marks": (
                    str(result.maximum_marks)
                    if result
                    else "100.00"
                ),
                "remarks": (
                    result.remarks
                    if result
                    else ""
                ),
            })

        return Response({
            "exam": {
                "id": exam.id,
                "name": exam.name,
                "exam_date": exam.exam_date,
                "is_published": exam.is_published,
            },
            "subject": {
                "id": assignment.subject.id,
                "name": assignment.subject.name,
            },
            "section": {
                "id": assignment.section.id,
                "name": assignment.section.name,
                "classroom_name": assignment.section.classroom.name,
            },
            "students": students,
        })


class TeacherSaveExamMarksAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, exam_id):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can save exam marks."},
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

        teacher_assignment_id = request.data.get(
            "teacher_assignment_id"
        )

        marks_data = request.data.get("results", [])

        if not teacher_assignment_id:
            return Response(
                {"detail": "teacher_assignment_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(marks_data, list) or not marks_data:
            return Response(
                {"detail": "Results are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment = TeacherAssignment.objects.filter(
            id=teacher_assignment_id,
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization,
            subject__organization=user.organization,
        ).select_related(
            "section",
            "subject",
        ).first()

        if not assignment:
            return Response(
                {"detail": "Teacher assignment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        exam = Exam.objects.filter(
            id=exam_id,
            organization=user.organization,
            section=assignment.section,
        ).first()

        if not exam:
            return Response(
                {"detail": "Exam not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        saved_count = 0

        for item in marks_data:
            student_profile_id = item.get(
                "student_profile_id"
            )

            marks_obtained = item.get("marks_obtained")
            maximum_marks = item.get(
                "maximum_marks",
                100
            )
            remarks = str(
                item.get("remarks", "")
            ).strip()

            if not student_profile_id:
                continue

            enrollment = StudentEnrollment.objects.filter(
                student_id=student_profile_id,
                section=assignment.section,
                is_active=True,
                student__user__organization=user.organization,
            ).first()

            if not enrollment:
                continue

            try:
                marks_value = float(marks_obtained)
                maximum_value = float(maximum_marks)
            except (TypeError, ValueError):
                return Response(
                    {
                        "detail": (
                            "Marks and maximum marks "
                            "must be valid numbers."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if maximum_value <= 0:
                return Response(
                    {
                        "detail": (
                            "Maximum marks must be "
                            "greater than zero."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if marks_value < 0:
                return Response(
                    {"detail": "Marks cannot be negative."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if marks_value > maximum_value:
                return Response(
                    {
                        "detail": (
                            "Obtained marks cannot be "
                            "greater than maximum marks."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            StudentResult.objects.update_or_create(
                exam=exam,
                student=enrollment.student,
                subject=assignment.subject,
                defaults={
                    "teacher": teacher_profile,
                    "marks_obtained": marks_value,
                    "maximum_marks": maximum_value,
                    "remarks": remarks,
                },
            )

            saved_count += 1

        return Response({
            "message": "Exam marks saved successfully.",
            "saved_count": saved_count,
        })
        
class TeacherExamListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can access exams."},
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

        assignment_ids = TeacherAssignment.objects.filter(
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization,
            subject__organization=user.organization,
        ).values_list("section_id", flat=True)

        exams = Exam.objects.filter(
            organization=user.organization,
            section_id__in=assignment_ids,
        ).select_related(
            "section",
            "section__classroom",
        ).order_by(
            "-exam_date",
            "name",
        )

        data = []

        for exam in exams:
            data.append({
                "id": exam.id,
                "name": exam.name,
                "exam_date": exam.exam_date,
                "is_published": exam.is_published,
                "section_id": exam.section.id,
                "section_name": exam.section.name,
                "classroom_name": exam.section.classroom.name,
            })

        return Response({
            "exams": data
        })
        
class TeacherPublishExamAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, exam_id):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can publish results."},
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

        exam = Exam.objects.filter(
            id=exam_id,
            organization=user.organization,
        ).select_related("section").first()

        if not exam:
            return Response(
                {"detail": "Exam not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Teacher must have an active assignment in this section.
        has_access = TeacherAssignment.objects.filter(
            teacher=teacher_profile,
            section=exam.section,
            is_active=True,
            section__organization=user.organization,
        ).exists()

        if not has_access:
            return Response(
                {"detail": "You do not have access to this exam."},
                status=status.HTTP_403_FORBIDDEN,
            )

        is_published = request.data.get("is_published")

        if not isinstance(is_published, bool):
            return Response(
                {
                    "detail": (
                        "is_published must be true or false."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Do not publish an exam with no marks entered.
        if is_published and not StudentResult.objects.filter(
            exam=exam
        ).exists():
            return Response(
                {
                    "detail": (
                        "Enter student marks before publishing "
                        "the result."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        was_published = exam.is_published

        exam.is_published = is_published
        exam.save(
            update_fields=[
                "is_published",
                "updated_at",
            ]
        )

        if not was_published and exam.is_published:
            notify_exam_published(exam)

        return Response({
            "message": (
                "Result published successfully."
                if exam.is_published
                else "Result unpublished successfully."
            ),
            "exam": {
                "id": exam.id,
                "name": exam.name,
                "is_published": exam.is_published,
            },
        })

class StudentResultsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != "student":
            return Response(
                {"detail": "Only students can access results."},
                status=status.HTTP_403_FORBIDDEN,
            )

        student_profile = getattr(user, "student_profile", None)

        if not student_profile:
            return Response(
                {"detail": "Student profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        enrollment = StudentEnrollment.objects.filter(
            student=student_profile,
            is_active=True,
            section__organization=user.organization,
        ).select_related(
            "section",
            "section__classroom",
        ).first()

        if not enrollment:
            return Response(
                {"detail": "Active enrollment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        results = StudentResult.objects.filter(
            student=student_profile,
            exam__organization=user.organization,
            exam__section=enrollment.section,
            exam__is_published=True,
        ).select_related(
            "exam",
            "subject",
            "teacher",
            "teacher__user",
        ).order_by(
            "-exam__exam_date",
            "exam__name",
            "subject__name",
        )

        exams_map = {}

        for result in results:
            exam = result.exam

            if exam.id not in exams_map:
                exams_map[exam.id] = {
                    "id": exam.id,
                    "name": exam.name,
                    "exam_date": exam.exam_date,
                    "section_name": exam.section.name,
                    "classroom_name": exam.section.classroom.name,
                    "subjects": [],
                    "total_obtained": 0,
                    "total_maximum": 0,
                }

            subject_percentage = 0

            if result.maximum_marks:
                subject_percentage = round(
                    (
                        float(result.marks_obtained)
                        / float(result.maximum_marks)
                    ) * 100,
                    2,
                )

            teacher_user = result.teacher.user

            exams_map[exam.id]["subjects"].append({
                "subject_id": result.subject.id,
                "subject_name": result.subject.name,
                "marks_obtained": str(result.marks_obtained),
                "maximum_marks": str(result.maximum_marks),
                "percentage": subject_percentage,
                "remarks": result.remarks,
                "teacher_name": (
                    teacher_user.get_full_name().strip()
                    or teacher_user.username
                ),
            })

            exams_map[exam.id]["total_obtained"] += float(
                result.marks_obtained
            )
            exams_map[exam.id]["total_maximum"] += float(
                result.maximum_marks
            )

        exam_data = []

        for exam in exams_map.values():
            total_percentage = 0

            if exam["total_maximum"] > 0:
                total_percentage = round(
                    (
                        exam["total_obtained"]
                        / exam["total_maximum"]
                    ) * 100,
                    2,
                )

            exam["total_obtained"] = round(
                exam["total_obtained"],
                2,
            )
            exam["total_maximum"] = round(
                exam["total_maximum"],
                2,
            )
            exam["percentage"] = total_percentage

            exam_data.append(exam)

        return Response({
            "student": {
                "id": student_profile.id,
                "name": (
                    user.get_full_name().strip()
                    or user.username
                ),
                "username": user.username,
                "roll_number": enrollment.roll_number,
                "section_name": enrollment.section.name,
                "classroom_name": enrollment.section.classroom.name,
            },
            "exams": exam_data,
        })
        
class ParentStudentResultsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        user = request.user

        if user.role != "parent":
            return Response(
                {"detail": "Only parents can access student results."},
                status=status.HTTP_403_FORBIDDEN,
            )

        parent_profile = getattr(user, "parent_profile", None)

        if not parent_profile:
            return Response(
                {"detail": "Parent profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        parent_student = ParentStudent.objects.filter(
            parent=parent_profile,
            student_id=student_id,
            student__user__organization=user.organization,
        ).select_related(
            "student",
            "student__user",
        ).first()

        if not parent_student:
            return Response(
                {"detail": "Student not linked to this parent."},
                status=status.HTTP_403_FORBIDDEN,
            )

        student_profile = parent_student.student

        enrollment = StudentEnrollment.objects.filter(
            student=student_profile,
            is_active=True,
            section__organization=user.organization,
        ).select_related(
            "section",
            "section__classroom",
        ).first()

        if not enrollment:
            return Response(
                {"detail": "Active enrollment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        results = StudentResult.objects.filter(
            student=student_profile,
            exam__organization=user.organization,
            exam__section=enrollment.section,
            exam__is_published=True,
        ).select_related(
            "exam",
            "subject",
            "teacher",
            "teacher__user",
        ).order_by(
            "-exam__exam_date",
            "exam__name",
            "subject__name",
        )

        exams_map = {}

        for result in results:
            exam = result.exam

            if exam.id not in exams_map:
                exams_map[exam.id] = {
                    "id": exam.id,
                    "name": exam.name,
                    "exam_date": exam.exam_date,
                    "section_name": exam.section.name,
                    "classroom_name": exam.section.classroom.name,
                    "subjects": [],
                    "total_obtained": 0,
                    "total_maximum": 0,
                }

            subject_percentage = 0

            if result.maximum_marks:
                subject_percentage = round(
                    (
                        float(result.marks_obtained)
                        / float(result.maximum_marks)
                    ) * 100,
                    2,
                )

            teacher_user = result.teacher.user

            exams_map[exam.id]["subjects"].append({
                "subject_id": result.subject.id,
                "subject_name": result.subject.name,
                "marks_obtained": str(result.marks_obtained),
                "maximum_marks": str(result.maximum_marks),
                "percentage": subject_percentage,
                "remarks": result.remarks,
                "teacher_name": (
                    teacher_user.get_full_name().strip()
                    or teacher_user.username
                ),
            })

            exams_map[exam.id]["total_obtained"] += float(
                result.marks_obtained
            )

            exams_map[exam.id]["total_maximum"] += float(
                result.maximum_marks
            )

        exam_data = []

        for exam in exams_map.values():
            total_percentage = 0

            if exam["total_maximum"] > 0:
                total_percentage = round(
                    (
                        exam["total_obtained"]
                        / exam["total_maximum"]
                    ) * 100,
                    2,
                )

            exam["total_obtained"] = round(
                exam["total_obtained"],
                2,
            )

            exam["total_maximum"] = round(
                exam["total_maximum"],
                2,
            )

            exam["percentage"] = total_percentage

            exam_data.append(exam)

        student_user = student_profile.user

        return Response({
            "student": {
                "id": student_profile.id,
                "name": (
                    student_user.get_full_name().strip()
                    or student_user.username
                ),
                "username": student_user.username,
                "roll_number": enrollment.roll_number,
                "section_name": enrollment.section.name,
                "classroom_name": enrollment.section.classroom.name,
            },
            "exams": exam_data,
        })
