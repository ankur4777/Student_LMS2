"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import LearningCourseEditor from "@/components/learning/LearningCourseEditor";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";
import "../../../teacher/dashboard/dashboard.css";

export default function TeacherLearningCourseDetailPage() {
  const params = useParams<{id:string}>();
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; username?: string; organization?: string }>({});
  useEffect(() => {
    const token = localStorage.getItem("teacher_access_token");
    if (!token) { router.replace("/teacher/login"); return; }
    try { setUser(JSON.parse(localStorage.getItem("teacher_user") || "{}")); } catch { /* empty */ }
  }, [router]);
  return <div className="teacher-dashboard"><TeacherSidebar/><main className="teacher-dashboard-main"><TeacherTopbar name={user.name || user.username || "Teacher"} organization={user.organization || ""}/><div className="teacher-dashboard-content"><div className="container-fluid">
    <Link href="/teacher/recorded-courses" className="btn btn-link px-0">← My Learning Courses</Link>
    <h1 className="h3 fw-bold mb-3">Manage Course Content</h1>
    {Number.isSafeInteger(Number(params.id)) && Number(params.id) > 0 ? <LearningCourseEditor courseId={Number(params.id)} role="teacher"/> : <p className="alert alert-danger">Invalid course ID.</p>}
  </div></div></main></div>;
}
