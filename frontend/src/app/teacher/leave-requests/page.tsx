"use client";

import { useState } from "react";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";
import LeaveQueue from "@/components/leave-requests/LeaveQueue";
import "../dashboard/dashboard.css";
import "../../leave-requests.css";

type Teacher = {name?: string; username?: string; organization?: string};
function getTeacher(): Teacher {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("teacher_user") || "{}"); }
  catch { return {}; }
}

export default function TeacherLeaveRequestsPage() {
  const [teacher] = useState<Teacher>(getTeacher);
  return (
    <div className="teacher-dashboard">
      <TeacherSidebar />
      <main className="teacher-dashboard-main">
        <TeacherTopbar name={teacher.name || teacher.username || "Teacher"} organization={teacher.organization || ""} />
        <div className="teacher-dashboard-content lms-leave-page">
          <LeaveQueue role="teacher" />
        </div>
      </main>
    </div>
  );
}
