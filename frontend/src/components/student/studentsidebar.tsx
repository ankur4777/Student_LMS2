"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import ProductCredit from "@/components/common/ProductCredit";

export default function StudentSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
      <aside className={`student-sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">SI</div>

          <div>
            <h5>Shabdd LMS</h5>
            <small>Student Portal</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "active" : ""}
              onClick={() => setOpen(false)}
            >
              {link.label}
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
