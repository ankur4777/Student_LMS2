"""Online exam API built on the existing studentresults.Exam and StudentResult models.

Legacy manually-entered exams continue using studentresults.views unchanged.
"""
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.db.models import F
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import TeacherProfile
from academics.feature_access import (
    StudentClassFeaturePermission,
    get_active_student_enrollment,
)
from academics.models import TeacherAssignment
from academics.subject_access import student_studies_subject
from .models import (
    Exam, ExamAnswer, ExamAttempt, ExamChoice, ExamQuestion, StudentResult,
)


def _bad(message, code=400):
    return Response({"detail": message}, status=code)


def _teacher_assignment(user, assignment_id):
    if user.role != "teacher" or not user.organization_id:
        return None
    try:
        assignment_id = int(assignment_id)
    except (ValueError, TypeError):
        return None
    return TeacherAssignment.objects.select_related(
        "teacher", "subject", "section", "section__classroom"
    ).filter(
        id=assignment_id,
        teacher__user=user,
        teacher__user__organization=user.organization,
        is_active=True,
        subject__organization=user.organization,
        section__organization=user.organization,
        section__classroom__organization=user.organization,
        subject__classroom_id=F("section__classroom_id"),
    ).first()


def _teacher_exam(user, exam_id):
    return Exam.objects.select_related(
        "online_teacher_assignment",
        "online_teacher_assignment__subject",
        "online_teacher_assignment__section",
    ).filter(
        id=exam_id,
        organization=user.organization,
        online_teacher_assignment__teacher__user=user,
        online_teacher_assignment__is_active=True,
        online_teacher_assignment__subject__organization=user.organization,
        online_teacher_assignment__section__organization=user.organization,
    ).first()


def _student_exam(user, exam_id):
    if user.role != "student" or not user.organization_id:
        return None, None
    enrollment = get_active_student_enrollment(user)
    if not enrollment:
        return None, None
    exam = Exam.objects.select_related(
        "online_teacher_assignment",
        "online_teacher_assignment__subject",
        "online_teacher_assignment__section",
    ).filter(
        pk=exam_id,
        organization=user.organization,
        section=enrollment.section,
        online_is_open=True,
        online_teacher_assignment__isnull=False,
        online_teacher_assignment__subject__organization=user.organization,
    ).first()
    if not exam or not student_studies_subject(
        enrollment.student, exam.online_teacher_assignment.subject
    ):
        return None, enrollment
    return exam, enrollment


def _parse_schedule(data, *, existing=None):
    try:
        start = data.get("starts_at", existing.online_starts_at if existing else None)
        end = data.get("ends_at", existing.online_ends_at if existing else None)
        minutes = int(data.get(
            "duration_minutes", existing.online_duration_minutes if existing else 60
        ))
        if isinstance(start, str):
            start = parse_datetime(start)
        if isinstance(end, str):
            end = parse_datetime(end)
        if not isinstance(start, datetime) or not isinstance(end, datetime):
            return None, "Start and end date/time are required."
        if timezone.is_naive(start) or timezone.is_naive(end):
            return None, "Start and end times must include a timezone offset."
        if not (1 <= minutes <= 360):
            return None, "Duration must be between 1 and 360 minutes."
        if end <= start:
            return None, "End time must be after start time."
        return (start, end, minutes), None
    except (ValueError, TypeError, OverflowError):
        return None, "Invalid exam schedule or duration."


def _question_config(items):
    if not isinstance(items, list) or not items:
        return None, "At least one question is required."
    if len(items) > 200:
        return None, "An exam supports at most 200 questions."
    validated = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            return None, "Each question must be an object."
        kind = item.get("kind")
        prompt = str(item.get("prompt") or "").strip()
        if kind not in ExamQuestion.Kind.values or not prompt or len(prompt) > 10000:
            return None, f"Question {index + 1} has an invalid type or prompt."
        try:
            marks = Decimal(str(item.get("marks")))
            if not marks.is_finite() or marks <= 0 or marks > 1000:
                raise InvalidOperation
            marks = marks.quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError, TypeError):
            return None, f"Question {index + 1} has invalid marks."
        if marks <= 0:
            return None, "Question marks must be at least 0.01."
        choices = []
        if kind in (ExamQuestion.Kind.MULTIPLE_CHOICE, ExamQuestion.Kind.TRUE_FALSE):
            raw_choices = item.get("choices", [])
            if not isinstance(raw_choices, list):
                return None, "Choices must be a list."
            if kind == ExamQuestion.Kind.TRUE_FALSE:
                if len(raw_choices) == 0:
                    raw_choices = [
                        {"text": "True", "is_correct": item.get("correct_answer") == "true"},
                        {"text": "False", "is_correct": item.get("correct_answer") == "false"},
                    ]
                if not all(isinstance(x, dict) for x in raw_choices):
                    return None, "Each true/false choice must be an object."
                if {str(x.get("text", "")).strip().lower() for x in raw_choices} != {"true", "false"}:
                    return None, "True/false questions must have True and False choices."
            if not (2 <= len(raw_choices) <= 8):
                return None, f"Question {index + 1} requires 2–8 options."
            for option in raw_choices:
                if not isinstance(option, dict):
                    return None, "Each choice must be an object."
                text = str(option.get("text") or "").strip()
                if not text or len(text) > 500 or type(option.get("is_correct")) is not bool:
                    return None, "Every choice needs text and a true/false is_correct flag."
                choices.append((text, option["is_correct"]))
            if sum(1 for _, correct in choices if correct) != 1:
                return None, "Each objective question must have exactly one correct answer."
            if len({value.lower() for value, _ in choices}) != len(choices):
                return None, "Duplicate choices are not allowed."
        validated.append((kind, prompt, marks, choices))
    total_marks = sum((entry[2] for entry in validated), Decimal("0.00"))
    if total_marks > Decimal("9999.99"):
        return None, "Total exam marks cannot exceed 9,999.99."
    return validated, None


def _serialize_question(question, teacher=False, answer=None):
    data = {
        "id": question.id,
        "kind": question.kind,
        "prompt": question.prompt,
        "marks": str(question.marks),
        "choices": [
            {
                "id": choice.id,
                "text": choice.text,
                **({"is_correct": choice.is_correct} if teacher else {}),
            }
            for choice in question.choices.all()
        ],
    }
    if answer is not None:
        data["answer"] = {
            "selected_choice_id": answer.selected_choice_id,
            "text_answer": answer.text_answer,
            **({"awarded_marks": str(answer.awarded_marks) if answer.awarded_marks is not None else None,
                "feedback": answer.feedback} if teacher else {}),
        }
    return data


def _exam_data(exam):
    assignment = exam.online_teacher_assignment
    return {
        "id": exam.id,
        "title": exam.name,
        "subject": assignment.subject.name,
        "subject_id": assignment.subject_id,
        "teacher_assignment_id": assignment.id,
        "classroom": assignment.section.classroom.name,
        "section": assignment.section.name,
        "starts_at": exam.online_starts_at,
        "ends_at": exam.online_ends_at,
        "duration_minutes": exam.online_duration_minutes,
        "available_to_students": exam.online_is_open,
        "result_published": exam.is_published,
        "total_marks": str(sum(
            (q.marks for q in exam.questions.all()), Decimal("0")
        )),
        "question_count": len(exam.questions.all()),
    }


def _attempt_deadline(attempt):
    exam = attempt.exam
    return min(
        attempt.started_at + timedelta(minutes=exam.online_duration_minutes),
        exam.online_ends_at,
    )


def _sum_max(exam, objective):
    return sum(
        (q.marks for q in exam.questions.all() if q.is_objective == objective),
        Decimal("0.00"),
    )


def _sync_complete_result(attempt):
    """Write the existing result only when every subjective question is graded."""
    if attempt.state != ExamAttempt.State.GRADED:
        return
    exam = attempt.exam
    assignment = exam.online_teacher_assignment
    StudentResult.objects.update_or_create(
        exam=exam,
        student=attempt.student,
        subject=assignment.subject,
        defaults={
            "teacher": assignment.teacher,
            "marks_obtained": attempt.objective_marks + attempt.subjective_marks,
            "maximum_marks": _sum_max(exam, True) + _sum_max(exam, False),
            "remarks": "",
        },
    )


def _finalize(attempt):
    if attempt.state != ExamAttempt.State.IN_PROGRESS:
        return
    exam = attempt.exam
    marks = Decimal("0.00")
    has_subjective = False
    for question in exam.questions.prefetch_related("choices").all():
        answer, _ = ExamAnswer.objects.get_or_create(
            attempt=attempt, question=question
        )
        if question.is_objective:
            correct = any(
                choice.id == answer.selected_choice_id and choice.is_correct
                for choice in question.choices.all()
            )
            answer.awarded_marks = question.marks if correct else Decimal("0.00")
            answer.graded_at = timezone.now()
            answer.save(update_fields=["awarded_marks", "graded_at"])
            marks += answer.awarded_marks
        else:
            has_subjective = True
    attempt.objective_marks = marks
    attempt.submitted_at = timezone.now()
    attempt.state = (
        ExamAttempt.State.SUBMITTED
        if has_subjective else ExamAttempt.State.GRADED
    )
    attempt.save(update_fields=[
        "objective_marks", "submitted_at", "state"
    ])
    _sync_complete_result(attempt)


def _visible_attempt(attempt, teacher=False):
    exam = attempt.exam
    max_obj = _sum_max(exam, True)
    max_subj = _sum_max(exam, False)
    is_final = attempt.state == ExamAttempt.State.GRADED
    overall_visible = teacher or (is_final and exam.is_published)
    objective_pct = (
        round(attempt.objective_marks * 100 / max_obj, 2)
        if max_obj > 0 and attempt.submitted_at else None
    )
    all_max = max_obj + max_subj
    return {
        "id": attempt.id,
        "state": attempt.state,
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
        "deadline": _attempt_deadline(attempt),
        "objective_marks": str(attempt.objective_marks) if attempt.submitted_at else None,
        "objective_maximum": str(max_obj),
        "objective_percentage": objective_pct,
        "subjective_maximum": str(max_subj),
        "subjective_marks": str(attempt.subjective_marks) if overall_visible and is_final else None,
        "result_published": exam.is_published,
        "overall_marks": str(attempt.objective_marks + attempt.subjective_marks)
        if overall_visible and is_final else None,
        "overall_maximum": str(all_max),
        "overall_percentage": round(
            (attempt.objective_marks + attempt.subjective_marks) * 100 / all_max, 2
        ) if overall_visible and is_final and all_max > 0 else None,
    }


class TeacherOnlineExamListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "teacher":
            return _bad("Only teachers can access online exams.", 403)
        exams = Exam.objects.filter(
            online_teacher_assignment__teacher__user=request.user,
            organization=request.user.organization,
        ).select_related(
            "online_teacher_assignment__subject",
            "online_teacher_assignment__section__classroom",
        ).prefetch_related("questions").order_by("-created_at")
        return Response({"exams": [_exam_data(exam) for exam in exams]})

    def post(self, request):
        assignment = _teacher_assignment(
            request.user, request.data.get("teacher_assignment_id")
        )
        if not assignment:
            return _bad("Teacher assignment not found.", 404)
        title = str(request.data.get("title") or "").strip()
        if not title or len(title) > 150:
            return _bad("Exam title is required (maximum 150 characters).")
        schedule, error = _parse_schedule(request.data)
        if error:
            return _bad(error)
        start, end, duration = schedule
        try:
            with transaction.atomic():
                exam = Exam.objects.create(
                    organization=request.user.organization,
                    section=assignment.section,
                    name=title,
                    exam_date=timezone.localtime(start).date(),
                    online_teacher_assignment=assignment,
                    online_starts_at=start,
                    online_ends_at=end,
                    online_duration_minutes=duration,
                )
        except IntegrityError:
            return _bad("An exam with that title already exists for this section.")
        return Response({"exam": _exam_data(exam)}, status=201)


class TeacherOnlineExamDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, exam_id):
        exam = _teacher_exam(request.user, exam_id)
        if not exam:
            return _bad("Online exam not found.", 404)
        questions = exam.questions.prefetch_related("choices").all()
        return Response({
            "exam": _exam_data(exam),
            "questions": [_serialize_question(q, teacher=True) for q in questions],
        })

    def patch(self, request, exam_id):
        exam = _teacher_exam(request.user, exam_id)
        if not exam:
            return _bad("Online exam not found.", 404)
        if exam.online_is_open or exam.attempts.exists():
            return _bad("An open exam or an exam with attempts cannot be edited.")
        schedule, error = _parse_schedule(request.data, existing=exam)
        if error:
            return _bad(error)
        title = str(request.data.get("title", exam.name)).strip()
        if not title or len(title) > 150:
            return _bad("Invalid exam title.")
        validated = None
        if "questions" in request.data:
            validated, error = _question_config(request.data["questions"])
            if error:
                return _bad(error)
        start, end, duration = schedule
        try:
            with transaction.atomic():
                locked = Exam.objects.select_for_update().get(pk=exam.pk)
                if locked.online_is_open or locked.attempts.exists():
                    return _bad("Exam has already been released.")
                locked.name = title
                locked.exam_date = timezone.localtime(start).date()
                locked.online_starts_at = start
                locked.online_ends_at = end
                locked.online_duration_minutes = duration
                locked.save(update_fields=[
                    "name", "exam_date", "online_starts_at", "online_ends_at",
                    "online_duration_minutes", "updated_at",
                ])
                if validated is not None:
                    locked.questions.all().delete()
                    for i, (kind, prompt, marks, choices) in enumerate(validated):
                        question = ExamQuestion.objects.create(
                            exam=locked, kind=kind, prompt=prompt,
                            marks=marks, sort_order=i,
                        )
                        ExamChoice.objects.bulk_create([
                            ExamChoice(
                                question=question, text=text,
                                is_correct=correct, sort_order=j,
                            )
                            for j, (text, correct) in enumerate(choices)
                        ])
        except IntegrityError:
            return _bad("An exam with this title already exists for this section.")
        exam.refresh_from_db()
        return Response({"message": "Exam draft saved.", "exam": _exam_data(exam)})


class TeacherOnlineExamOpenAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, exam_id):
        exam = _teacher_exam(request.user, exam_id)
        if not exam:
            return _bad("Online exam not found.", 404)
        if exam.attempts.exists():
            return _bad("Exam with attempts cannot be released or modified.")
        if not exam.online_starts_at or not exam.online_ends_at:
            return _bad("Set a valid exam schedule first.")
        if exam.online_ends_at <= timezone.now():
            return _bad("This exam window has already ended.")
        questions = exam.questions.prefetch_related("choices").all()
        if not questions:
            return _bad("Add at least one question before opening the exam.")
        for q in questions:
            if q.is_objective and sum(int(o.is_correct) for o in q.choices.all()) != 1:
                return _bad("Every objective question needs exactly one correct answer.")
        exam.online_is_open = True
        exam.save(update_fields=["online_is_open", "updated_at"])
        return Response({"message": "Exam released to eligible students."})


class StudentOnlineExamListAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "results"

    def get(self, request):
        enrollment = get_active_student_enrollment(request.user)
        if not enrollment:
            return _bad("Active student enrollment required.", 403)
        exams = Exam.objects.filter(
            organization=request.user.organization,
            section=enrollment.section,
            online_is_open=True,
            online_teacher_assignment__isnull=False,
        ).select_related(
            "online_teacher_assignment__subject",
            "online_teacher_assignment__section__classroom",
        ).prefetch_related("questions").order_by("-online_starts_at")
        attempts = {
            a.exam_id: a
            for a in ExamAttempt.objects.filter(
                student=enrollment.student, exam__in=exams
            ).select_related("exam")
        }
        return Response({"exams": [
            {**_exam_data(exam), "attempt": _visible_attempt(attempts[exam.id])
             if exam.id in attempts else None}
            for exam in exams
            if student_studies_subject(
                enrollment.student, exam.online_teacher_assignment.subject
            )
        ]})


class StudentOnlineExamDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "results"

    def get(self, request, exam_id):
        exam, enrollment = _student_exam(request.user, exam_id)
        if not exam:
            return _bad("Online exam not available.", 404)
        attempt = ExamAttempt.objects.filter(
            exam=exam, student=enrollment.student
        ).first()
        if attempt and attempt.state == ExamAttempt.State.IN_PROGRESS:
            with transaction.atomic():
                attempt = ExamAttempt.objects.select_for_update().get(pk=attempt.pk)
                if timezone.now() >= _attempt_deadline(attempt):
                    _finalize(attempt)
        data = {"exam": _exam_data(exam), "attempt": (
            _visible_attempt(attempt) if attempt else None
        )}
        if attempt and attempt.state == ExamAttempt.State.IN_PROGRESS:
            answers = {a.question_id: a for a in attempt.answers.all()}
            data["questions"] = [
                _serialize_question(q, answer=answers.get(q.pk))
                for q in exam.questions.prefetch_related("choices").all()
            ]
        return Response(data)


class StudentOnlineExamStartAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "results"

    def post(self, request, exam_id):
        exam, enrollment = _student_exam(request.user, exam_id)
        if not exam:
            return _bad("Online exam not available.", 404)
        now = timezone.now()
        if not exam.online_starts_at <= now < exam.online_ends_at:
            return _bad("This exam is not currently open for attempts.")
        try:
            with transaction.atomic():
                attempt, _ = ExamAttempt.objects.get_or_create(
                    exam=exam, student=enrollment.student,
                )
                attempt = ExamAttempt.objects.select_for_update().get(pk=attempt.pk)
                if attempt.state == ExamAttempt.State.IN_PROGRESS and now >= _attempt_deadline(attempt):
                    _finalize(attempt)
        except IntegrityError:
            return _bad("Try again; an exam attempt already exists.", 409)
        if attempt.state != ExamAttempt.State.IN_PROGRESS:
            return _bad("You have already submitted this exam.", 409)
        return Response({
            "exam": _exam_data(exam),
            "attempt": _visible_attempt(attempt),
            "questions": [
                _serialize_question(q)
                for q in exam.questions.prefetch_related("choices").all()
            ],
        })


class StudentOnlineExamAnswerAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "results"

    def put(self, request, exam_id, question_id):
        exam, enrollment = _student_exam(request.user, exam_id)
        if not exam:
            return _bad("Online exam not available.", 404)
        with transaction.atomic():
            attempt = ExamAttempt.objects.select_for_update().filter(
                exam=exam, student=enrollment.student
            ).first()
            if not attempt:
                return _bad("Start your exam before answering.", 409)
            if attempt.state != ExamAttempt.State.IN_PROGRESS:
                return _bad("This attempt has already been submitted.", 409)
            if timezone.now() >= _attempt_deadline(attempt):
                _finalize(attempt)
                return _bad("Exam time expired. Answers were submitted.", 409)
            question = ExamQuestion.objects.filter(
                pk=question_id, exam=exam
            ).first()
            if not question:
                return _bad("Question not found.", 404)
            answer, _ = ExamAnswer.objects.get_or_create(
                attempt=attempt, question=question
            )
            if question.is_objective:
                try:
                    choice_id = int(request.data.get("choice_id"))
                except (TypeError, ValueError):
                    return _bad("Select a valid answer.")
                choice = ExamChoice.objects.filter(
                    pk=choice_id, question=question
                ).first()
                if not choice:
                    return _bad("Select a valid answer.")
                answer.selected_choice = choice
                answer.text_answer = ""
            else:
                content = request.data.get("text_answer")
                if not isinstance(content, str) or len(content) > 50000:
                    return _bad("Answer must be text under 50,000 characters.")
                answer.text_answer = content
                answer.selected_choice = None
            answer.save()
        return Response({"message": "Answer saved."})


class StudentOnlineExamSubmitAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "results"

    def post(self, request, exam_id):
        exam, enrollment = _student_exam(request.user, exam_id)
        if not exam:
            return _bad("Online exam not available.", 404)
        with transaction.atomic():
            attempt = ExamAttempt.objects.select_for_update().filter(
                exam=exam, student=enrollment.student
            ).first()
            if not attempt:
                return _bad("Start your exam first.", 409)
            _finalize(attempt)
        return Response({"attempt": _visible_attempt(attempt)})


class TeacherOnlineExamAttemptsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, exam_id):
        exam = _teacher_exam(request.user, exam_id)
        if not exam:
            return _bad("Online exam not found.", 404)
        attempts = ExamAttempt.objects.filter(
            exam=exam, student__user__organization=request.user.organization
        ).select_related("student__user", "exam").prefetch_related(
            "answers__question", "answers__selected_choice"
        ).order_by("student__user__username")
        data = []
        for a in attempts:
            if a.state == ExamAttempt.State.IN_PROGRESS and timezone.now() >= _attempt_deadline(a):
                with transaction.atomic():
                    locked = ExamAttempt.objects.select_for_update().get(pk=a.pk)
                    _finalize(locked)
                    a = locked
            answers = {answer.question_id: answer for answer in a.answers.all()}
            data.append({
                "student_id": a.student_id,
                "student_name": a.student.user.get_full_name().strip() or a.student.user.username,
                "username": a.student.user.username,
                "attempt": _visible_attempt(a, teacher=True),
                "questions": [
                    _serialize_question(q, teacher=True, answer=answers.get(q.id))
                    for q in exam.questions.prefetch_related("choices").all()
                ],
            })
        return Response({"exam": _exam_data(exam), "students": data})


class TeacherOnlineExamGradeAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, exam_id, attempt_id, question_id):
        exam = _teacher_exam(request.user, exam_id)
        if not exam:
            return _bad("Online exam not found.", 404)
        if exam.is_published:
            return _bad("Unpublish results before changing marks.")
        try:
            marks = Decimal(str(request.data.get("marks")))
            if not marks.is_finite():
                raise InvalidOperation
        except (InvalidOperation, TypeError, ValueError):
            return _bad("Enter valid marks.")
        feedback = request.data.get("feedback", "")
        if not isinstance(feedback, str) or len(feedback) > 10000:
            return _bad("Feedback cannot exceed 10,000 characters.")
        with transaction.atomic():
            attempt = ExamAttempt.objects.select_for_update().filter(
                pk=attempt_id, exam=exam,
                student__user__organization=request.user.organization,
            ).first()
            if not attempt:
                return _bad("Attempt not found.", 404)
            if attempt.state == ExamAttempt.State.IN_PROGRESS and timezone.now() >= _attempt_deadline(attempt):
                _finalize(attempt)
            if attempt.state == ExamAttempt.State.IN_PROGRESS:
                return _bad("Student has not submitted the exam.")
            question = ExamQuestion.objects.filter(
                pk=question_id, exam=exam,
                kind__in=[ExamQuestion.Kind.SHORT_ANSWER, ExamQuestion.Kind.LONG_ANSWER],
            ).first()
            if not question:
                return _bad("Subjective question not found.", 404)
            if marks < 0 or marks > question.marks:
                return _bad("Marks must be between zero and the question maximum.")
            answer, _ = ExamAnswer.objects.get_or_create(
                attempt=attempt, question=question
            )
            answer.awarded_marks = marks.quantize(Decimal("0.01"))
            answer.feedback = feedback.strip()
            answer.graded_at = timezone.now()
            answer.save()
            subjective_answers = {
                a.question_id: a
                for a in attempt.answers.select_related("question").filter(
                    question__kind__in=[
                        ExamQuestion.Kind.SHORT_ANSWER, ExamQuestion.Kind.LONG_ANSWER,
                    ]
                )
            }
            subjective_ids = set(exam.questions.filter(
                kind__in=[ExamQuestion.Kind.SHORT_ANSWER, ExamQuestion.Kind.LONG_ANSWER]
            ).values_list("id", flat=True))
            graded_ids = {
                id for id, a in subjective_answers.items() if a.awarded_marks is not None
            }
            attempt.subjective_marks = sum(
                (a.awarded_marks for a in subjective_answers.values()
                 if a.awarded_marks is not None),
                Decimal("0.00"),
            )
            attempt.state = (
                ExamAttempt.State.GRADED if graded_ids == subjective_ids
                else ExamAttempt.State.SUBMITTED
            )
            attempt.save(update_fields=["subjective_marks", "state"])
            _sync_complete_result(attempt)
        return Response({
            "message": "Marks saved.",
            "attempt": _visible_attempt(attempt, teacher=True),
        })
