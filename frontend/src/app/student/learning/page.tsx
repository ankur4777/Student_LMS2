"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import "../../dashboard/dashboard.css";
import "../learning.css";

type Course = {
  id: number;
  title: string;
  description: string;
  module_count: number;
  completed_lessons: number;
  total_lessons: number;
  access_expires_at: string | null;
};
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export default function StudentLearningCoursesPage() {
  const router = useRouter();
  const [student, setStudent] = useState<{name?:string;username?:string;organization?:string}>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try { setStudent(JSON.parse(localStorage.getItem("student_user") || "{}")); } catch { /* Ignore invalid stored profile. */ }
    const token = localStorage.getItem("student_access_token");
    if (!token) { router.replace("/student/login"); return; }
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${BASE}/api/recorded-courses/learning/student/courses/`, {
          headers: {Authorization: `Bearer ${token}`}, cache: "no-store", signal: controller.signal,
        });
        if (response.status === 401) { router.replace("/student/login"); return; }
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to load your learning courses.");
        setCourses(result.courses || []);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load courses.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    return () => controller.abort();
  }, [router]);

  return <div className="student-dashboard">
    <StudentSidebar />
    <main className="student-dashboard-main">
      <StudentTopbar name={student.name || student.username || "Student"} organization={student.organization || ""} />
      <div className="student-dashboard-content"><div className="container-fluid student-learning">
        <header className="learning-heading">
          <div><span className="learning-kicker">MY LEARNING CENTER</span><h1>My Courses</h1>
            <p>Watch published lessons, find your course notes and keep track of the lectures you finish.</p></div>
          <Link className="btn btn-outline-primary" href="/student/recorded-courses">Explore courses</Link>
        </header>
        {error && <div className="alert alert-warning" role="alert">{error}</div>}
        {loading ? <div className="learning-empty">Loading your courses...</div> : courses.length === 0 && !error ?
          <div className="learning-empty"><h2>No enrolled courses yet</h2><p>Courses with approved, active access will appear here when your organization enables Recorded Learning.</p>
            <Link href="/student/recorded-courses" className="btn btn-primary">Browse recorded courses</Link></div> :
          <div className="learning-cards">{courses.map(course => {
            const percentage = course.total_lessons ? Math.round(course.completed_lessons / course.total_lessons * 100) : 0;
            return <article className="learning-card" key={course.id}>
              <div className="learning-card-icon" aria-hidden="true"><i className="bi bi-play-btn" /></div>
              <div className="learning-card-body">
                <span className="learning-card-label">RECORDED COURSE</span><h2>{course.title}</h2>
                <p>{course.description || "Work through the video lectures and study resources."}</p>
                <div className="learning-card-meta"><span>{course.module_count} published modules</span><span>{course.completed_lessons}/{course.total_lessons} lectures viewed</span></div>
                <div className="learning-meter" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`Reported lesson progress for ${course.title}`}><span style={{width:`${percentage}%`}} /></div>
                <div className="learning-card-bottom"><span>{percentage}% viewed</span><Link className="btn btn-primary" href={`/student/learning/${course.id}`}>Continue learning <i className="bi bi-arrow-right" /></Link></div>
              </div>
            </article>;
          })}</div>}
        <p className="learning-disclaimer">Viewing progress records completed video playback; it does not count as a course examination or certificate.</p>
      </div></div>
    </main>
  </div>;
}
