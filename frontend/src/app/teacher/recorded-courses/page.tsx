"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";
import "../../teacher/dashboard/dashboard.css";

type Course = { id: number; title: string; description: string; module_count: number; lesson_count: number };
const API = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export default function TeacherLearningCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [status, setStatus] = useState("Loading assigned courses...");
  const [user, setUser] = useState<{ name?: string; username?: string; organization?: string }>({});
  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem("teacher_user") || "{}")); } catch { /* empty */ }
    const token = localStorage.getItem("teacher_access_token");
    if (!token) { router.replace("/teacher/login"); return; }
    fetch(`${API}/api/recorded-courses/learning/manage/courses/`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw Error(j.detail || "Unable to access learning courses."); return j; })
      .then(j => { setCourses(j.courses || []); setStatus(""); })
      .catch(e => setStatus(e instanceof Error ? e.message : "Unable to load courses."));
  }, [router]);
  return <div className="teacher-dashboard"><TeacherSidebar/><main className="teacher-dashboard-main"><TeacherTopbar name={user.name || user.username || "Teacher"} organization={user.organization || ""}/><div className="teacher-dashboard-content"><div className="container-fluid">
    <div className="mb-4"><h1 className="h3 fw-bold">My Recorded Learning Courses</h1><p className="text-muted">Create course modules, upload video lessons and provide notes for your students.</p></div>
    {status && <div className="alert alert-info">{status}</div>}
    {!status && courses.length === 0 && <div className="card p-4 text-muted">No learning courses have been assigned to you yet. Ask your College Admin to assign a course.</div>}
    <div className="row g-3">{courses.map(course => <div className="col-md-6 col-xl-4" key={course.id}><div className="card h-100 border-0 shadow-sm"><div className="card-body"><h2 className="h5 fw-semibold">{course.title}</h2><p className="small text-muted">{course.description || "Recorded learning"}</p><p className="small">{course.module_count} modules · {course.lesson_count} lessons</p><Link className="btn btn-outline-primary" href={`/teacher/recorded-courses/${course.id}`}>Manage course</Link></div></div></div>)}</div>
  </div></div></main></div>;
}
