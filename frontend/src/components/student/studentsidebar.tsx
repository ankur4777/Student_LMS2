"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function StudentSidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/student/dashboard", label: "Dashboard" },
    { href: "/student/classes", label: "My Classes" },
    { href: "/student/recorded-classes", label: "Recorded Classes" },
    { href: "/student/recorded-courses", label: "Buy Recorded Courses" },
    { href: "/student/attendance", label: "Attendance" },
    { href: "/student/assignments", label: "Assignments" },
    { href: "/student/results", label: "Results" },
    { href: "/student/documents", label: "Documents" },
    { href: "/student/fees", label: "Fees" },
    { href: "/student/notifications", label: "Notifications" },
    { href: "/student/profile", label: "Profile" },
  ];

  return (
    <aside className="student-sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">LMS</div>

        <div>
          <h5>Student LMS</h5>
          <small>Learning Portal</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "active" : ""}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
