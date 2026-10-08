"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import StudentFeatureRestricted, { isClassFeatureRestricted } from "@/components/student/StudentFeatureRestricted";
import "../../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
type Question = {
  id: number;
  kind: "mcq" | "true_false" | "short" | "long";
  prompt: string; marks: string;
  choices: { id: number; text: string }[];
  answer?: { selected_choice_id: number | null; text_answer: string };
};
type Exam = {
  id: number; title: string; subject: string; classroom: string; section: string;
  starts_at: string; ends_at: string; duration_minutes: number;
};
type Attempt = {
  id: number; state: "in_progress" | "submitted" | "graded";
  started_at: string; submitted_at: string | null; deadline: string;
  objective_marks: string | null; objective_maximum: string; objective_percentage: number | null;
  subjective_marks: string | null; subjective_maximum: string;
  result_published: boolean; overall_marks: string | null;
  overall_maximum: string; overall_percentage: number | null;
};
const isObjective = (kind: string) => kind === "mcq" || kind === "true_false";

export default function StudentOnlineExamPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [student, setStudent] = useState<Record<string,string>>({});
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number,string>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const submitRef = useRef(false);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = localStorage.getItem("student_access_token");
    if (!token) { router.replace("/student/login"); throw new Error("Unauthorized"); }
    const response = await fetch(`${API_BASE}/api/results/student/online-exams/${id}/${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (response.status === 401) { router.replace("/student/login"); throw new Error("Unauthorized"); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Unable to complete this action.");
    return data;
  }, [id, router]);

  const load = useCallback(async () => {
    const data = await request("");
    setExam(data.exam);
    setAttempt(data.attempt);
    setQuestions(data.questions || []);
    const restored: Record<number,string> = {};
    (data.questions || []).forEach((q: Question) => {
      restored[q.id] = isObjective(q.kind)
        ? q.answer?.selected_choice_id?.toString() || ""
        : q.answer?.text_answer || "";
    });
    setAnswers(restored);
    if (data.attempt?.state !== "in_progress") setRemaining(null);
  }, [request]);

  useEffect(() => {
    try { setStudent(JSON.parse(localStorage.getItem("student_user") || "{}")); }
    catch { setStudent({}); }
    const init = async () => {
      try { await load(); }
      catch (err) { if (err instanceof Error && err.message !== "Unauthorized") setError(err.message); }
      finally { setLoading(false); }
    };
    void init();
  }, [load]);

  const persist = useCallback(async (question: Question, value: string) => {
    if (!attempt || attempt.state !== "in_progress") return;
    if (isObjective(question.kind) && !value) return;
    setSaving(question.id);
    try {
      await request(`questions/${question.id}/answer/`, {
        method: "PUT",
        body: JSON.stringify(
          isObjective(question.kind)
            ? { choice_id: Number(value) }
            : { text_answer: value }
        ),
      });
      setNotice("Answer saved.");
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message);
      throw err;
    } finally { setSaving(null); }
  }, [attempt, request]);

  const start = async () => {
    setBusy(true); setError("");
    try {
      await request("start/", { method: "POST" });
      await load();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message);
    } finally { setBusy(false); }
  };

  const submit = useCallback(async (expired = false) => {
    if (submitRef.current) return;
    submitRef.current = true;
    setBusy(true); setError("");
    try {
      if (!expired) {
        // Flush unsaved typing before submission, including the focused text area.
        for (const question of questions) {
          const value = answers[question.id] || "";
          if (isObjective(question.kind) && !value) continue;
          await persist(question, value);
        }
      }
      const data = await request("submit/", { method: "POST" });
      setAttempt(data.attempt);
      setQuestions([]);
      setRemaining(null);
      setNotice("Exam submitted. Your objective score is available below.");
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message);
      try { await load(); } catch { /* show original error */ }
    } finally {
      setBusy(false);
      submitRef.current = false;
    }
  }, [answers, load, persist, questions, request]);

  useEffect(() => {
    if (attempt?.state !== "in_progress") return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil(
        (new Date(attempt.deadline).getTime() - Date.now()) / 1000
      ));
      setRemaining(seconds);
      if (seconds === 0 && !submitRef.current) void submit(true);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [attempt?.deadline, attempt?.state, submit]);

  const submitted = attempt?.state === "submitted" || attempt?.state === "graded";
  const displayRemaining = remaining === null ? "" :
    `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <div className="student-dashboard">
      <StudentSidebar />
      <main className="student-dashboard-main">
        <StudentTopbar name={student.name || student.username || "Student"} />
        <div className="student-dashboard-content">
          <div className="container-fluid">
            <Link href="/student/online-exams" className="d-inline-block mb-3">← All Online Exams</Link>
            {isClassFeatureRestricted(error) ? <StudentFeatureRestricted featureName="Results" /> : (
              <>
                <h2 className="fw-bold mb-1">{exam?.title || "Online Exam"}</h2>
                {exam && <p className="text-muted mb-3">{exam.subject} · {exam.classroom} / {exam.section}</p>}
                {error && <div className="alert alert-danger" role="alert">{error}</div>}
                {notice && <div className="alert alert-info">{notice}</div>}
                {loading ? <div className="card border-0 shadow-sm p-4">Loading your exam...</div> : exam && (
                  <>
                    <div className="card border-0 shadow-sm mb-4">
                      <div className="card-body p-4">
                        <div className="d-flex justify-content-between flex-wrap gap-3 align-items-center">
                          <div>
                            <div className="fw-bold">Exam window</div>
                            <div className="text-muted small">{new Date(exam.starts_at).toLocaleString()} – {new Date(exam.ends_at).toLocaleString()}</div>
                            <div className="text-muted small">Time limit: {exam.duration_minutes} minutes · One attempt per student</div>
                          </div>
                          {attempt?.state === "in_progress" ? (
                            <div className="text-end"><div className="text-muted small">Time remaining</div><strong className={remaining !== null && remaining < 120 ? "text-danger fs-4" : "fs-4"}>{displayRemaining}</strong></div>
                          ) : submitted ? <span className="badge bg-success">Submitted</span> : (
                            <button className="btn btn-primary" disabled={busy || Date.now() < new Date(exam.starts_at).getTime() || Date.now() >= new Date(exam.ends_at).getTime()} onClick={() => void start()}>
                              {busy ? "Starting..." : "Start Exam"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {!attempt && <div className="alert alert-info">Start the exam during its scheduled window to view and answer questions. The timer begins when you start.</div>}
                    {attempt?.state === "in_progress" && (
                      <>
                        {questions.map((q, index) => (
                          <section className="card border-0 shadow-sm mb-3" key={q.id}>
                            <div className="card-body p-4">
                              <div className="d-flex justify-content-between gap-2 mb-3">
                                <strong>Question {index + 1}</strong>
                                <span className="text-muted">{q.marks} marks</span>
                              </div>
                              <p style={{whiteSpace:"pre-wrap"}}>{q.prompt}</p>
                              {isObjective(q.kind) ? q.choices.map(choice => (
                                <label key={choice.id} className="d-flex align-items-center gap-2 border rounded-3 px-3 py-2 mb-2">
                                  <input type="radio" name={`question-${q.id}`} checked={answers[q.id] === String(choice.id)} value={choice.id}
                                    onChange={e => {
                                      setAnswers(current => ({ ...current, [q.id]: e.target.value }));
                                      setError(""); setNotice("");
                                      void persist(q, e.target.value).catch(() => {});
                                    }} />
                                  <span>{choice.text}</span>
                                </label>
                              )) : (
                                <textarea className="form-control" rows={q.kind === "long" ? 7 : 3}
                                  placeholder="Type your answer here"
                                  value={answers[q.id] || ""}
                                  onChange={e => { setAnswers(current => ({ ...current, [q.id]: e.target.value })); setNotice(""); }}
                                  onBlur={e => void persist(q, e.target.value).catch(() => {})}
                                />
                              )}
                              {saving === q.id && <div className="text-muted small mt-2">Saving answer...</div>}
                            </div>
                          </section>
                        ))}
                        <div className="card border-0 shadow-sm">
                          <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <span className="text-muted small">Check your answers before final submission. You cannot edit them afterward.</span>
                            <button className="btn btn-primary" disabled={busy} onClick={() => {
                              if (window.confirm("Submit your exam? You cannot change answers afterward.")) void submit();
                            }}>{busy ? "Submitting..." : "Submit Exam"}</button>
                          </div>
                        </div>
                      </>
                    )}
                    {submitted && attempt && (
                      <div className="card border-0 shadow-sm">
                        <div className="card-body p-4">
                          <h4 className="fw-bold">Your Exam Result</h4>
                          <div className="row g-3 mt-1">
                            <div className="col-md-6">
                              <div className="bg-light rounded-3 p-4 h-100">
                                <div className="text-muted">Objective Marks — Available Immediately</div>
                                <div className="fs-3 fw-bold text-success">{attempt.objective_marks} / {attempt.objective_maximum}</div>
                                <div className="text-success">{attempt.objective_percentage === null ? "No objective questions" : `${attempt.objective_percentage}% Objective Percentage`}</div>
                              </div>
                            </div>
                            <div className="col-md-6">
                              <div className="bg-light rounded-3 p-4 h-100">
                                <div className="text-muted">Subjective Marks</div>
                                <div className="fs-4 fw-semibold">{attempt.subjective_marks === null ? "Awaiting evaluation / publication" : `${attempt.subjective_marks} / ${attempt.subjective_maximum}`}</div>
                              </div>
                            </div>
                          </div>
                          <div className="border-top pt-4 mt-4">
                            {attempt.overall_percentage === null ? (
                              <div className="alert alert-warning mb-0">Final result not yet published. Your teacher will evaluate subjective answers and publish the overall marks and percentage.</div>
                            ) : (
                              <div className="alert alert-success mb-0"><strong>Final Result: {attempt.overall_marks} / {attempt.overall_maximum} — {attempt.overall_percentage}%</strong></div>
                            )}
                          </div>
                          <button className="btn btn-outline-primary mt-3" onClick={() => void load()}>Refresh Result</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
