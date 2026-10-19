"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export type LeaveRequestRecord = {
  id: number;
  student_id: number;
  student_name: string;
  parent_name: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  live_class: {
    id: number; title: string; class_date: string;
    start_time: string; end_time: string;
    subject: string; section: string; teacher: string;
  };
};

type Role = "teacher" | "college-admin";

function classDate(record: LeaveRequestRecord) {
  const datetime = new Date(record.live_class.class_date + "T12:00:00");
  const date = Number.isNaN(datetime.getTime()) ? record.live_class.class_date :
    datetime.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return date + " · " + record.live_class.start_time.slice(0, 5);
}

export default function LeaveQueue({ role }: { role: Role }) {
  const router = useRouter();
  const tokenKey = role === "teacher" ? "teacher_access_token" : "college_admin_access_token";
  const [items, setItems] = useState<LeaveRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [filter, setFilter] = useState("all");
  const [notes, setNotes] = useState<Record<number, string>>({});

  const auth = useCallback(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      router.replace("/" + role + "/login");
      throw new Error("Please sign in again.");
    }
    return token;
  }, [role, router, tokenKey]);

  const load = useCallback(async () => {
    const response = await fetch(API_BASE + "/api/leave-requests/" + role + "/", {
      headers: { Authorization: "Bearer " + auth() }, cache: "no-store",
    });
    if (response.status === 401) {
      router.replace("/" + role + "/login");
      throw new Error("Your session expired. Please sign in again.");
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || "Unable to load leave requests.");
    setItems(result.requests || []);
  }, [auth, role, router]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try { await load(); }
      catch (err) { if (active) setError(err instanceof Error ? err.message : "Unable to load leave requests."); }
      finally { if (active) setLoading(false); }
    };
    void run();
    return () => { active = false; };
  }, [load]);

  const filtered = useMemo(
    () => filter === "all" ? items : items.filter(item => item.status === filter),
    [filter, items],
  );

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter(item => item.status === "pending").length,
    approved: items.filter(item => item.status === "approved").length,
    rejected: items.filter(item => item.status === "rejected").length,
  }), [items]);

  const review = async (record: LeaveRequestRecord, action: "approved" | "rejected") => {
    if (role !== "college-admin" || record.status !== "pending" || workingId) return;
    setWorkingId(record.id); setError(""); setFeedback("");
    try {
      const response = await fetch(
        API_BASE + "/api/leave-requests/college-admin/" + record.id + "/review/",
        {
          method: "PATCH",
          headers: {
            Authorization: "Bearer " + auth(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, admin_note: notes[record.id] || "" }),
        },
      );
      if (response.status === 401) {
        router.replace("/college-admin/login");
        throw new Error("Your session expired. Please sign in again.");
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Unable to review leave request.");
      setFeedback("Leave request " + action + ". The parent and assigned teacher have been notified.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review leave request.");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="container-fluid">
      <div className="lms-leave-intro">
        <h2>{role === "teacher" ? "Student Leave Notifications" : "Leave Requests & Approvals"}</h2>
        <p>{role === "teacher"
          ? "Read absence requests submitted by parents for your assigned classes. Only the college admin can approve or reject requests."
          : "Review parent-submitted requests for upcoming scheduled classes, and inform parents and teachers of your decision."}
        </p>
      </div>
      {error && <div className="lms-leave-alert lms-leave-error" role="alert">{error}</div>}
      {feedback && <div className="lms-leave-alert lms-leave-success" role="status">{feedback}</div>}
      <div className="lms-leave-stat-row" aria-label="Leave request totals">
        {(["all","pending","approved","rejected"] as const).map(key=>(
          <div className="lms-leave-stat" key={key}>
            <strong>{counts[key]}</strong> {key === "all" ? "Total requests" : key}
          </div>
        ))}
      </div>
      <section className="lms-leave-card">
        <div className="lms-leave-card-head">
          <h3>{role === "teacher" ? "Requests for my classes" : "Requests awaiting review and history"}</h3>
          <select
            aria-label="Filter by request status"
            className="lms-leave-filter"
            value={filter}
            onChange={event => setFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        {loading ? <div className="lms-leave-empty">Loading leave requests...</div>
          : filtered.length === 0 ? <div className="lms-leave-empty">No leave requests found for this status.</div>
          : <div className="lms-leave-list">
              {filtered.map(item => (
                <article key={item.id} className="lms-leave-item">
                  <div className="lms-leave-item-head">
                    <div>
                      <h4>{item.student_name} · {item.live_class.title}</h4>
                      <div className="lms-leave-meta">
                        {classDate(item)} · {item.live_class.subject} · Section {item.live_class.section}
                      </div>
                      <div className="lms-leave-meta">
                        Parent: {item.parent_name} · Teacher: {item.live_class.teacher}
                      </div>
                    </div>
                    <span className={"lms-leave-badge is-" + item.status}>{item.status}</span>
                  </div>
                  <p><span className="lms-leave-label">Reason:</span>{item.reason}</p>
                  {item.reviewed_at &&
                    <p><span className="lms-leave-label">Reviewed by:</span>{item.reviewed_by || "College Admin"}</p>}
                  {item.admin_note &&
                    <p><span className="lms-leave-label">Admin note:</span>{item.admin_note}</p>}
                  {role === "college-admin" && item.status === "pending" && (
                    <div className="lms-leave-review">
                      <div className="lms-leave-field">
                        <label htmlFor={"leave-admin-note-" + item.id}>Decision note (optional)</label>
                        <textarea
                          id={"leave-admin-note-" + item.id}
                          rows={2}
                          maxLength={500}
                          value={notes[item.id] || ""}
                          onChange={event => setNotes(previous => ({
                            ...previous, [item.id]: event.target.value,
                          }))}
                          placeholder="Optional reason or guidance for the parent..."
                        />
                      </div>
                      <div className="lms-leave-actions">
                        <button className="lms-leave-button" type="button"
                          disabled={workingId !== null}
                          onClick={() => void review(item, "approved")}>
                          {workingId === item.id ? "Processing..." : "Approve Leave"}
                        </button>
                        <button className="lms-leave-button lms-leave-button-outline" type="button"
                          disabled={workingId !== null}
                          onClick={() => void review(item, "rejected")}>
                          Reject Request
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
        }
      </section>
      <div className="alert alert-light border mt-4 small">
        Leave approval records a college decision; attendance must still be marked separately by the assigned teacher.
      </div>
    </div>
  );
}
