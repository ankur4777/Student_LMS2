"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import ProductCredit from "@/components/common/ProductCredit";

const links = [
  ["Dashboard", "/teacher/dashboard"],
  ["My Classes", "/teacher/classes"],
  ["Recordings", "/teacher/recordings"],
  ["Attendance", "/teacher/attendance"],
  ["Assignments", "/teacher/assignments"],
  ["Students", "/teacher/students"],
  ["Results", "/teacher/results"],
  ["Documents", "/teacher/documents"],
  ["Notifications", "/teacher/notifications"],
  ["Profile", "/teacher/profile"],
];

export default function TeacherSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (
    pathname === href || pathname.startsWith(`${href}/`)
  );

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
      <aside className={`teacher-sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="teacher-sidebar-brand">
          Shabdd LMS
          <div className="small text-muted fw-normal mt-1">
            Teacher Portal
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
              {label}
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
