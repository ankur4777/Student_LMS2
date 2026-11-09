"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Submission = {
  score_percent: number | null; feedback: string; graded_at: string | null;
};
export type AssignmentSummary = {
  id: number; title: string; instructions: string; passing_percent: number;
  max_attempts: number; attempts_used: number; attempts_remaining: number;
  passed: boolean; unlocked: boolean; pending_review: boolean;
  latest_submission: Submission | null;
};
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export default function StudentModuleAssignment({ moduleId, summary, onUpdated }: {
  moduleId: number; summary: AssignmentSummary; onUpdated?: () => void;
}) {
  const url = `${BASE}/api/recorded-courses/learning/student/modules/${moduleId}/assignment/`;
  const [status, setStatus] = useState<AssignmentSummary>(summary);
  const [answer, setAnswer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const acceptedSubmissionNeedsRefresh = useRef(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadIndex, setReloadIndex] = useState(0);

  const load = useCallback(async (signal?: AbortSignal): Promise<AssignmentSummary> => {
    const token = localStorage.getItem("student_access_token");
    if (!token) throw new Error("Please sign in again.");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Assignment unavailable.");
    if (!data.assignment) throw new Error("Assignment status is incomplete.");
    return data.assignment as AssignmentSummary;
  }, [url]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    setStatus(previous => acceptedSubmissionNeedsRefresh.current &&
      previous.attempts_used >= summary.attempts_used ? previous : summary);
    void load(controller.signal).then(latest => {
      if (controller.signal.aborted) return;
      setStatus(latest);
      acceptedSubmissionNeedsRefresh.current = false;
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setLoadError(acceptedSubmissionNeedsRefresh.current
        ? "Your assignment was submitted, but grading status could not refresh. Retry checking your assignment status."
        : cause instanceof Error ? cause.message : "Assignment unavailable.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [load, summary.id, summary.unlocked, summary.attempts_used,
      summary.passed, summary.pending_review, summary.latest_submission?.graded_at, reloadIndex]);

  async function refreshGrading() {
    if (busy || loading) return;
    setLoading(true);
    setLoadError("");
    setActionError("");
    try {
      const latest = await load();
      setStatus(latest);
      acceptedSubmissionNeedsRefresh.current = false;
      onUpdated?.();
    } catch (cause) {
      setLoadError(acceptedSubmissionNeedsRefresh.current
        ? "Your assignment was submitted, but grading status could not refresh. Retry checking your assignment status."
        : cause instanceof Error ? cause.message : "Unable to refresh assignment status.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || loadError || status.passed || !status.unlocked ||
        status.pending_review || status.attempts_remaining <= 0 ||
        (!answer.trim() && !file)) return;
    if (file && file.size > MAX_FILE_SIZE) {
      setActionError("Attachment must not exceed 25 MB.");
      return;
    }
    const token = localStorage.getItem("student_access_token");
    if (!token) { setActionError("Please sign in again."); return; }

    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      const data = new FormData();
      if (answer.trim()) data.append("answer_text", answer.trim());
      if (file) data.append("file", file);
      const response = await fetch(url, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: data,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Submission failed.");
      if (!body.submission) {
        throw new Error("Submission status is unclear. Refresh before trying again.");
      }

      acceptedSubmissionNeedsRefresh.current = true;
      setStatus(previous => ({
        ...previous,
        attempts_used: previous.attempts_used + 1,
        attempts_remaining: Math.max(0, previous.attempts_remaining - 1),
        pending_review: true,
        latest_submission: {
          score_percent: null, feedback: "", graded_at: null,
        },
      }));
      setNotice("Assignment submitted for teacher review.");
      setAnswer("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      // A confirmed POST is never invalidated by a failed follow-up GET.
      onUpdated?.();
      try {
        const latest = await load();
        setStatus(latest);
        acceptedSubmissionNeedsRefresh.current = false;
      } catch {
        setLoadError("Your assignment was submitted, but grading status could not refresh. Retry checking your assignment status.");
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  const latest = status.latest_submission;
  return (
    <section className="border rounded-3 p-3 mt-3" aria-label="Module assignment">
      <h3 className="h6 fw-bold">{status.title}</h3>
      <p className="small" style={{ whiteSpace: "pre-wrap" }}>{status.instructions}</p>
      <p className="small text-muted">
        Pass mark {status.passing_percent}% · {status.attempts_used}/{status.max_attempts} attempts
      </p>
      {actionError && <div className="alert alert-danger" role="alert">{actionError}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {loading ? (
        <p className="small text-muted" role="status">Checking assignment status...</p>
      ) : loadError ? (
        <div className="alert alert-warning" role="alert">
          <p className="mb-2">{loadError}</p>
          <button className="btn btn-outline-primary btn-sm" type="button"
            onClick={() => setReloadIndex(index => index + 1)}>
            Retry loading assignment
          </button>
        </div>
      ) : (
        <>
          {latest?.graded_at && (
            <div className="alert alert-light border mt-2" role="status">
              <strong>Latest teacher grade: {latest.score_percent}%</strong>
              <div>{latest.feedback || "No written feedback was provided."}</div>
            </div>
          )}
          {status.passed ? (
            <p className="text-success small">Assignment passed.</p>
          ) : !status.unlocked ? (
            <p className="small text-muted">Watch every active lecture first.</p>
          ) : status.pending_review ? (
            <p className="small text-muted">Your submission is awaiting grading.</p>
          ) : !status.attempts_remaining ? (
            <p className="alert alert-warning">No attempts remaining. Contact your teacher.</p>
          ) : (
            <form onSubmit={event => void submit(event)} className="d-grid gap-2">
              <label>
                Written answer
                <textarea className="form-control" rows={3} maxLength={20000}
                  value={answer} onChange={event => setAnswer(event.target.value)} />
              </label>
              <label>
                Attachment (optional, max 25 MB)
                <input ref={fileInput} type="file" className="form-control"
                  accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                  onChange={event => setFile(event.target.files?.[0] || null)} />
              </label>
              <button className="btn btn-primary btn-sm" type="submit"
                disabled={busy || (!answer.trim() && !file) || Boolean(file && file.size > MAX_FILE_SIZE)}>
                {busy ? "Submitting..." : "Submit assignment"}
              </button>
              {file && file.size > MAX_FILE_SIZE && (
                <p className="small text-danger mb-0">Attachment must not exceed 25 MB.</p>
              )}
            </form>
          )}
          {(status.pending_review || Boolean(latest?.graded_at)) && (
            <button type="button" className="btn btn-outline-secondary btn-sm mt-2"
              disabled={busy || loading} onClick={() => void refreshGrading()}>
              Refresh grading status
            </button>
          )}
        </>
      )}
    </section>
  );
}
