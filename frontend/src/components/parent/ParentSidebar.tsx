"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ParentSidebar() {
  const pathname = usePathname();

  return (
    <aside className="student-sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">LMS</div>

        <div>
          <h5>Parent LMS</h5>
          <small>Learning Portal</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        <Link
          href="/parent/dashboard"
          className={
            pathname === "/parent/dashboard"
              ? "active"
              : ""
          }
        >
          Dashboard
        </Link>

        <Link
          href="/parent/children"
          className={
            pathname === "/parent/children"
              ? "active"
              : ""
          }
        >
          My Children
        </Link>

        <Link
          href="/parent/attendance"
          className={
            pathname === "/parent/attendance"
              ? "active"
              : ""
          }
        >
          Attendance
        </Link>

        <Link
          href="/parent/assignments"
          className={
            pathname === "/parent/assignments"
              ? "active"
              : ""
          }
        >
          Assignments
        </Link>

        <Link
          href="/parent/results"
          className={
            pathname === "/parent/results"
              ? "active"
              : ""
          }
        >
          Results
        </Link>

        <Link
          href="/parent/recorded-courses"
          className={pathname === "/parent/recorded-courses" || pathname.startsWith("/parent/recorded-courses/") ? "active" : ""}
        >
          Recorded Courses
        </Link>

        <Link
          href="/parent/fees"
          className={
            pathname === "/parent/fees"
              ? "active"
              : ""
          }
        >
          Fees
        </Link>

        <Link
          href="/parent/notifications"
          className={
            pathname === "/parent/notifications"
              ? "active"
              : ""
          }
        >
          Notifications
        </Link>

        <Link
          href="/parent/profile"
          className={
            pathname === "/parent/profile"
              ? "active"
              : ""
          }
        >
          Profile
        </Link>
      </nav>
    </aside>
  );
}