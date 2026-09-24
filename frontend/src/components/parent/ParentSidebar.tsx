"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import ProductCredit from "@/components/common/ProductCredit";

export default function ParentSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
            <small>Parent Portal</small>
          </div>
        </div>

        <nav className="sidebar-nav">
        <Link
          href="/parent/dashboard"
          onClick={() => setOpen(false)}
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
          onClick={() => setOpen(false)}
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
          onClick={() => setOpen(false)}
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
          onClick={() => setOpen(false)}
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
          onClick={() => setOpen(false)}
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
          onClick={() => setOpen(false)}
          className={pathname === "/parent/recorded-courses" || pathname.startsWith("/parent/recorded-courses/") ? "active" : ""}
        >
          Recorded Courses
        </Link>

        <Link
          href="/parent/fees"
          onClick={() => setOpen(false)}
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
          onClick={() => setOpen(false)}
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
          onClick={() => setOpen(false)}
          className={
            pathname === "/parent/profile"
              ? "active"
              : ""
          }
        >
          Profile
        </Link>
        </nav>

        <div className="sidebar-product-credit">
          <ProductCredit />
        </div>
      </aside>
    </>
  );
}
