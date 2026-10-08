"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import StudentFeatureRestricted, { isClassFeatureRestricted } from "@/components/student/StudentFeatureRestricted";
import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
type Attempt = {
  state: "in_progress" | "submitted" | "graded";
  objective_marks: string | null;
  objective_maximum: string;
  objective_percentage: number | null;
  subjective_maximum: string;
  overall_marks: string | null;
  overall_maximum: string;
  overall_percentage: number | null;
  result_published: boolean;
};
type Exam = {
  id: number; title: string; subject: string; classroom: string; section: string;
  starts_at: string; ends_at: string; duration_minutes: number;
  total_marks: string; question_count: number;
  result_published: boolean; attempt: Attempt | null;
};

export default function StudentOnlineExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [student, setStudent] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("student_access_token");
    if (!token) { router.replace("/student/login"); return; }
    try { setStudent(JSON.parse(localStorage.getItem("student_user") || "{}")); }
    catch { setStudent({}); }
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/results/student/online-exams/`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (response.status === 401) { router.replace("/student/login"); return; }
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Unable to load exams.");
        setExams(result.exams || []);
      } catch (err) { setError(err instanceof Error ? err.message : "Unable to load exams."); }
      finally { setLoading(false); }
    };
    void load();
  }, [router]);

  return (
    <div className="student-dashboard">
      <StudentSidebar />
      <main className="student-dashboard-main">
        <StudentTopbar name={student.name || student.username || "Student"} />
        <div className="student-dashboard-content">
          <div className="container-fluid">
            {isClassFeatureRestricted(error) ? <StudentFeatureRestricted featureName="Results" /> : (
              <>
                <div className="mb-4">
                  <h2 className="fw-bold mb-1">Online Exams</h2>
                  <p className="text-muted mb-0">Take your scheduled exams and see objective marks instantly after submission. Final marks require teacher publication.</p>
                </div>
                {error && <div className="alert alert-danger">{error}</div>}
                {loading ? <div className="card border-0 shadow-sm p-4">Loading online exams...</div> : exams.length === 0 ? (
                  <div className="card border-0 shadow-sm p-4 text-muted">No online exams are currently available for your class and subjects.</div>
                ) : (
                  <div className="row g-3">
                    {exams.map(exam => {
                      const now = Date.now();
                      const start = new Date(exam.starts_at).getTime();
                      const end = new Date(exam.ends_at).getTime();
                      const inWindow = now >= start && now < end;
                      const state = exam.attempt?.state;
                      const submitted = state === "submitted" || state === "graded";
                      return (
                        <div className="col-lg-6" key={exam.id}>
                          <article className="card border-0 shadow-sm h-100">
                            <div className="card-body p-4">
                              <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                                <div>
                                  <h5 className="fw-bold mb-1">{exam.title}</h5>
                                  <div className="text-muted">{exam.subject} · {exam.classroom} / {exam.section}</div>
                                </div>
                                <span className={`badge ${submitted ? "bg-success" : inWindow ? "bg-primary" : "bg-secondary"}`}>
                                  {submitted ? "Submitted" : inWindow ? "Active" : now < start ? "Scheduled" : "Closed"}
                                </span>
                              </div>
                              <div className="row g-2 small text-muted mb-3">
                                <div className="col-sm-6">Starts: {new Date(exam.starts_at).toLocaleString()}</div>
                                <div className="col-sm-6">Ends: {new Date(exam.ends_at).toLocaleString()}</div>
                                <div className="col-sm-6">Questions: {exam.question_count}</div>
                                <div className="col-sm-6">Duration: {exam.duration_minutes} min</div>
                              </div>
                              {submitted && exam.attempt && (
                                <div className="border rounded-3 bg-light p-3 mb-3">
                                  <div className="fw-semibold">Objective score: {exam.attempt.objective_marks} / {exam.attempt.objective_maximum}</div>
                                  <div className="text-muted small">{exam.attempt.objective_percentage === null ? "No objective questions" : `${exam.attempt.objective_percentage}% objective percentage`}</div>
                                  <div className="mt-2">
                                    {exam.attempt.overall_percentage !== null ? (
                                      <strong>Final result: {exam.attempt.overall_marks} / {exam.attempt.overall_maximum} ({exam.attempt.overall_percentage}%)</strong>
                                    ) : <span className="text-muted">Final result pending teacher evaluation / publication</span>}
                                  </div>
                                </div>
                              )}
                              <Link href={`/student/online-exams/${exam.id}`} className={`btn ${inWindow || submitted ? "btn-primary" : "btn-outline-secondary"}`}>
                                {submitted ? "View Results" : state === "in_progress" ? "Continue Exam" : inWindow ? "Start Exam" : "View Exam"}
                              </Link>
                            </div>
                          </article>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
