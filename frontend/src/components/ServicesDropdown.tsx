"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Hover opens Services on desktop. Click/tap and keyboard activation still
 * toggle the menu on devices without hover support.
 */
export default function ServicesDropdown() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const triggerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  return (
    <details
      ref={menuRef}
      className="lms-services-menu"
      open={open}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <summary
        ref={triggerRef}
        aria-label="Services"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        Services <i className="bi bi-chevron-down" aria-hidden="true" />
      </summary>
      <div className="lms-services-dropdown">
        <span className="lms-services-dropdown-heading">EXPLORE OUR SERVICES</span>
        <Link
          href="/services/online-tutoring"
          className="lms-services-dropdown-item"
          onClick={() => setOpen(false)}
        >
          <span className="lms-services-dropdown-icon is-coral">
            <i className="bi bi-camera-video" aria-hidden="true" />
          </span>
          <span>
            <strong>Online Tutoring</strong>
            <small>One-to-one &amp; group online classes</small>
          </span>
          <i className="bi bi-arrow-up-right" aria-hidden="true" />
        </Link>
        <Link
          href="/services/school-college-lms"
          className="lms-services-dropdown-item"
          onClick={() => setOpen(false)}
        >
          <span className="lms-services-dropdown-icon is-blue">
            <i className="bi bi-buildings" aria-hidden="true" />
          </span>
          <span>
            <strong>School &amp; College LMS</strong>
            <small>Software for academic management</small>
          </span>
          <i className="bi bi-arrow-up-right" aria-hidden="true" />
        </Link>
      </div>
    </details>
  );
}
