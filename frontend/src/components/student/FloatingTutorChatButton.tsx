"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const HIDDEN_ROUTES = /^\/student\/(?:login|forgot-password|reset-password|ai-assistant)(?:\/|$)/;

function RobotTutorIcon() {
  return (
    <svg viewBox="0 0 64 64" width="48" height="48" fill="none" aria-hidden="true">
      {/* Graduation cap */}
      <path d="M12 20 32 10l20 10-20 10-20-10Z" fill="#FFE4A5" stroke="#FFF" strokeWidth="2" strokeLinejoin="round" />
      <path d="M23 26v5c5 4 13 4 18 0v-5" stroke="#FFF0C9" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M48 22v11" stroke="#FFE4A5" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="48" cy="35" r="2.5" fill="#FFE4A5" />
      {/* Robot head and ears */}
      <rect x="9" y="37" width="8" height="12" rx="4" fill="#FFE4A5" />
      <rect x="47" y="37" width="8" height="12" rx="4" fill="#FFE4A5" />
      <rect x="14" y="30" width="36" height="25" rx="9" fill="#FFF" />
      <rect x="19" y="34" width="26" height="15" rx="6" fill="#FCE7EA" />
      <circle cx="26" cy="41" r="3" fill="#D92D3D" />
      <circle cx="38" cy="41" r="3" fill="#D92D3D" />
      <path d="M27 48q5 4 10 0" stroke="#D92D3D" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

export default function FloatingTutorChatButton() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const hiddenRoute = HIDDEN_ROUTES.test(pathname);

  useEffect(() => {
    let active = true;
    let requestVersion = 0;
    const controller = new AbortController();

    setEnabled(false);

    if (hiddenRoute) {
      return () => {
        active = false;
        controller.abort();
      };
    }

    const loadAccess = async () => {
      const version = ++requestVersion;
      const token = localStorage.getItem("student_access_token");

      if (!token) {
        if (active && version === requestVersion) setEnabled(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/academics/student/feature-access/`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = response.ok ? await response.json() : null;
        if (active && version === requestVersion) {
          setEnabled(response.ok && data?.features?.ai_assistant === true);
        }
      } catch {
        if (active && version === requestVersion) setEnabled(false);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadAccess();
    };

    void loadAccess();
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      controller.abort();
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [pathname, hiddenRoute]);

  if (hiddenRoute || !enabled) return null;

  return (
    <Link
      href="/student/ai-assistant"
      className="student-floating-tutor"
      aria-label="Open AI Tutor"
    >
      <span className="student-floating-tutor-tooltip" aria-hidden="true">
        Ask your AI Tutor
      </span>
      <span className="student-floating-tutor-orb">
        <RobotTutorIcon />
        <span className="student-floating-tutor-badge" aria-hidden="true">AI</span>
      </span>
    </Link>
  );
}
