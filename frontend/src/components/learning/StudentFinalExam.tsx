"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

export type FinalExamSummary = {
  id: number;
  title: string;
  passing_percent: number;
  max_attempts: number;
  attempts_used: number;
  attempts_remaining: number;
  passed: boolean;
  unlocked: boolean;
  required_modules: number;
  best_score_percent: number | null;
  certificate_id: string | null;
};
type Question = { id: number; prompt: string; choices: { index: number; text: string }[] };
type ExamResponse = { exam: FinalExamSummary; questions?: Question[] };
type ExamAttempt = { score_percent: number; passed: boolean };
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

function serverError(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

export default function StudentFinalExam({ courseId, summary, onUpdated }: {
  courseId: number;
  summary: FinalExamSummary;
  onUpdated?: () => void;
}) {
  const url = `${BASE}/api/recorded-courses/learning/student/courses/${courseId}/final-exam/`;
  const [status, setStatus] = useState<FinalExamSummary>(summary);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ExamAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [reloadIndex, setReloadIndex] = useState(0);
  // A confirmed POST must not be mislabeled as a failed attempt when the
  // parent refresh also triggers a failing GET.
  const acceptedAttemptNeedsRefresh = useRef(false);
  useEffect(() => { acceptedAttemptNeedsRefresh.current = false; }, [courseId]);

  const load = useCallback(async (signal?: AbortSignal): Promise<ExamResponse> => {
    const token = localStorage.getItem("student_access_token");
    if (!token) throw new Error("Please log in again.");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal,
    });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(serverError(payload, "Final exam unavailable."));
    if (!payload || typeof payload !== "object" || !("exam" in payload) ||
        !(payload as ExamResponse).exam) {
      throw new Error("The final exam response is incomplete. Please retry.");
    }
    return payload as ExamResponse;
  }, [url]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    setStatus(summary);
    setQuestions([]);
    setAnswers({});
    void load(controller.signal).then(body => {
      if (controller.signal.aborted) return;
      setStatus(body.exam);
      setQuestions(Array.isArray(body.questions) ? body.questions : []);
      acceptedAttemptNeedsRefresh.current = false;
    }).catch(cause => {
      if (!controller.signal.aborted) {
        setLoadError(acceptedAttemptNeedsRefresh.current
          ? "Your attempt was recorded, but the exam could not refresh. Retry loading exam status before attempting again."
          : cause instanceof Error ? cause.message : "Unable to load the final examination.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [load, summary.id, summary.unlocked, summary.attempts_used, summary.passed, summary.certificate_id, reloadIndex]);

  const fullyAnswered = questions.length > 0 &&
    questions.every(question => answers[String(question.id)] !== undefined);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || loadError || !status.unlocked || status.passed ||
        status.attempts_remaining <= 0 || !fullyAnswered) return;
    const token = localStorage.getItem("student_access_token");
    if (!token) {
      setActionError("Please log in again.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answers }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(serverError(payload, "Could not submit exam."));
      if (!payload || typeof payload !== "object" || !("exam" in payload) || !("attempt" in payload)) {
        throw new Error("Exam submission response was incomplete. Refresh the exam before trying again.");
      }
      const saved = payload as { exam: FinalExamSummary; attempt: ExamAttempt };
      setStatus(saved.exam);
      acceptedAttemptNeedsRefresh.current = true;
      setResult(saved.attempt);
      setAnswers({});
      setQuestions([]);
      // POST success is authoritative. A later GET failure is a refresh
      // problem, not a rejected attempt; never ask students to submit again.
      onUpdated?.();
      try {
        const latest = await load();
        setStatus(latest.exam);
        setQuestions(Array.isArray(latest.questions) ? latest.questions : []);
        acceptedAttemptNeedsRefresh.current = false;
      } catch {
        setLoadError("Your attempt was recorded, but the exam could not refresh. Retry loading exam status before attempting again.");
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Exam submission failed.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!status.certificate_id || busy || loading || loadError) return;
    const token = localStorage.getItem("student_access_token");
    if (!token) {
      setActionError("Please log in again.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch(
        `${BASE}/api/recorded-courses/learning/student/certificates/${encodeURIComponent(status.certificate_id)}/pdf/`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      if (!response.ok) throw new Error("Unable to download your certificate.");
      const blob = await response.blob();
      const objectURL = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectURL;
      link.download = "MySLS-Course-Certificate.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectURL), 30000);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Certificate download failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="student-final-exam" className="card border-0 shadow-sm mt-4" aria-label="Final course examination">
      <div className="card-body p-4">
        <div className="d-flex gap-3 align-items-center">
          <i className="bi bi-award fs-2 text-danger" aria-hidden="true" />
          <div>
            <h2 className="h5 fw-bold mb-1">{status.title}</h2>
            <p className="small text-muted mb-0">
              Pass mark {status.passing_percent}% · {status.attempts_used}/{status.max_attempts} attempts · {status.required_modules} modules
            </p>
          </div>
        </div>

        {actionError && <p className="alert alert-danger mt-3" role="alert">{actionError}</p>}
        {result && (
          <p className={`alert mt-3 ${result.passed ? "alert-success" : "alert-warning"}`} role="status">
            Latest recorded exam score: {result.score_percent}% — {result.passed ? "Passed" : "Not passed"}.
          </p>
        )}

        {loading ? (
          <p className="text-muted mt-3" role="status">Checking your final exam status...</p>
        ) : loadError ? (
          <div className="alert alert-warning mt-3" role="alert">
            <p className="mb-2">{loadError}</p>
            <button type="button" className="btn btn-outline-primary btn-sm"
              onClick={() => setReloadIndex(index => index + 1)}>
              Retry loading final exam
            </button>
          </div>
        ) : status.passed ? (
          <div className="alert alert-success mt-3">
            <strong>Final examination passed!</strong> Best score: {status.best_score_percent}%.
            {status.certificate_id ? (
              <div className="d-flex gap-2 flex-wrap mt-3">
                <button className="btn btn-primary btn-sm" type="button"
                  disabled={busy} onClick={() => void download()}>
                  {busy ? "Downloading..." : "Download PDF certificate"}
                </button>
                <a href={`/verify/certificate/${encodeURIComponent(status.certificate_id)}`}
                  className="btn btn-outline-secondary btn-sm" target="_blank" rel="noopener noreferrer">
                  Verify certificate
                </a>
              </div>
            ) : (
              <p className="small mb-0 mt-2">No active certificate is currently available. Contact your College Admin.</p>
            )}
          </div>
        ) : !status.unlocked ? (
          <p className="small mt-3 text-muted">
            Complete all published modules, including required quizzes and graded assignments, to unlock this examination.
          </p>
        ) : status.attempts_remaining <= 0 ? (
          <p className="alert alert-warning mt-3">No exam attempts remaining. Please contact your College Admin.</p>
        ) : (
          <>
            <p className="small text-muted mt-3 mb-2" role="status">
              {status.attempts_remaining} exam {status.attempts_remaining === 1 ? "attempt" : "attempts"} remaining.
              Answer all {questions.length} questions before submitting.
            </p>
            {questions.length === 0 ? (
              <p className="alert alert-warning">
                No exam questions are available. Ask your College Admin to review the published exam.
              </p>
            ) : (
              <form onSubmit={event => void submit(event)} className="d-grid gap-3 mt-3">
                {questions.map((question, index) => (
                  <fieldset className="border-0 p-0 m-0" key={question.id} disabled={busy}>
                    <legend className="h6 fw-semibold">{index + 1}. {question.prompt}</legend>
                    {question.choices.map(choice => (
                      <label className="d-flex align-items-start gap-2 mb-2 small" key={choice.index}>
                        <input type="radio"
                          name={`final-${courseId}-q-${question.id}`}
                          checked={answers[String(question.id)] === choice.index}
                          onChange={() => setAnswers(previous => ({
                            ...previous, [String(question.id)]: choice.index,
                          }))} />
                        <span>{choice.text}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
                <button type="submit" className="btn btn-primary" disabled={busy || !fullyAnswered}>
                  {busy ? "Submitting..." : "Submit Final Exam"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </section>
  );
}
