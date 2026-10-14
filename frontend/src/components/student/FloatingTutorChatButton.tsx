"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * The Django API should return JSON. During a server error, Django or the
 * reverse proxy may instead return a text/html error page. Never parse that
 * as JSON or show its raw HTML to the student.
 */
async function readStudentApiJson(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("json")) {
    if (response.status >= 500) {
      throw new Error(
        `The Student LMS server returned HTTP ${response.status}. Check the Django terminal. If chat history was just added, run 'python manage.py migrate' against your local database.`
      );
    }
    if (response.status === 404) {
      throw new Error(
        "The Student LMS API endpoint was not found (HTTP 404). Verify NEXT_PUBLIC_API_BASE_URL and that the Django server is running."
      );
    }
    throw new Error(
      `The Student LMS returned an unexpected response (HTTP ${response.status}). Check the API URL and Django terminal.`
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Error(
      `The Student LMS API returned invalid JSON (HTTP ${response.status}). Check the Django server log.`
    );
  }
}

const HIDDEN_ROUTES = /^\/student\/(?:login|forgot-password|reset-password|ai-assistant)(?:\/|$)/;

type ChatMode = "dashboard" | "tutor";
type Subject = { id: number; name: string; code: string };
type TutorContext = {
  student: { name: string; classroom: string; section: string };
  subjects: Subject[];
};
type StudentHelpLink = {
  label: string;
  href: string;
};

const SAFE_STUDENT_CHAT_LINKS = new Set([
  "/student/profile",
  "/student/forgot-password",
  "/student/recorded-classes",
  "/student/recorded-courses",
  "/student/online-exams",
  "/student/results",
  "/student/attendance",
  "/student/assignments",
  "/student/classes",
  "/student/documents",
  "/student/fees",
  "/student/notifications",
  "/student/dashboard",
]);

type ChatConversation = {
  id: string;
  title: string;
  mode: ChatMode;
  subject_id: number | null;
  subject_name: string | null;
  updated_at: string;
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
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const newChatSelected = useRef(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextMessageId = useRef(-1);

  // A saved Dashboard chat deliberately has no subject_id. When students
  // switch to Subject Tutor, the browser's <select> visually shows its first
  // option even if the controlled value is still null. Resolve the active
  // subject from the *authorized* context for display, input and API calls.
  const selectedSubjectId =
    context?.subjects.find((subject) => subject.id === subjectId)?.id ??
    context?.subjects[0]?.id ??
    null;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setEnabled(false);
    setOpen(false);
    setMessages([]);
    setContext(null);
    setActiveConversationId(null);
    setConversations([]);
    newChatSelected.current = false;

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
          setActiveConversationId(null);
          setConversations([]);
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
        const data = response.ok ? await readStudentApiJson(response) : null;
        if (!active) return;
        const allowed = response.ok && data?.features?.ai_assistant === true;
        setEnabled(allowed);
        if (!allowed) {
          setOpen(false);
          setMessages([]);
          setContext(null);
          setConversations([]);
          setActiveConversationId(null);
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

  const refreshConversations = async (token: string) => {
    const response = await fetch(`${API_BASE}/api/ai-assistant/conversations/`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await readStudentApiJson(response);
    if (!response.ok) throw new Error(data.detail || "Unable to load chat history.");
    const rows = (data.conversations ?? []) as ChatConversation[];
    setConversations(rows);
    return rows;
  };

  const loadConversation = async (id: string, token: string) => {
    const response = await fetch(
      `${API_BASE}/api/ai-assistant/conversations/${id}/`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    const data = await readStudentApiJson(response);
    if (!response.ok) throw new Error(data.detail || "Chat is no longer available.");
    const chat = data.conversation as ChatConversation;
    setActiveConversationId(chat.id);
    setMode(chat.mode);
    setSubjectId(chat.subject_id);
    setMessages(
      (data.messages as ChatMessage[]).map((message) => ({
        ...message,
        mode: chat.mode,
        subjectId: chat.subject_id,
        links: message.links?.filter((link) => SAFE_STUDENT_CHAT_LINKS.has(link.href)),
      }))
    );
    setShowHistory(false);
    newChatSelected.current = false;
  };

  const startNewChat = () => {
    if (busy || loadingContext) return;
    setActiveConversationId(null);
    setMessages([]);
    setDraft("");
    setError("");
    setShowHistory(false);
    newChatSelected.current = true;
  };

  const selectPreviousChat = async (id: string) => {
    if (busy || loadingContext) return;
    const token = localStorage.getItem("student_access_token");
    if (!token) return;
    setError("");
    setLoadingContext(true);
    try {
      await loadConversation(id, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open this chat.");
    } finally {
      setLoadingContext(false);
    }
  };

  const toggleChat = async () => {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    setError("");
    setLoadingContext(true);
    setShowHistory(false);
    setMessages([]);

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
      const data = await readStudentApiJson(response);
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
      const recent = await refreshConversations(token);
      if (!newChatSelected.current && recent.length) {
        const selected = recent.some((item) => item.id === activeConversationId)
          ? activeConversationId
          : recent[0].id;
        if (selected) await loadConversation(selected, token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect to the LMS.");
    } finally {
      setLoadingContext(false);
    }
  };

  const changeMode = (nextMode: ChatMode) => {
    if (busy || loadingContext || nextMode === mode) return;
    if (nextMode === "tutor") {
      setSubjectId(selectedSubjectId);
    }
    setMode(nextMode);
    startNewChat();
  };

  const changeSubject = (nextId: number) => {
    if (busy || loadingContext || nextId === selectedSubjectId) return;
    setSubjectId(nextId);
    startNewChat();
  };

  const sendMessage = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const message = draft.trim();
    if (!context || !message || busy || loadingContext) return;
    if (mode === "tutor" && selectedSubjectId === null) {
      setError("Please select one of your enrolled subjects.");
      return;
    }

    const studentMessage: ChatMessage = {
      id: nextMessageId.current--,
      role: "user",
      content: message,
      mode,
      subjectId: mode === "tutor" ? selectedSubjectId : null,
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
          mode,
          ...(activeConversationId ? { conversation_id: activeConversationId } : {}),
          ...(mode === "tutor" ? { subject_id: selectedSubjectId } : {}),
        }),
      });

      const result = await readStudentApiJson(response);
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
      setActiveConversationId(result.conversation_id);
      newChatSelected.current = false;
      setMessages((items) => [
        ...items,
        {
          id: nextMessageId.current--,
          role: "assistant",
          content: result.reply,
          links: Array.isArray(result.links)
            ? result.links.filter(
                (link: { label?: unknown; href?: unknown }): link is StudentHelpLink =>
                  typeof link.label === "string" &&
                  typeof link.href === "string" &&
                  SAFE_STUDENT_CHAT_LINKS.has(link.href)
              )
            : undefined,
          mode,
          subjectId: mode === "tutor" ? selectedSubjectId : null,
        },
      ]);
      try {
        if (token) await refreshConversations(token);
      } catch {
        // The answer was saved even if reloading the chat index failed.
      }
    } catch (err) {
      setMessages((items) => items.filter((item) => item.id !== studentMessage.id));
      setDraft(message);
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
      mode === "dashboard" || item.subjectId === selectedSubjectId
    )
  );
  const selectedSubject = context?.subjects.find((item) => item.id === selectedSubjectId);

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
            <div className="student-tutor-chat-header-actions">
              <button type="button" className="student-tutor-chat-header-button"
                onClick={() => setShowHistory((current) => !current)}
                disabled={busy || loadingContext} aria-expanded={showHistory}
                aria-label="View previous chats" title="Chat history">
                History
              </button>
              <button type="button" className="student-tutor-chat-header-button"
                onClick={startNewChat} disabled={busy || loadingContext}
                aria-label="Start new chat" title="Start new chat">
                + New
              </button>
              <button type="button" onClick={() => setOpen(false)}
                className="student-tutor-chat-close" aria-label="Close AI Tutor">
                ×
              </button>
            </div>
          </header>

          {showHistory && (
            <div className="student-tutor-chat-history" aria-label="Previous AI chats">
              <strong>Previous chats</strong>
              {!conversations.length ? (
                <p>No saved conversations yet. Start a new chat to save one.</p>
              ) : (
                <div className="student-tutor-chat-history-list">
                  {conversations.map((chat) => (
                    <button key={chat.id} type="button"
                      disabled={busy || loadingContext}
                      className={chat.id === activeConversationId ? "active" : ""}
                      onClick={() => void selectPreviousChat(chat.id)}
                    >
                      <span>{chat.title}</span>
                      <small>{chat.mode === "tutor"
                        ? (chat.subject_name ?? "Subject Tutor")
                        : "My Dashboard"}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
                  value={selectedSubjectId ?? ""}
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
                ) : "Ask about recorded classes, online exams, assignments, attendance, fees, study materials, notices, or account help."}</p>
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
