"use client";

import type { AssignmentSummary } from "@/components/learning/StudentModuleAssignment";
import type { FinalExamSummary } from "@/components/learning/StudentFinalExam";
import type { QuizSummary } from "@/components/learning/StudentModuleQuiz";

type ModuleProgress = {
  id: number;
  title: string;
  locked: boolean;
  completed: boolean;
  total_lessons: number;
  completed_lessons: number;
  quiz: QuizSummary | null;
  assignment: AssignmentSummary | null;
};
type CourseProgress = {
  modules: ModuleProgress[];
  total_lessons: number;
  completed_lessons: number;
  final_exam: FinalExamSummary | null;
};

function nextLearningStep(course: CourseProgress): string {
  if (course.modules.length === 0) {
    return "Your teacher has not published any modules yet.";
  }

  const current = course.modules.find(module => !module.locked && !module.completed);
  if (current) {
    if (current.total_lessons === 0) {
      return `No active lectures are available in ${current.title} yet. Check with your teacher.`;
    }
    if (current.completed_lessons < current.total_lessons) {
      return `Watch the remaining lectures in ${current.title}.`;
    }
    if (current.quiz && !current.quiz.passed) {
      return `Pass the required quiz in ${current.title}.`;
    }
    if (current.assignment && !current.assignment.passed) {
      return current.assignment.pending_review
        ? `Your assignment in ${current.title} is awaiting teacher grading.`
        : `Submit and pass the assignment in ${current.title}.`;
    }
    return `Refresh the progress for ${current.title} after its requirements are checked.`;
  }
  if (course.modules.some(module => !module.completed)) {
    return "Complete the preceding module to unlock the next one.";
  }

  const final = course.final_exam;
  if (!final) return "All modules are complete. The final exam has not been published yet.";
  if (final.passed) {
    return final.certificate_id
      ? "Your certificate is available in the Final Examination section."
      : "You passed the final exam, but no active certificate is available. Contact your College Admin.";
  }
  if (!final.unlocked) return "All modules appear complete. Refresh your progress to check final exam access.";
  if (final.attempts_remaining <= 0) return "No final exam attempts remain. Contact your College Admin.";
  return "Take the unlocked final examination to qualify for your certificate.";
}

export default function StudentLearningMilestones({ course }: { course: CourseProgress }) {
  const modulesComplete = course.modules.filter(module => module.completed).length;
  const final = course.final_exam;
  const activeCertificate = Boolean(final?.certificate_id);

  const moduleText = course.modules.length === 0
    ? "No published modules"
    : `${modulesComplete} of ${course.modules.length} completed`;
  const examText = !final
    ? "Not published"
    : final.passed
      ? "Passed"
      : final.unlocked
        ? final.attempts_remaining > 0 ? "Ready to attempt" : "No attempts remaining"
        : "Locked";
  const certificateText = activeCertificate
    ? "Available"
    : final?.passed ? "Not currently available" : "Not yet issued";

  return (
    <section className="card border-0 shadow-sm my-4" aria-label="Learning milestones and certification">
      <div className="card-body p-4">
        <h2 className="h5 fw-bold mb-1">Learning milestones & certificate</h2>
        <p className="small text-muted mb-3">
          Lecture viewing alone does not earn a certificate. Modules also require any
          published quizzes and assignments; certification requires passing the final exam.
        </p>
        <div className="row g-3" aria-label="Certification progress">
          <div className="col-sm-6 col-lg-3">
            <div className="border rounded-3 p-3 h-100">
              <div className="small text-muted">Lecture progress</div>
              <strong>{course.completed_lessons} of {course.total_lessons} viewed</strong>
            </div>
          </div>
          <div className="col-sm-6 col-lg-3">
            <div className="border rounded-3 p-3 h-100">
              <div className="small text-muted">Completed modules</div>
              <strong>{moduleText}</strong>
            </div>
          </div>
          <div className="col-sm-6 col-lg-3">
            <div className="border rounded-3 p-3 h-100">
              <div className="small text-muted">Final examination</div>
              <strong>{examText}</strong>
            </div>
          </div>
          <div className="col-sm-6 col-lg-3">
            <div className="border rounded-3 p-3 h-100">
              <div className="small text-muted">Certificate</div>
              <strong>{certificateText}</strong>
            </div>
          </div>
        </div>
        <p className="mb-0 mt-3 small" role="status">
          <strong>Next step:</strong> {nextLearningStep(course)}
        </p>
        {final?.passed && final.certificate_id && (
          <a className="btn btn-outline-primary btn-sm mt-3" href="#student-final-exam">
            Go to your certificate
          </a>
        )}
        {final && !final.passed && final.unlocked && final.attempts_remaining > 0 && (
          <a className="btn btn-outline-primary btn-sm mt-3" href="#student-final-exam">
            Go to final exam
          </a>
        )}
      </div>
    </section>
  );
}
