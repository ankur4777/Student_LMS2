"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import ProductCredit from "@/components/common/ProductCredit";
import ParentIcon, { ParentIconName } from "@/components/parent/ParentIcon";

type ParentNavItem = {
  label: string;
  href: string;
  icon: ParentIconName;
};

type ParentNavSection = {
  label: string;
  items: ParentNavItem[];
};

const navSections: ParentNavSection[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/parent/dashboard", icon: "dashboard" },
    ],
  },
  {
    label: "Children & Academics",
    items: [
      { label: "My Children", href: "/parent/children", icon: "children" },
      { label: "Attendance", href: "/parent/attendance", icon: "attendance" },
      { label: "Assignments", href: "/parent/assignments", icon: "assignments" },
      { label: "Results", href: "/parent/results", icon: "results" },
    ],
  },
  {
    label: "Learning",
    items: [
      { label: "Recorded Courses", href: "/parent/recorded-courses", icon: "courses" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Fees", href: "/parent/fees", icon: "fees" },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Notifications", href: "/parent/notifications", icon: "notifications" },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/parent/profile", icon: "profile" },
    ],
  },
];

export default function ParentSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === "/parent/dashboard") return false;
    return pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <button
        type="button"
        className="dashboard-menu-toggle parent-menu-toggle"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
      >
        Menu
      </button>

      <div
        className={`dashboard-menu-backdrop ${open ? "show" : ""}`}
        onClick={() => setOpen(false)}
      />

      <aside className={`student-sidebar parent-sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand parent-sidebar-brand">
          <div className="brand-logo parent-brand-logo">
            <ParentIcon name="children" size={22} />
          </div>

          <div>
            <h5>Shabdd LMS</h5>
            <small>Parent Portal</small>
          </div>
        </div>

        <nav className="sidebar-nav parent-sidebar-nav">
          {navSections.map((section) => (
            <section className="parent-nav-section" key={section.label}>
              <div className="parent-nav-section-title">{section.label}</div>

              <div className="parent-nav-section-items">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={isActive(item.href) ? "active" : ""}
                  >
                    <span className="parent-nav-label">
                      <span className="parent-nav-icon">
                        <ParentIcon name={item.icon} size={18} />
                      </span>
                      <span className="parent-nav-text">{item.label}</span>
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
