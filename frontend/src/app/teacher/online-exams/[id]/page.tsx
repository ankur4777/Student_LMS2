"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";
import "../../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
type Kind = "mcq" | "true_false" | "short" | "long";
type Choice = { text: string; is_correct: boolean };
type DraftQuestion = { kind: Kind; prompt: string; marks: string; choices: Choice[] };
type Exam = {
  id: number; title: string; subject: string; classroom: string; section: string;
  starts_at: string; ends_at: string; duration_minutes: number;
  available_to_students: boolean; result_published: boolean;
  total_marks: string; question_count: number;
};
type Question = DraftQuestion & {
  id: number; answer?: { text_answer: string; selected_choice_id: number | null;
    awarded_marks: string | null; feedback: string };
  choices: (Choice & { id: number })[];
};
type Attempt = {
  id: number; state: string; objective_marks: string; objective_maximum: string;
  subjective_marks: string | null; subjective_maximum: string;
  overall_marks: string | null; overall_maximum: string;
  overall_percentage: number | null;
};
type StudentAttempt = {
  student_id: number; student_name: string; username: string;
  attempt: Attempt; questions: Question[];
};
const isObjective = (kind: Kind) => kind === "mcq" || kind === "true_false";
const choicesFor = (kind: Kind): Choice[] =>
  kind === "true_false" ? [
    { text: "True", is_correct: true }, { text: "False", is_correct: false },
  ] : kind === "mcq" ? [
    { text: "", is_correct: true },
    { text: "", is_correct: false },
    { text: "", is_correct: false },
    { text: "", is_correct: false },
  ] : [];
const fresh = (kind: Kind = "mcq"): DraftQuestion => ({
  kind, prompt: "", marks: "1", choices: choicesFor(kind),
});

export default function TeacherOnlineExamManagePage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const [teacher, setTeacher] = useState<Record<string, string>>({});
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [students, setStudents] = useState<StudentAttempt[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<"questions" | "grading">("questions");
  const [draftDirty, setDraftDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [grades, setGrades] = useState<Record<string, { marks: string; feedback: string }>>({});

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = localStorage.getItem("teacher_access_token");
    if (!token) {
      router.replace("/teacher/login");
      throw new Error("Unauthorized");
    }
    const response = await fetch(`${API_BASE}/api/results/teacher/online-exams/${id}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
    });
    if (response.status === 401) {
      router.replace("/teacher/login");
      throw new Error("Unauthorized");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Request failed.");
    return data;
  }, [id, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, attemptList] = await Promise.all([
        request(""), request("attempts/"),
      ]);
      setExam(detail.exam);
      setQuestions((detail.questions || []).map((q: Question) => ({
        kind: q.kind, prompt: q.prompt, marks: String(q.marks),
        choices: q.choices.map(c => ({ text: c.text, is_correct: c.is_correct })),
      })));
      setStudents(attemptList.students || []);
      setDraftDirty(false);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    try { setTeacher(JSON.parse(localStorage.getItem("teacher_user") || "{}")); }
    catch { setTeacher({}); }
    void load();
  }, [load]);

  const updateQuestion = (index: number, next: DraftQuestion) => {
    setQuestions(items => items.map((old, i) => i === index ? next : old));
    setDraftDirty(true);
  };

  const runAction = async (task: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(""); setMessage("");
    try {
      await task();
      setMessage(success);
      await load();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message);
    } finally { setBusy(false); }
  };

  const saveQuestions = () => runAction(
    () => request("", {
      method: "PATCH",
      body: JSON.stringify({ questions: questions.map(q => ({
        kind: q.kind, prompt: q.prompt, marks: q.marks, choices: q.choices,
      })) }),
    }),
    "Question paper saved as a draft."
  );
  const releaseExam = () => runAction(
    () => request("open/", { method: "POST" }),
    "Exam released. Students can start only during the scheduled time window."
  );
  const publishResult = (value: boolean) => runAction(async () => {
    const token = localStorage.getItem("teacher_access_token");
    const res = await fetch(
      `${API_BASE}/api/results/teacher/exams/${id}/publish/`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: value }),
      }
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail || "Publication failed.");
    return body;
  }, value ? "Final results published." : "Results unpublished.");

  const saveGrade = (attemptId: number, questionId: number) => {
    const key = `${attemptId}:${questionId}`;
    const grade = grades[key];
    if (!grade || grade.marks.trim() === "") {
      setError("Enter subjective marks before saving.");
      return;
    }
    return runAction(
      () => request(`attempts/${attemptId}/questions/${questionId}/grade/`, {
        method: "PATCH",
        body: JSON.stringify({ marks: grade.marks, feedback: grade.feedback }),
      }), "Subjective marks saved."
    );
  };

  const activeStudent = students.find(item => item.student_id === selected) || students[0];
  const canEdit = !!exam && !exam.available_to_students && students.length === 0;

  return (
    <div className="teacher-dashboard">
      <TeacherSidebar />
      <main className="teacher-dashboard-main">
        <TeacherTopbar name={teacher.name || teacher.username || "Teacher"} organization={teacher.organization || ""} />
        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <Link href="/teacher/online-exams" className="d-inline-block mb-3">← All Online Exams</Link>
            <div className="d-flex justify-content-between gap-3 align-items-start flex-wrap mb-4">
              <div>
                <h2 className="fw-bold mb-1">{exam?.title || "Online Exam"}</h2>
                <p className="text-muted mb-0">{exam ? `${exam.classroom} / ${exam.section} · ${exam.subject}` : "Loading..."}</p>
              </div>
              <div className="d-flex align-items-center gap-2">
                {exam && <span className={`badge ${exam.result_published ? "bg-success" : exam.available_to_students ? "bg-primary" : "bg-secondary"}`}>
                  {exam.result_published ? "Final Results Published" : exam.available_to_students ? "Released" : "Draft"}
                </span>}
              </div>
            </div>
            {error && <div className="alert alert-danger">{error}</div>}
            {message && <div className="alert alert-success">{message}</div>}
            {loading ? <p className="text-muted">Loading exam...</p> : exam && (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <div className="row g-3">
                      <div className="col-md-3"><div className="text-muted small">Questions</div><div className="fw-bold">{exam.question_count}</div></div>
                      <div className="col-md-3"><div className="text-muted small">Total Marks</div><div className="fw-bold">{exam.total_marks}</div></div>
                      <div className="col-md-3"><div className="text-muted small">Start</div><div className="fw-semibold">{new Date(exam.starts_at).toLocaleString()}</div></div>
                      <div className="col-md-3"><div className="text-muted small">End</div><div className="fw-semibold">{new Date(exam.ends_at).toLocaleString()}</div></div>
                    </div>
                  </div>
                </div>
                <div className="d-flex gap-2 flex-wrap mb-3">
                  <button className={`btn ${tab === "questions" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTab("questions")}>Question Paper</button>
                  <button className={`btn ${tab === "grading" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTab("grading")}>Student Submissions & Grading ({students.length})</button>
                </div>
                {tab === "questions" ? (
                  <div className="card border-0 shadow-sm">
                    <div className="card-body p-4">
                      {!canEdit && <div className="alert alert-info">Question paper is locked after release or the first attempt.</div>}
                      {questions.map((q, index) => (
                        <div className="border rounded-3 p-3 mb-3" key={index}>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <strong>Question {index + 1}</strong>
                            {canEdit && <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => { setQuestions(items => items.filter((_, i) => i !== index)); setDraftDirty(true); }}>Remove</button>}
                          </div>
                          <div className="row g-3 mb-3">
                            <div className="col-md-7">
                              <label className="form-label">Question Type</label>
                              <select className="form-select" disabled={!canEdit} value={q.kind} onChange={e => {
                                const kind = e.target.value as Kind;
                                updateQuestion(index, { ...q, kind, choices: choicesFor(kind) });
                              }}>
                                <option value="mcq">Multiple Choice</option>
                                <option value="true_false">True / False</option>
                                <option value="short">Short Answer</option>
                                <option value="long">Long Answer</option>
                              </select>
                            </div>
                            <div className="col-md-5">
                              <label className="form-label">Marks</label>
                              <input className="form-control" type="number" min=".01" step=".01" disabled={!canEdit} value={q.marks} onChange={e => updateQuestion(index, { ...q, marks: e.target.value })} />
                            </div>
                          </div>
                          <label className="form-label">Question Text</label>
                          <textarea className="form-control mb-3" rows={2} disabled={!canEdit} value={q.prompt} onChange={e => updateQuestion(index, { ...q, prompt: e.target.value })} />
                          {isObjective(q.kind) && (
                            <div>
                              <div className="text-muted small mb-2">Select the correct answer (this will never be shown to students during the exam).</div>
                              {q.choices.map((choice, choiceIndex) => (
                                <div className="d-flex align-items-center gap-2 mb-2" key={choiceIndex}>
                                  <input
                                    type="radio"
                                    name={`correct-${index}`}
                                    checked={choice.is_correct}
                                    disabled={!canEdit}
                                    aria-label={`Correct answer for question ${index + 1}, option ${choiceIndex + 1}`}
                                    onChange={() => updateQuestion(index, {
                                      ...q, choices: q.choices.map((o, j) => ({ ...o, is_correct: j === choiceIndex })),
                                    })}
                                  />
                                  <input
                                    className="form-control" value={choice.text}
                                    disabled={!canEdit || q.kind === "true_false"}
                                    aria-label={`Option ${choiceIndex + 1}`}
                                    onChange={e => updateQuestion(index, {
                                      ...q, choices: q.choices.map((o, j) => j === choiceIndex ? { ...o, text: e.target.value } : o),
                                    })}
                                  />
                                  {canEdit && q.kind === "mcq" && q.choices.length > 2 && (
                                    <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => {
                                      const next = q.choices.filter((_, j) => j !== choiceIndex);
                                      if (!next.some(o => o.is_correct)) next[0].is_correct = true;
                                      updateQuestion(index, { ...q, choices: next });
                                    }}>×</button>
                                  )}
                                </div>
                              ))}
                              {canEdit && q.kind === "mcq" && q.choices.length < 8 && (
                                <button type="button" className="btn btn-outline-secondary btn-sm mt-1" onClick={() => updateQuestion(index, {
                                  ...q, choices: [...q.choices, { text: "", is_correct: false }],
                                })}>+ Add Option</button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {questions.length === 0 && <p className="text-muted">No questions yet. Add your first question.</p>}
                      <div className="d-flex align-items-center flex-wrap gap-2">
                        {canEdit && <button type="button" className="btn btn-outline-primary" onClick={() => {
                          setQuestions(items => [...items, fresh()]); setDraftDirty(true);
                        }}>+ Add Question</button>}
                        {canEdit && <button type="button" className="btn btn-primary" disabled={busy || !draftDirty || questions.length === 0} onClick={() => void saveQuestions()}>{busy ? "Saving..." : "Save Draft Questions"}</button>}
                        {canEdit && <button type="button" className="btn btn-success" disabled={busy || questions.length === 0 || draftDirty} onClick={() => void releaseExam()}>Release Exam to Students</button>}
                      </div>
                      {canEdit && <p className="form-text mt-3 mb-0">Save your questions before releasing. Once released, the question paper cannot be edited.</p>}
                    </div>
                  </div>
                ) : (
                  <div className="card border-0 shadow-sm">
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between gap-3 align-items-start flex-wrap mb-3">
                        <div><h5 className="fw-bold mb-1">Evaluate Subjective Answers</h5><p className="text-muted mb-0">Objective marks are calculated automatically. Final results require your approval.</p></div>
                        <button
                          className="btn btn-success" type="button" disabled={busy || students.length === 0 || students.some(s => s.attempt.state !== "graded")}
                          onClick={() => void publishResult(!exam.result_published)}
                        >{exam.result_published ? "Unpublish Results" : "Publish Final Results"}</button>
                      </div>
                      {students.length === 0 ? <p className="text-muted">No students have started this exam yet.</p> : (
                        <div className="row g-4">
                          <div className="col-lg-4">
                            <div className="list-group">
                              {students.map(s => (
                                <button key={s.student_id} className={`list-group-item list-group-item-action ${activeStudent?.student_id === s.student_id ? "active" : ""}`}
                                  onClick={() => setSelected(s.student_id)}>
                                  <span className="fw-semibold">{s.student_name}</span><br />
                                  <small>{s.username} · {s.attempt.state.replace("_", " ")}</small>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="col-lg-8">
                            {activeStudent && (
                              <>
                                <h5>{activeStudent.student_name}</h5>
                                <p className="text-muted">
                                  Objective: {activeStudent.attempt.objective_marks || "–"} / {activeStudent.attempt.objective_maximum} ·
                                  Subjective: {activeStudent.attempt.subjective_marks ?? "Pending"} / {activeStudent.attempt.subjective_maximum}
                                </p>
                                {activeStudent.questions.filter(q => !isObjective(q.kind)).map(q => {
                                  const key = `${activeStudent.attempt.id}:${q.id}`;
                                  const savedGrade = grades[key] || {
                                    marks: q.answer?.awarded_marks ?? "",
                                    feedback: q.answer?.feedback ?? "",
                                  };
                                  return (
                                    <div className="border rounded-3 p-3 mb-3" key={q.id}>
                                      <div className="fw-semibold">{q.prompt} <span className="text-muted">({q.marks} marks)</span></div>
                                      <div className="bg-light rounded-2 p-3 my-3" style={{whiteSpace:"pre-wrap"}}>{q.answer?.text_answer || "No answer submitted"}</div>
                                      <div className="row g-2">
                                        <div className="col-sm-4">
                                          <label className="form-label">Marks awarded</label>
                                          <input type="number" className="form-control" min={0} max={q.marks} step=".01" disabled={exam.result_published || activeStudent.attempt.state === "in_progress"} value={savedGrade.marks}
                                            onChange={e => setGrades(prev => ({ ...prev, [key]: { ...savedGrade, marks: e.target.value } }))} />
                                        </div>
                                        <div className="col-sm-8">
                                          <label className="form-label">Feedback</label>
                                          <input className="form-control" disabled={exam.result_published || activeStudent.attempt.state === "in_progress"} value={savedGrade.feedback}
                                            onChange={e => setGrades(prev => ({ ...prev, [key]: { ...savedGrade, feedback: e.target.value } }))} />
                                        </div>
                                      </div>
                                      {!exam.result_published && <button className="btn btn-primary btn-sm mt-3" disabled={busy || activeStudent.attempt.state === "in_progress"} onClick={() => void saveGrade(activeStudent.attempt.id, q.id)}>Save Marks</button>}
                                    </div>
                                  );
                                })}
                                {activeStudent.questions.every(q => isObjective(q.kind)) && <p className="text-muted">This exam contains only objective questions. Nothing to grade manually.</p>}
                                {activeStudent.attempt.overall_marks !== null && <div className="alert alert-info">Calculated total: {activeStudent.attempt.overall_marks} / {activeStudent.attempt.overall_maximum} ({activeStudent.attempt.overall_percentage}%). {exam.result_published ? "Published" : "Not yet published"}</div>}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      <button type="button" className="btn btn-outline-secondary btn-sm mt-3" onClick={() => void load()}>Refresh Submissions</button>
                    </div>
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
