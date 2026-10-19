"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ParentSidebar from "@/components/parent/ParentSidebar";
import ParentTopbar from "@/components/parent/ParentTopbar";
import "../../student/dashboard/dashboard.css";
import "../../leave-requests.css";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

type Child = { id: number; name: string; classroom: string; section: string };
type UpcomingClass = {
  id: number; student_id: number; title: string; subject: string;
  section: string; teacher: string; class_date: string;
  start_time: string; end_time: string;
};
type LeaveRecord = {
  id: number; student_id: number; student_name: string; reason: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string; created_at: string;
  live_class: UpcomingClass;
};
type LeaveData = {children: Child[]; upcoming_classes: UpcomingClass[]; requests: LeaveRecord[]};
type ParentUser = {name?:string;username?:string;organization?:string};

// A 404/500 can return an HTML error page instead of JSON. Do not mistake
// that failure for "no linked students" or quietly discard the HTTP status.
async function readLeaveResponse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    if (response.status === 404) {
      throw new Error(
        "Leave Requests API not found (HTTP 404). Update and restart your Django backend on the leave-request branch, and check NEXT_PUBLIC_API_BASE_URL in frontend/.env.local."
      );
    }
    if (response.status >= 500) {
      throw new Error(
        "Leave Requests API server error (HTTP " + response.status + "). Check your Django terminal for the traceback and verify the leave_requests database migration was applied to your local database."
      );
    }
    throw new Error(
      "Leave Requests API returned HTTP " + response.status + " without JSON. Check your Django backend and NEXT_PUBLIC_API_BASE_URL."
    );
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json() as Record<string, unknown>;
  } catch {
    throw new Error("Leave Requests API returned invalid JSON. Check your Django backend terminal.");
  }
  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : "";
    throw new Error(detail || (
      "Leave Requests API returned HTTP " + response.status +
      ". Check the Django terminal and your local database migrations."
    ));
  }
  return data;
}

const formatWhen = (item: UpcomingClass) => {
  const date = new Date(item.class_date + "T12:00:00");
  const formatted = Number.isNaN(date.getTime()) ? item.class_date
    : date.toLocaleDateString("en-IN", {day:"numeric",month:"short",year:"numeric"});
  return formatted + " · " + item.start_time.slice(0,5);
};

export default function ParentLeaveRequestsPage() {
  const router = useRouter();
  const [parent, setParent] = useState<ParentUser>({});
  const [children, setChildren] = useState<Child[]>([]);
  const [classes, setClasses] = useState<UpcomingClass[]>([]);
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const getToken = useCallback(() => {
    const token = localStorage.getItem("parent_access_token");
    if (!token) {
      router.replace("/parent/login");
      throw new Error("Please sign in again.");
    }
    return token;
  }, [router]);

  const load = useCallback(async () => {
    const token = getToken();
    let response: Response;
    try {
      response = await fetch(API_BASE + "/api/leave-requests/parent/", {
        headers: {Authorization: "Bearer " + token}, cache: "no-store",
      });
    } catch {
      throw new Error(
        "Cannot connect to the Leave Requests API. Check that Django is running and NEXT_PUBLIC_API_BASE_URL points to its address."
      );
    }
    if (response.status === 401) {
      router.replace("/parent/login");
      throw new Error("Please sign in again.");
    }
    const data = await readLeaveResponse(response) as unknown as LeaveData;
    setChildren(data.children || []);
    setClasses(data.upcoming_classes || []);
    setRecords(data.requests || []);
    setHasLoaded(true);
    setSelectedChild(current => {
      if (data.children?.some(child => String(child.id) === current)) return current;
      return data.children?.length === 1 ? String(data.children[0].id) : "";
    });
  }, [getToken, router]);

  useEffect(() => {
    const saved = localStorage.getItem("parent_user");
    if (saved) {
      try {setParent(JSON.parse(saved) as ParentUser);} catch { /* ignore */ }
    }
    let active = true;
    const init = async () => {
      try {await load();}
      catch(e) {if(active) setError(e instanceof Error ? e.message : "Could not load leave requests.");}
      finally {if(active) setLoading(false);}
    };
    void init();
    return () => {active=false;};
  }, [load]);

  const retry = async () => {
    setLoading(true);
    setHasLoaded(false);
    setError("");
    setNotice("");
    try { await load(); }
    catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load leave requests.");
    } finally { setLoading(false); }
  };

  const available = useMemo(() => {
    const alreadyRequested = new Set(records.map(item => item.student_id + "-" + item.live_class.id));
    return classes.filter(item =>
      String(item.student_id) === selectedChild
      && !alreadyRequested.has(item.student_id + "-" + item.id)
    );
  }, [classes, records, selectedChild]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !selectedChild || !selectedClass) return;
    setSaving(true);setError("");setNotice("");
    try {
      const token = getToken();
      const response = await fetch(API_BASE + "/api/leave-requests/parent/", {
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:"Bearer " + token},
        body:JSON.stringify({
          student_id:Number(selectedChild), live_class_id:Number(selectedClass),reason:reason.trim(),
        }),
      });
      await readLeaveResponse(response);
      setReason("");setSelectedClass("");
      await load();
      setNotice("Leave request submitted. The assigned teacher and college admin have been notified. Awaiting college admin approval.");
    } catch(e) {setError(e instanceof Error ? e.message : "Unable to submit leave request.");}
    finally {setSaving(false);}
  };

  const pending = records.filter(item=>item.status==="pending").length;

  return (
    <div className="student-dashboard">
      <ParentSidebar />
      <main className="student-dashboard-main">
        <ParentTopbar name={parent.name || parent.username || "Parent"} organization={parent.organization || ""}/>
        <div className="student-dashboard-content lms-leave-page">
          <div className="container-fluid">
            <div className="lms-leave-intro">
              <h2>Student Leave Requests</h2>
              <p>Let the teacher and college administration know if your child will miss an upcoming scheduled class.</p>
            </div>
            {error && <div role="alert" className="lms-leave-alert lms-leave-error">{error}</div>}
            {notice && <div role="status" className="lms-leave-alert lms-leave-success">{notice}</div>}
            {loading ? <div className="lms-leave-empty">Loading students and class schedules...</div>
              : !hasLoaded ? (
                <div className="lms-leave-empty" role="status">
                  <p>Student and class information could not be loaded. This does not mean that you have no linked students.</p>
                  <button type="button" className="lms-leave-button mt-3" onClick={() => void retry()}>
                    Retry loading
                  </button>
                </div>
              ) : (
              <div className="lms-leave-grid">
                <section className="lms-leave-card">
                  <h3>Request leave</h3>
                  <p>Select a linked student and their upcoming class. Requests must be reviewed by the college admin.</p>
                  {children.length===0 ? <div className="lms-leave-empty">No eligible linked students with active enrollment.</div> : (
                    <form onSubmit={submit}>
                      <div className="lms-leave-field">
                        <label htmlFor="leave-child">Student</label>
                        <select id="leave-child" required value={selectedChild} onChange={event=>{setSelectedChild(event.target.value);setSelectedClass("");}}>
                          <option value="">Select your child</option>
                          {children.map(child=>(
                            <option key={child.id} value={child.id}>{child.name} · {child.classroom} / {child.section}</option>
                          ))}
                        </select>
                      </div>
                      <div className="lms-leave-field">
                        <label htmlFor="leave-class">Upcoming class</label>
                        <select id="leave-class" required value={selectedClass} disabled={!selectedChild||available.length===0} onChange={event=>setSelectedClass(event.target.value)}>
                          <option value="">{available.length?"Select a scheduled class":"No unrequested upcoming classes"}</option>
                          {available.map(item=>(
                            <option key={item.id} value={item.id}>{item.title} · {formatWhen(item)} · {item.subject}</option>
                          ))}
                        </select>
                        <small>Only scheduled, authorized classes are available. One request per student and class.</small>
                      </div>
                      <div className="lms-leave-field">
                        <label htmlFor="leave-reason">Reason for absence</label>
                        <textarea id="leave-reason" required minLength={10} maxLength={1000} value={reason}
                          onChange={event=>setReason(event.target.value)}
                          placeholder="Please explain briefly why your child cannot attend this class."
                        />
                        <small>{reason.length}/1000 characters. Avoid unnecessary sensitive medical details.</small>
                      </div>
                      <button className="lms-leave-button" type="submit" disabled={saving||!selectedClass||reason.trim().length<10}>
                        {saving?"Submitting...":"Submit Leave Request"}
                      </button>
                    </form>
                  )}
                </section>
                <section className="lms-leave-card">
                  <div className="lms-leave-card-head">
                    <h3>My requests</h3>
                    <span className="lms-leave-badge is-pending">{pending} pending</span>
                  </div>
                  {records.length===0 ? <div className="lms-leave-empty">No leave requests yet. Requests you submit will appear here.</div> :
                    <div className="lms-leave-list">{records.map(item=>(
                      <article key={item.id} className="lms-leave-item">
                        <div className="lms-leave-item-head">
                          <div>
                            <h4>{item.student_name} · {item.live_class.title}</h4>
                            <div className="lms-leave-meta">{formatWhen(item.live_class)} · {item.live_class.subject} · Teacher: {item.live_class.teacher}</div>
                          </div>
                          <span className={"lms-leave-badge is-"+item.status}>{item.status}</span>
                        </div>
                        <p><span className="lms-leave-label">Reason:</span>{item.reason}</p>
                        {item.admin_note && <p><span className="lms-leave-label">Admin note:</span>{item.admin_note}</p>}
                      </article>
                    ))}</div>
                  }
                </section>
              </div>
            )}
            <div className="alert alert-light border mt-4 small">
              Leave approval is an administrative decision and does not automatically change official attendance.
              The teacher remains responsible for recording attendance according to college policy.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
