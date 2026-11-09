"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

export type QuizSummary = {
  id: number; title: string; passing_percent: number; max_attempts: number;
  attempts_used: number; attempts_remaining: number; passed: boolean;
  best_score_percent: number | null; unlocked: boolean;
};
type Question = { id: number; prompt: string; choices: { index: number; text: string }[] };
type QuizResponse = { quiz: QuizSummary; questions?: Question[] };
type QuizAttempt = { score_percent: number; passed: boolean };
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export default function StudentModuleQuiz({ moduleId, summary, onUpdated }: {
  moduleId: number; summary: QuizSummary; onUpdated?: () => void;
}) {
  const url = `${BASE}/api/recorded-courses/learning/student/modules/${moduleId}/quiz/`;
  const [status, setStatus] = useState<QuizSummary>(summary);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [reloadIndex, setReloadIndex] = useState(0);
  const acceptedAttemptNeedsRefresh = useRef(false);

  const refresh = useCallback(async (signal?: AbortSignal): Promise<QuizResponse> => {
    const token = localStorage.getItem("student_access_token");
    if (!token) throw new Error("Please sign in again.");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || "Unable to load quiz.");
    if (!body.quiz) throw new Error("The quiz response was incomplete.");
    return body as QuizResponse;
  }, [url]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    // A course-level refresh can still have the old quiz attempt count.
    setStatus(previous => acceptedAttemptNeedsRefresh.current &&
      previous.attempts_used >= summary.attempts_used ? previous : summary);
    setQuestions([]);
    void refresh(controller.signal).then(body => {
      if (controller.signal.aborted) return;
      setStatus(body.quiz);
      setQuestions(Array.isArray(body.questions) ? body.questions : []);
      acceptedAttemptNeedsRefresh.current = false;
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setLoadError(acceptedAttemptNeedsRefresh.current
        ? "Your quiz attempt was recorded, but quiz status could not refresh. Retry loading the quiz before attempting again."
        : cause instanceof Error ? cause.message : "Unable to load quiz.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [refresh, summary.id, summary.unlocked, summary.attempts_used, summary.passed, reloadIndex]);

  const fullyAnswered = questions.length > 0 &&
    questions.every(question => answers[String(question.id)] !== undefined);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || loadError || !status.unlocked || status.passed ||
        status.attempts_remaining <= 0 || !fullyAnswered) return;
    const token = localStorage.getItem("student_access_token");
    if (!token) { setActionError("Please sign in again."); return; }
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
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Quiz submission failed.");
      if (!body.quiz || !body.attempt) {
        throw new Error("Quiz submission status is unclear. Refresh before trying again.");
      }
      acceptedAttemptNeedsRefresh.current = true;
      setStatus(body.quiz);
      setResult(body.attempt);
      setQuestions([]);
      setAnswers({});
      // A recorded attempt stays recorded even if the next GET fails.
      onUpdated?.();
      try {
        const latest = await refresh();
        setStatus(latest.quiz);
        setQuestions(Array.isArray(latest.questions) ? latest.questions : []);
        acceptedAttemptNeedsRefresh.current = false;
      } catch {
        setLoadError("Your quiz attempt was recorded, but quiz status could not refresh. Retry loading the quiz before attempting again.");
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Quiz submission failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="p-3 border rounded-3 mt-3" aria-label="Module quiz">
      <h3 className="h6 fw-bold">{status.title}</h3>
      <p className="small text-muted">
        Pass mark: {status.passing_percent}% · Attempts: {status.attempts_used}/{status.max_attempts}
      </p>
      {actionError && <div role="alert" className="alert alert-danger py-2">{actionError}</div>}
      {result && (
        <div className={`alert py-2 ${result.passed ? "alert-success" : "alert-warning"}`} role="status">
          Latest recorded quiz score: {result.score_percent}%. {result.passed ? "Passed." : "Review your notes before another attempt."}
        </div>
      )}
      {loading ? (
        <p className="small text-muted" role="status">Loading module quiz...</p>
      ) : loadError ? (
        <div className="alert alert-warning py-2" role="alert">
          <p className="mb-2">{loadError}</p>
          <button type="button" className="btn btn-outline-primary btn-sm"
            onClick={() => setReloadIndex(index => index + 1)}>
            Retry loading quiz
          </button>
        </div>
      ) : status.passed ? (
        <div className="alert alert-success py-2">Quiz passed! Best score: {status.best_score_percent}%</div>
      ) : !status.unlocked ? (
        <p className="small text-muted">Finish all active video lessons to unlock this quiz.</p>
      ) : status.attempts_remaining <= 0 ? (
        <div className="alert alert-warning py-2">No attempts remaining. Contact your teacher.</div>
      ) : (
        <>
          <p className="small text-muted" role="status">
            {status.attempts_remaining} {status.attempts_remaining === 1 ? "attempt" : "attempts"} remaining.
          </p>
          {questions.length === 0 ? (
            <p className="small text-muted">No quiz questions are currently available. Contact your teacher.</p>
          ) : (
            <form className="d-grid gap-3" onSubmit={event => void submit(event)}>
              {questions.map((question, index) => (
                <fieldset className="border-0 p-0 m-0" key={question.id} disabled={busy}>
                  <legend className="fs-6 fw-semibold">{index + 1}. {question.prompt}</legend>
                  {question.choices.map(choice => (
                    <label key={choice.index} className="d-flex align-items-start gap-2 small mb-2">
                      <input type="radio"
                        name={`quiz-${moduleId}-question-${question.id}`}
                        checked={answers[String(question.id)] === choice.index}
                        onChange={() => setAnswers(previous => ({
                          ...previous, [String(question.id)]: choice.index,
                        }))} />
                      <span>{choice.text}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !fullyAnswered}>
                {busy ? "Submitting..." : "Submit answers"}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
