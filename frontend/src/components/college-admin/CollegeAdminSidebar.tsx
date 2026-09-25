"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import ProductCredit from "@/components/common/ProductCredit";
import AdminIcon, { AdminIconName } from "@/components/college-admin/AdminIcon";

const iconByLabel: Record<string, AdminIconName> = {
  Dashboard: "results",
  Students: "students",
  Teachers: "teachers",
  Parents: "parents",
  "Parent-Student Links": "enrollments",
  "Academic Sessions": "attendance",
  Classes: "classes",
  Sections: "sections",
  Subjects: "subjects",
  Enrollments: "enrollments",
  "Teacher Assignments": "assignments",
  "Live Classes": "live",
  Attendance: "attendance",
  Assignments: "assignments",
  Results: "results",
  "Reports & Analytics": "results",
  Documents: "documents",
  Fees: "fees",
  "Recorded Courses": "live",
  "Course Purchases": "fees",
  Notifications: "pending",
  Notices: "notices",
  Profile: "teachers",
};

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
  ["Reports & Analytics", "/college-admin/reports"],
  ["Documents", "/college-admin/documents"],
  ["Fees", "/college-admin/fees"],
  ["Recorded Courses", "/college-admin/recorded-courses"],
  ["Course Purchases", "/college-admin/recorded-course-purchases"],
  ["Notifications", "/college-admin/notifications"],
  ["Notices", "/college-admin/notices"],
  ["Profile", "/college-admin/profile"],
];

export default function CollegeAdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isActive = (href: string) => {
    if (pathname === href) {
      return true;
    }

    if (href === "/college-admin/dashboard") {
      return false;
    }

    return pathname.startsWith(`${href}/`);
  };
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
    <>
      <button
        type="button"
        className="dashboard-menu-toggle"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
      >
        Menu
      </button>
      <div
        className={`dashboard-menu-backdrop ${open ? "show" : ""}`}
        onClick={() => setOpen(false)}
      />
      <aside
        className={`teacher-sidebar ${open ? "sidebar-open" : ""}`}
        style={{
          height: "100vh",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <div className="teacher-sidebar-brand">
          Shabdd LMS
          <div className="small text-muted fw-normal mt-1">
            College Admin
          </div>
        </div>

        <nav className="teacher-sidebar-nav">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={isActive(href) ? "active" : ""}
              onClick={() => setOpen(false)}
            >
              <span className="college-admin-nav-label"><AdminIcon name={iconByLabel[label] || "classes"} size={18} /><span>{label}</span></span>
              {href === "/college-admin/notifications" &&
                unreadCount > 0 && (
                  <span className="badge bg-primary ms-2">
                    {unreadCount}
                  </span>
                )}
            </Link>
          ))}
        </nav>

        <div className="sidebar-product-credit">
          <ProductCredit />
        </div>
      </aside>
    </>
  );
}
