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
  ["Profile", "/college-admin/profile"],
];

export default function CollegeAdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="teacher-sidebar">
      <div className="teacher-sidebar-brand">
        College Admin LMS
      </div>

      <nav className="teacher-sidebar-nav">
        {links.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? "active" : ""}
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
