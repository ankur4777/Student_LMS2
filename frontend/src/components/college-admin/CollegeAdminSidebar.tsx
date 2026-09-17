"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["Dashboard", "/college-admin/dashboard"],
  ["Students", "/college-admin/students"],
  ["Teachers", "/college-admin/teachers"],
  ["Parents", "/college-admin/parents"],
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
  ["Profile", "/college-admin/profile"],
];

export default function CollegeAdminSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (
    pathname === href ||
    (href === "/college-admin/results" &&
      pathname.startsWith("/college-admin/results/"))
  );

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
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
