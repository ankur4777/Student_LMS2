"""Single source of truth for sequential published-module access."""
from .models import (
    CourseModule, LessonLearningProgress, ModuleQuiz, ModuleQuizAttempt,
    ModuleAssignment, ModuleAssignmentSubmission,
)


def completion_status(module, student):
    """A module requires videos, its published quiz and published assignment."""
    lessons = module.lessons.filter(is_active=True)
    total = lessons.count()
    watched = LessonLearningProgress.objects.filter(
        student=student, lesson__in=lessons, completed_at__isnull=False,
    ).count()
    quiz = ModuleQuiz.objects.filter(module=module, is_published=True).first()
    quiz_passed = (quiz is None or ModuleQuizAttempt.objects.filter(
        quiz=quiz, student=student, passed=True,
    ).exists())
    assignment = ModuleAssignment.objects.filter(module=module, is_published=True).first()
    assignment_passed = (assignment is None or ModuleAssignmentSubmission.objects.filter(
        assignment=assignment, student=student,
        graded_at__isnull=False, score_percent__gte=assignment.passing_percent,
    ).exists())
    return {
        "completed": total > 0 and watched == total and quiz_passed and assignment_passed,
        "completed_lessons": watched, "total_lessons": total,
        "quiz_passed": quiz_passed, "assignment_passed": assignment_passed,
    }


def module_access_map(course, student):
    """Only published modules count toward progression; no client-side bypass."""
    modules = list(CourseModule.objects.filter(
        course=course, is_published=True,
    ).order_by("position", "pk"))
    available = True
    output = {}
    for module in modules:
        state = completion_status(module, student)
        output[module.pk] = {"unlocked": available, **state}
        available = available and state["completed"]
    return output


def is_module_unlocked(module, student):
    return module_access_map(module.course, student).get(
        module.pk, {},
    ).get("unlocked", False)
