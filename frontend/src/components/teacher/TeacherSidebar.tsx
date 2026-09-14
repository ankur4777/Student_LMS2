"use client";

import Link from "next/link";

export default function TeacherSidebar() {
  return (
    <aside className="teacher-sidebar">
      <div className="teacher-sidebar-brand">
        Teacher LMS
      </div>

      <nav className="teacher-sidebar-nav">
        <Link href="/teacher/dashboard">
          Dashboard
        </Link>

        <Link href="/teacher/classes">
          My Classes
        </Link>

        <Link href="/teacher/recordings">
          Recordings
        </Link>

        <Link href="/teacher/attendance">
          Attendance
        </Link>

        <Link href="/teacher/assignments">
          Assignments
        </Link>

        <Link href="/teacher/students">
          Students
        </Link>
        <Link href="/teacher/results">
  Results
</Link>
      </nav>
    </aside>
  );
}