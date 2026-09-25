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

const navItems: ParentNavItem[] = [
  { label: "Dashboard", href: "/parent/dashboard", icon: "dashboard" },
  { label: "My Children", href: "/parent/children", icon: "children" },
  { label: "Attendance", href: "/parent/attendance", icon: "attendance" },
  { label: "Assignments", href: "/parent/assignments", icon: "assignments" },
  { label: "Results", href: "/parent/results", icon: "results" },
  { label: "Recorded Courses", href: "/parent/recorded-courses", icon: "courses" },
  { label: "Fees", href: "/parent/fees", icon: "fees" },
  { label: "Notifications", href: "/parent/notifications", icon: "notifications" },
  { label: "Profile", href: "/parent/profile", icon: "profile" },
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
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={isActive(item.href) ? "active" : ""}
            >
              <span className="parent-nav-label">
                <ParentIcon name={item.icon} size={18} />
                <span>{item.label}</span>
              </span>
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
