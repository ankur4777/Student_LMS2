"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";
import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type Assignment = {
  teacher_assignment_id: number;
  subject_name: string;
  section_name: string;
  classroom_name: string;
};

type OnlineExam = {
  id: number;
  title: string;
  subject: string;
  classroom: string;
  section: string;
  starts_at: string;
  ends_at: string;
  question_count: number;
  total_marks: string;
  available_to_students: boolean;
  result_published: boolean;
};

export default function TeacherOnlineExamsPage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [assignmentId, setAssignmentId] = useState("");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("teacher_access_token");
    if (!token) {
      router.replace("/teacher/login");
      return;
    }
    try {
      setTeacher(JSON.parse(localStorage.getItem("teacher_user") || "{}"));
    } catch {
      setTeacher({});
    }

    const load = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [a, b] = await Promise.all([
          fetch(`${API_BASE}/api/results/teacher/setup/`, { headers, cache: "no-store" }),
          fetch(`${API_BASE}/api/results/teacher/online-exams/`, { headers, cache: "no-store" }),
        ]);
        if (a.status === 401 || b.status === 401) {
          router.replace("/teacher/login");
          return;
        }
        const [setup, list] = await Promise.all([a.json(), b.json()]);
        if (!a.ok || !b.ok) throw new Error(setup.detail || list.detail || "Unable to load exams.");
        setAssignments(setup.assignments || []);
        setExams(list.exams || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load exams.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [router]);

  const createExam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!start || !end || !assignmentId || !title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("teacher_access_token");
      const response = await fetch(`${API_BASE}/api/results/teacher/online-exams/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          teacher_assignment_id: Number(assignmentId),
          starts_at: new Date(start).toISOString(),
          ends_at: new Date(end).toISOString(),
          duration_minutes: minutes,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to create exam.");
      router.push(`/teacher/online-exams/${data.exam.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create exam.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="teacher-dashboard">
      <TeacherSidebar />
      <main className="teacher-dashboard-main">
        <TeacherTopbar name={teacher.name || teacher.username || "Teacher"} organization={teacher.organization || ""} />
        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <div className="mb-4">
              <h2 className="fw-bold mb-1">Online Exams</h2>
              <p className="text-muted mb-0">Create objective, subjective or mixed exams. Publish final results after marking.</p>
            </div>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <h5 className="fw-bold mb-3">Create Online Exam</h5>
                <form onSubmit={createExam}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Class / Section / Subject</label>
                      <select className="form-select" value={assignmentId} onChange={e => setAssignmentId(e.target.value)} required>
                        <option value="">Select your assigned class and subject</option>
                        {assignments.map(a => <option key={a.teacher_assignment_id} value={a.teacher_assignment_id}>{a.classroom_name} / {a.section_name} — {a.subject_name}</option>)}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Exam Title</label>
                      <input className="form-control" maxLength={150} value={title} onChange={e => setTitle(e.target.value)} placeholder="Science Unit Test" required />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Start Date and Time</label>
                      <input type="datetime-local" className="form-control" value={start} onChange={e => setStart(e.target.value)} required />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">End Date and Time</label>
                      <input type="datetime-local" className="form-control" value={end} onChange={e => setEnd(e.target.value)} required />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Time Limit (minutes)</label>
                      <input type="number" min={1} max={360} className="form-control" value={minutes} onChange={e => setMinutes(Number(e.target.value))} required />
                    </div>
                  </div>
                  <p className="form-text mt-3">You will add questions on the next page. Exams remain drafts until you release them.</p>
                  <button className="btn btn-primary" disabled={saving}>{saving ? "Creating..." : "Create Draft & Add Questions"}</button>
                </form>
              </div>
            </div>
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                <h5 className="fw-bold mb-3">Your Online Exams</h5>
                {loading ? <div className="text-muted">Loading...</div> : exams.length === 0 ? (
                  <p className="text-muted mb-0">No online exams created yet.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle">
                      <thead><tr><th>Exam</th><th>Class / Subject</th><th>Questions</th><th>Schedule</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>
                        {exams.map(exam => (
                          <tr key={exam.id}>
                            <td className="fw-semibold">{exam.title}</td>
                            <td>{exam.classroom} / {exam.section}<div className="text-muted small">{exam.subject}</div></td>
                            <td>{exam.question_count} · {exam.total_marks} marks</td>
                            <td>{new Date(exam.starts_at).toLocaleString()}<div className="text-muted small">Ends {new Date(exam.ends_at).toLocaleString()}</div></td>
                            <td><span className={`badge ${exam.result_published ? "bg-success" : exam.available_to_students ? "bg-primary" : "bg-secondary"}`}>{exam.result_published ? "Results Published" : exam.available_to_students ? "Exam Released" : "Draft"}</span></td>
                            <td><Link href={`/teacher/online-exams/${exam.id}`} className="btn btn-outline-primary btn-sm">Manage Exam</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
