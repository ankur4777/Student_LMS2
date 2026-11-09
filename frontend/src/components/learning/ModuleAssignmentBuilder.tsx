"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Role = "teacher" | "college_admin";
type Assignment = {
  id: number; title: string; instructions: string; passing_percent: number;
  max_attempts: number; is_published: boolean; submission_count: number;
};
type Submission = {
  id: number; student_name: string; answer_text: string; has_file: boolean;
  attempt_number: number; score_percent: number | null;
  feedback: string; graded_at: string | null;
};
type View = "all" | "pending" | "graded";
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export default function ModuleAssignmentBuilder({ moduleId, role }: {
  moduleId: number; role: Role;
}) {
  const root = `${BASE}/api/recorded-courses/learning/manage/`;
  const url = `${root}modules/${moduleId}/assignment/`;
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [title, setTitle] = useState("Module Assignment");
  const [instructions, setInstructions] = useState("");
  const [pass, setPass] = useState(60);
  const [attempts, setAttempts] = useState(3);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [view, setView] = useState<View>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const call = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = localStorage.getItem(
      role === "teacher" ? "teacher_access_token" : "college_admin_access_token"
    );
    if (!token) throw new Error("Please log in again.");
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.detail || "Assignment request failed.");
    }
    return response;
  }, [role]);

  const reload = useCallback(async () => {
    const payload = await (await call(url)).json();
    const next: Assignment | null = payload.assignment || null;
    let nextSubmissions: Submission[] = [];
    if (next) {
      const response = await (await call(`${url}submissions/`)).json();
      nextSubmissions = Array.isArray(response.submissions) ? response.submissions : [];
    }
    setAssignment(next);
    setSubmissions(nextSubmissions);
    if (next) {
      setTitle(next.title);
      setInstructions(next.instructions);
      setPass(next.passing_percent);
      setAttempts(next.max_attempts);
    }
  }, [call, url]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void reload().catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load module assignments.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [reload]);

  async function run(action: () => Promise<void>) {
    if (busy || loading) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function manualRefresh() {
    await run(async () => {
      await reload();
      setNotice("Assignment and grading status refreshed.");
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      await call(url, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, instructions, passing_percent: pass, max_attempts: attempts }),
      });
      setNotice("Assignment draft saved.");
      try { await reload(); }
      catch { setNotice("Assignment draft saved, but the list did not refresh. Use Refresh submissions."); }
    });
  }

  async function toggle() {
    if (!assignment) return;
    await run(async () => {
      await call(url, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: !assignment.is_published }),
      });
      setAssignment(previous => previous
        ? { ...previous, is_published: !previous.is_published } : previous);
      setNotice("Assignment publication updated.");
      try { await reload(); }
      catch { setNotice("Publication saved, but the list did not refresh. Use Refresh submissions."); }
    });
  }

  async function grade(submission: Submission) {
    if (busy || loading || submission.graded_at) return;
    const raw = scores[submission.id] || "";
    const gradeValue = Number(raw);
    if (!raw.trim() || !Number.isInteger(gradeValue) || gradeValue < 0 || gradeValue > 100) {
      setError("Enter an integer grade from 0–100.");
      return;
    }
    await run(async () => {
      const response = await call(`${root}submissions/${submission.id}/grade/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score_percent: gradeValue, feedback: feedback[submission.id] || "" }),
      });
      const body = await response.json().catch(() => ({}));
      const saved = body.submission as Submission | undefined;
      // The accepted PATCH is authoritative, even if the follow-up GET fails.
      setSubmissions(previous => previous.map(item => item.id === submission.id
        ? {
          ...item, score_percent: saved?.score_percent ?? gradeValue,
          feedback: saved?.feedback ?? feedback[submission.id] ?? "",
          graded_at: saved?.graded_at || new Date().toISOString(),
        }
        : item));
      setNotice("Grade saved. The student can check their grading status.");
      try {
        const latest = await (await call(`${url}submissions/`)).json();
        if (Array.isArray(latest.submissions)) setSubmissions(latest.submissions);
      } catch {
        setNotice("Grade saved, but the submissions list could not refresh. Use Refresh submissions.");
      }
    });
  }

  async function download(id: number) {
    await run(async () => {
      const response = await call(`${root}submissions/${id}/download/`);
      const blob = await response.blob();
      const src = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = src;
      link.download = `assignment-${id}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(src), 30000);
    });
  }

  const pendingCount = submissions.filter(submission => !submission.graded_at).length;
  const gradedCount = submissions.length - pendingCount;
  const visibleSubmissions = useMemo(() => submissions.filter(submission => {
    if (view === "pending") return !submission.graded_at;
    if (view === "graded") return Boolean(submission.graded_at);
    return true;
  }), [submissions, view]);
  const locked = Boolean(assignment && (assignment.is_published || assignment.submission_count > 0));

  return (
    <section className="border rounded-3 p-3 mt-4" aria-label="Module assignments">
      <h5 className="h6 fw-bold">Module Assignment {assignment
        ? (assignment.is_published ? "· Published" : "· Draft") : ""}</h5>
      <p className="small text-muted">
        Students submit work after viewing lessons. Assigned teachers and College Admins can grade submissions.
      </p>
      {error && <div className="alert alert-danger" role="alert">
        <span>{error}</span>
        {!assignment && (
          <button className="btn btn-outline-danger btn-sm ms-2" type="button"
            disabled={busy || loading} onClick={() => void manualRefresh()}>
            Retry loading assignments
          </button>
        )}
      </div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {loading ? <p className="small text-muted" role="status">Loading assignment submissions...</p> : (
        <>
          <form onSubmit={event => void save(event)} className="row g-2 mb-3">
            <label className="col-md-6">Title
              <input className="form-control" required maxLength={180} disabled={busy || locked}
                value={title} onChange={event => setTitle(event.target.value)} />
            </label>
            <label className="col-md-3">Pass mark (%)
              <input className="form-control" type="number" min={1} max={100} disabled={busy || locked}
                value={pass} onChange={event => setPass(Number(event.target.value))} />
            </label>
            <label className="col-md-3">Max attempts
              <input className="form-control" type="number" min={1} max={10} disabled={busy || locked}
                value={attempts} onChange={event => setAttempts(Number(event.target.value))} />
            </label>
            <label className="col-12">Instructions
              <textarea className="form-control" required rows={3} maxLength={12000}
                disabled={busy || locked} value={instructions}
                onChange={event => setInstructions(event.target.value)} />
            </label>
            <div className="col-12 d-flex flex-wrap gap-2">
              <button type="submit" className="btn btn-outline-primary btn-sm" disabled={busy || locked}>
                Save assignment
              </button>
              {assignment && role === "college_admin" && (
                <button type="button" className="btn btn-primary btn-sm"
                  disabled={busy || assignment.submission_count > 0} onClick={() => void toggle()}>
                  {assignment.is_published ? "Unpublish" : "Publish"}
                </button>
              )}
            </div>
          </form>

          {assignment && (
            <div className="border-top pt-3">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div>
                  <h6 className="mb-1">Student submissions ({submissions.length})</h6>
                  <span className="small text-muted" aria-label="Submission grading counts">
                    Pending: {pendingCount} · Graded: {gradedCount}
                  </span>
                </div>
                <div className="d-flex gap-2 flex-wrap align-items-center">
                  <label className="small mb-0" htmlFor={`assignment-grade-filter-${moduleId}`}>Show</label>
                  <select id={`assignment-grade-filter-${moduleId}`} className="form-select form-select-sm"
                    style={{ width: "auto" }} value={view}
                    onChange={event => setView(event.target.value as View)}>
                    <option value="all">All submissions</option>
                    <option value="pending">Pending grading</option>
                    <option value="graded">Graded submissions</option>
                  </select>
                  <button type="button" className="btn btn-outline-secondary btn-sm"
                    disabled={busy || loading} onClick={() => void manualRefresh()}>
                    Refresh submissions
                  </button>
                </div>
              </div>

              {submissions.length === 0 && (
                <p className="small text-muted">No student assignment submissions yet.</p>
              )}
              {submissions.length > 0 && visibleSubmissions.length === 0 && (
                <p className="small text-muted" role="status">No submissions match this grading filter.</p>
              )}
              {visibleSubmissions.map(submission => (
                <article className="border rounded-3 p-3 mb-2" key={submission.id}
                  aria-label={`Submission ${submission.id} by ${submission.student_name}`}>
                  <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                    <strong>{submission.student_name} · Attempt {submission.attempt_number}</strong>
                    <span className={`badge ${submission.graded_at ? "bg-success" : "bg-warning text-dark"}`}>
                      {submission.graded_at ? "Graded" : "Pending grading"}
                    </span>
                  </div>
                  <p className="small mb-2 mt-2" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {submission.answer_text || "File submission"}
                  </p>
                  {submission.has_file && (
                    <button type="button" className="btn btn-link btn-sm p-0 mb-2"
                      disabled={busy} onClick={() => void download(submission.id)}>
                      Download attachment
                    </button>
                  )}
                  {submission.graded_at ? (
                    <p className="small mb-0">Grade: {submission.score_percent}% · {submission.feedback || "No written feedback"}</p>
                  ) : (
                    <div className="row g-2">
                      <label className="col-md-3">Grade 0–100
                        <input type="number" min={0} max={100} step={1} className="form-control"
                          disabled={busy} value={scores[submission.id] ?? ""}
                          onChange={event => setScores(previous => ({
                            ...previous, [submission.id]: event.target.value,
                          }))} />
                      </label>
                      <label className="col-md-6">Feedback
                        <input maxLength={5000} className="form-control" disabled={busy}
                          value={feedback[submission.id] ?? ""}
                          onChange={event => setFeedback(previous => ({
                            ...previous, [submission.id]: event.target.value,
                          }))} />
                      </label>
                      <div className="col-md-3 align-self-end">
                        <button type="button" className="btn btn-primary btn-sm" disabled={busy}
                          onClick={() => void grade(submission)}>Grade</button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
