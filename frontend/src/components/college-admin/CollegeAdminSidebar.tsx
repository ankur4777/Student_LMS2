"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["Dashboard", "/college-admin/dashboard"],
  ["Students", "/college-admin/students"],
  ["Teachers", "/college-admin/teachers"],
  ["Parents", "/college-admin/parents"],
  ["Parent-Student Links", "/college-admin/parent-student-links"],
  ["Academic Sessions", "/college-admin/academic-sessions"],
  ["Classes", "/college-admin/classes"],
  ["Sections", "/college-admin/sections"],
  ["Subjects", "/college-admin/subjects"],
  ["Enrollments", "/college-admin/enrollments"],
  ["Teacher Assignments", "/college-admin/teacher-assignments"],
  ["Live Classes", "/college-admin/live-classes"],
  ["Attendance", "/college-admin/attendance"],
  ["Assignments", "/college-admin/assignments"],
  ["Results", "/college-admin/results"],
  ["Documents", "/college-admin/documents"],
  ["Fees", "/college-admin/fees"],
  ["Notifications", "/college-admin/notifications"],
  ["Profile", "/college-admin/profile"],
];

export default function CollegeAdminSidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const isActive = (href: string) => (
    pathname === href ||
    (href === "/college-admin/results" &&
      pathname.startsWith("/college-admin/results/")) ||
    (href === "/college-admin/documents" &&
      pathname.startsWith("/college-admin/documents/")) ||
    (href === "/college-admin/parent-student-links" &&
      pathname.startsWith("/college-admin/parent-student-links/")) ||
    (href === "/college-admin/notifications" &&
      pathname.startsWith("/college-admin/notifications/")) ||
    (href === "/college-admin/fees" &&
      pathname.startsWith("/college-admin/fees/"))
  );
  const loadUnreadCount = useCallback(async () => {
    const token = localStorage.getItem("college_admin_access_token");

    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/notifications/unread-count/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return;
      }

      const result = await response.json();
      setUnreadCount(result.unread_count || 0);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUnreadCount();
    });
  }, [loadUnreadCount]);

  return (
    <aside
      className="teacher-sidebar"
      style={{
        height: "100vh",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      <div className="teacher-sidebar-brand">
        College Admin LMS
      </div>

      <nav className="teacher-sidebar-nav">
        {links.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className={isActive(href) ? "active" : ""}
          >
            <span>{label}</span>
            {href === "/college-admin/notifications" &&
              unreadCount > 0 && (
                <span className="badge bg-primary ms-2">
                  {unreadCount}
                </span>
              )}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
