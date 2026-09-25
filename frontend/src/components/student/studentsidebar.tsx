"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import ProductCredit from "@/components/common/ProductCredit";
import StudentIcon, { StudentIconName } from "@/components/student/StudentIcon";

type StudentNavItem = {
  label: string;
  href: string;
  icon: StudentIconName;
};

type StudentNavSection = {
  label: string;
  items: StudentNavItem[];
};

const navSections: StudentNavSection[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/student/dashboard", icon: "dashboard" },
    ],
  },
  {
    label: "Learning",
    items: [
      { label: "My Classes", href: "/student/classes", icon: "classes" },
      { label: "Recorded Classes", href: "/student/recorded-classes", icon: "recordings" },
      { label: "Buy Recorded Courses", href: "/student/recorded-courses", icon: "courses" },
    ],
  },
  {
    label: "Academics",
    items: [
      { label: "Attendance", href: "/student/attendance", icon: "attendance" },
      { label: "Assignments", href: "/student/assignments", icon: "assignments" },
      { label: "Results", href: "/student/results", icon: "results" },
      { label: "Documents", href: "/student/documents", icon: "documents" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Fees", href: "/student/fees", icon: "fees" },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Notifications", href: "/student/notifications", icon: "notifications" },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/student/profile", icon: "profile" },
    ],
  },
];

export default function StudentSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === "/student/dashboard") return false;
    return pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <button
        type="button"
        className="dashboard-menu-toggle student-menu-toggle"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
      >
        Menu
      </button>

      <div
        className={`dashboard-menu-backdrop ${open ? "show" : ""}`}
        onClick={() => setOpen(false)}
      />

      <aside className={`student-sidebar student-portal-sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand student-portal-brand">
          <span className="student-brand-logo">
            <StudentIcon name="school" size={22} />
          </span>

          <div>
            <h5>Shabdd LMS</h5>
            <small>Student Portal</small>
          </div>
        </div>

        <nav className="sidebar-nav student-portal-nav">
          {navSections.map((section) => (
            <section className="student-nav-section" key={section.label}>
              <div className="student-nav-section-title">{section.label}</div>

              <div className="student-nav-section-items">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={isActive(item.href) ? "active" : ""}
                    onClick={() => setOpen(false)}
                  >
                    <span className="student-nav-label">
                      <span className="student-nav-icon">
                        <StudentIcon name={item.icon} size={18} />
                      </span>
                      <span className="student-nav-text">{item.label}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="sidebar-product-credit">
          <ProductCredit />
        </div>
      </aside>
    </>
  );
}
