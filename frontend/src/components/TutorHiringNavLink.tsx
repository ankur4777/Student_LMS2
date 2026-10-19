"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Highlight Tutor Hiring only for the current hiring route. */
export default function TutorHiringNavLink() {
  const pathname = usePathname();
  const isActive = pathname === "/tutor-hiring" || pathname.startsWith("/tutor-hiring/");

  return (
    <Link
      href="/tutor-hiring"
      className={isActive ? "lms-nav-tutor-hiring is-active" : "lms-nav-tutor-hiring"}
      aria-current={isActive ? "page" : undefined}
    >
      <i className="bi bi-person-plus" aria-hidden="true" /> Tutor Hiring
    </Link>
  );
}
