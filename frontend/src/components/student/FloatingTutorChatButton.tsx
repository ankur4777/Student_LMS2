"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const HIDDEN_ROUTES = /^\/student\/(?:login|forgot-password|reset-password|ai-assistant)(?:\/|$)/;

type ChatMode = "dashboard" | "tutor";
type Subject = { id: number; name: string; code: string };
type TutorContext = {
  student: { name: string; classroom: string; section: string };
  subjects: Subject[];
};
type StudentHelpLink = {
  label: string;
  href: "/student/profile" | "/student/forgot-password";
};

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  mode: ChatMode;
  subjectId: number | null;
  links?: StudentHelpLink[];
};

function RobotTutorIcon() {
  return (
    <svg viewBox="0 0 64 64" width="48" height="48" fill="none" aria-hidden="true">
      {/* Graduation cap */}
      <path d="M12 20 32 10l20 10-20 10-20-10Z" fill="#FFE4A5" stroke="#FFF" strokeWidth="2" strokeLinejoin="round" />
      <path d="M23 26v5c5 4 13 4 18 0v-5" stroke="#FFF0C9" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M48 22v11" stroke="#FFE4A5" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="48" cy="35" r="2.5" fill="#FFE4A5" />
      {/* Robot head and ears */}
      <rect x="9" y="37" width="8" height="12" rx="4" fill="#FFE4A5" />
      <rect x="47" y="37" width="8" height="12" rx="4" fill="#FFE4A5" />
      <rect x="14" y="30" width="36" height="25" rx="9" fill="#FFF" />
      <rect x="19" y="34" width="26" height="15" rx="6" fill="#FCE7EA" />
      <circle cx="26" cy="41" r="3" fill="#D92D3D" />
      <circle cx="38" cy="41" r="3" fill="#D92D3D" />
      <path d="M27 48q5 4 10 0" stroke="#D92D3D" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}


export default function FloatingTutorChatButton() {
  const pathname = usePathname();
  const hiddenRoute = HIDDEN_ROUTES.test(pathname);
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<TutorContext | null>(null);
  const [mode, setMode] = useState<ChatMode>("tutor");
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextMessageId = useRef(1);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setEnabled(false);
    setOpen(false);
    setMessages([]);
    setContext(null);

    if (hiddenRoute) return () => {
      active = false;
      controller.abort();
    };

    const loadAccess = async () => {
      const token = localStorage.getItem("student_access_token");
      if (!token) {
        if (active) {
          setEnabled(false);
          setOpen(false);
          setMessages([]);
        }
        return;
      }
      try {
        const response = await fetch(
          `${API_BASE}/api/academics/student/feature-access/`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const data = response.ok ? await response.json() : null;
        if (!active) return;
        const allowed = response.ok && data?.features?.ai_assistant === true;
        setEnabled(allowed);
        if (!allowed) {
          setOpen(false);
          setMessages([]);
          setContext(null);
        }
      } catch {
        if (active) setEnabled(false);
      }
    };

    const recheck = () => {
      if (document.visibilityState === "visible") void loadAccess();
    };
    void loadAccess();
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("storage", loadAccess);

    return () => {
      active = false;
      controller.abort();
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("storage", loadAccess);
    };
  }, [hiddenRoute, pathname]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, open]);

  useEffect(() => {
    if (open && context) inputRef.current?.focus();
  }, [open, context]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  const toggleChat = async () => {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    setError("");
    setLoadingContext(true);

    const token = localStorage.getItem("student_access_token");
    if (!token) {
      setOpen(false);
      setEnabled(false);
      setLoadingContext(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/ai-assistant/context/`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setEnabled(false);
          setOpen(false);
          setMessages([]);
          return;
        }
        throw new Error(data.detail || "Unable to load your learning subjects.");
      }
      setContext(data as TutorContext);
      setSubjectId((current) => {
        const valid = (data.subjects as Subject[]).some((s) => s.id === current);
        return valid ? current : (data.subjects[0]?.id ?? null);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect to the LMS.");
    } finally {
      setLoadingContext(false);
    }
  };

  const changeMode = (nextMode: ChatMode) => {
    if (busy) return;
    setMode(nextMode);
    setDraft("");
    setError("");
  };

  const changeSubject = (nextId: number) => {
    if (busy) return;
    setSubjectId(nextId);
    setMessages((current) => current.filter((item) => item.mode !== "tutor"));
    setError("");
  };

  const sendMessage = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const message = draft.trim();
    if (!context || !message || busy || loadingContext) return;
    if (mode === "tutor" && subjectId === null) {
      setError("Please select one of your enrolled subjects.");
      return;
    }

    const related = messages.filter(
      (item) => item.mode === mode && (
        mode === "dashboard" || item.subjectId === subjectId
      )
    );
    const history = related.slice(-8).map((item) => ({
      role: item.role,
      content: item.content,
    }));
    const studentMessage: ChatMessage = {
      id: nextMessageId.current++,
      role: "user",
      content: message,
      mode,
      subjectId: mode === "tutor" ? subjectId : null,
    };
    setMessages((items) => [...items, studentMessage]);
    setDraft("");
    setError("");
    setBusy(true);
    const token = localStorage.getItem("student_access_token");

    try {
      const response = await fetch(`${API_BASE}/api/ai-assistant/chat/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        body: JSON.stringify({
          message,
          history,
          mode,
          ...(mode === "tutor" ? { subject_id: subjectId } : {}),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setEnabled(false);
          setOpen(false);
          setMessages([]);
          setContext(null);
          return;
        }
        throw new Error(result.detail || "Could not get an AI response.");
      }
      setMessages((items) => [
        ...items,
        {
          id: nextMessageId.current++,
          role: "assistant",
          content: result.reply,
          links: Array.isArray(result.links)
            ? result.links.filter(
                (link: { label?: unknown; href?: unknown }): link is StudentHelpLink =>
                  typeof link.label === "string" &&
                  (link.href === "/student/profile" ||
                    link.href === "/student/forgot-password")
              )
            : undefined,
          mode,
          subjectId: mode === "tutor" ? subjectId : null,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!busy) void sendMessage();
    }
  };

  const visibleMessages = messages.filter(
    (item) => item.mode === mode && (
      mode === "dashboard" || item.subjectId === subjectId
    )
  );
  const selectedSubject = context?.subjects.find((item) => item.id === subjectId);

  if (hiddenRoute || !enabled) return null;

  return (
    <>
      {open && (
        <section
          id="student-ai-tutor-panel"
          className="student-tutor-chat-panel"
          role="dialog"
          aria-label="Student AI Tutor chat"
          aria-modal="false"
        >
          <header className="student-tutor-chat-header">
            <div className="student-tutor-chat-avatar"><RobotTutorIcon /></div>
            <div className="student-tutor-chat-heading">
              <strong>Your AI Tutor</strong>
              <span>Study help and personal LMS information</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="student-tutor-chat-close"
              aria-label="Close AI Tutor"
            >×</button>
          </header>

          <div className="student-tutor-chat-controls">
            <div className="student-tutor-chat-tabs" role="group" aria-label="Chat mode">
              <button type="button" className={mode === "tutor" ? "active" : ""}
                onClick={() => changeMode("tutor")} disabled={busy}>Subject Tutor</button>
              <button type="button" className={mode === "dashboard" ? "active" : ""}
                onClick={() => changeMode("dashboard")} disabled={busy}>My Dashboard</button>
            </div>
            {mode === "tutor" && (
              <label className="student-tutor-subject-label">
                Subject
                <select
                  value={subjectId ?? ""}
                  onChange={(event) => changeSubject(Number(event.target.value))}
                  disabled={busy || !context?.subjects.length}
                >
                  {context?.subjects.length ? context.subjects.map((subject) => (
                    <option value={subject.id} key={subject.id}>{subject.name}</option>
                  )) : <option value="">No enrolled subjects available</option>}
                </select>
              </label>
            )}
          </div>

          <div className="student-tutor-chat-messages" role="log" aria-live="polite" aria-relevant="additions">
            {loadingContext ? (
              <p className="student-tutor-chat-empty">Checking your student access...</p>
            ) : !visibleMessages.length ? (
              <div className="student-tutor-chat-welcome">
                <strong>Hi{context?.student.name ? `, ${context.student.name.split(" ")[0]}` : ""}! 👋</strong>
                <p>{mode === "tutor" ? (
                  selectedSubject
                    ? `Ask me anything about ${selectedSubject.name}. I can explain lessons and help you practice.`
                    : "Choose an enrolled subject to start learning."
                ) : "Ask about attendance, classes, assignments, results, fees, or account help such as resetting your password."}</p>
              </div>
            ) : null}
            {visibleMessages.map((item) => (
              <div
                key={item.id}
                className={`student-tutor-chat-message ${item.role === "user" ? "from-student" : "from-tutor"}`}
              >
                <span>{item.content}</span>
                {item.role === "assistant" && item.links?.length ? (
                  <nav className="student-tutor-chat-help-links" aria-label="LMS help links">
                    {item.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                      >
                        {link.label} →
                      </Link>
                    ))}
                  </nav>
                ) : null}
              </div>
            ))}
            {busy && <div className="student-tutor-chat-typing" role="status">Tutor is thinking...</div>}
            <div ref={bottomRef} />
          </div>

          {error && <p className="student-tutor-chat-error" role="alert">{error}</p>}
          <form className="student-tutor-chat-form" onSubmit={(event) => void sendMessage(event)}>
            <textarea
              ref={inputRef}
              rows={2}
              maxLength={1500}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onEditorKeyDown}
              disabled={busy || loadingContext || !context || (mode === "tutor" && !selectedSubject)}
              aria-label="Your message to AI Tutor"
              placeholder={mode === "tutor" ? "Ask a question about your subject..." : "Ask about your dashboard..."}
            />
            <button type="submit" disabled={
              busy || loadingContext || !context || !draft.trim() ||
              (mode === "tutor" && !selectedSubject)
            } aria-label="Send message">
              {busy ? "..." : "➤"}
            </button>
          </form>
          <p className="student-tutor-chat-disclaimer">
            AI can make mistakes. Official LMS records remain authoritative.
          </p>
        </section>
      )}
      <button
        type="button"
        className="student-floating-tutor"
        aria-label={open ? "Close AI Tutor" : "Open AI Tutor"}
        aria-controls="student-ai-tutor-panel"
        aria-expanded={open}
        onClick={() => void toggleChat()}
      >
        <span className="student-floating-tutor-tooltip" aria-hidden="true">
          {open ? "Close AI Tutor" : "Ask your AI Tutor"}
        </span>
        <span className="student-floating-tutor-orb">
          <RobotTutorIcon />
          <span className="student-floating-tutor-badge" aria-hidden="true">AI</span>
        </span>
      </button>
    </>
  );
}
