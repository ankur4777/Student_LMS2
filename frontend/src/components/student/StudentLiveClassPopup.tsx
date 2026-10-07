"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatTime12Hour } from "@/utils/time";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const POLL_INTERVAL_MS = 5000;

type LiveClass = {
  id: number;
  title: string;
  description?: string;
  class_date: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
  status: string;
  can_join: boolean;
  teacher_name: string;
  subject_name: string;
  section_name: string;
};

function storageKey() {
  if (typeof window === "undefined") {
    return "student_live_class_popup_dismissed";
  }

  try {
    const saved = JSON.parse(
      localStorage.getItem("student_user") || "{}"
    );
    const userKey = saved.id || saved.username || "student";
    return `student_live_class_popup_dismissed_${userKey}`;
  } catch {
    return "student_live_class_popup_dismissed_student";
  }
}

function loadDismissedIds() {
  if (typeof window === "undefined") {
    return new Set<number>();
  }

  try {
    const values = JSON.parse(
      sessionStorage.getItem(storageKey()) || "[]"
    );
    return new Set<number>(
      Array.isArray(values)
        ? values
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value))
        : []
    );
  } catch {
    return new Set<number>();
  }
}

function saveDismissedIds(ids: Set<number>) {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(
    storageKey(),
    JSON.stringify(Array.from(ids))
  );
}

export default function StudentLiveClassPopup() {
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(
    loadDismissedIds
  );

  const refreshLiveClasses = useCallback(async () => {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      setLiveClasses([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/live-classes/student/today/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setLiveClasses([]);
        }
        return;
      }

      const result = await response.json();
      const nextLiveClasses = (
        Array.isArray(result) ? result : []
      ).filter(
        (item: LiveClass) => item.status === "live"
      );

      setLiveClasses(nextLiveClasses);

      const activeIds = new Set(
        nextLiveClasses.map((item: LiveClass) => item.id)
      );

      setDismissedIds((current) => {
        const next = new Set(
          Array.from(current).filter((id) => activeIds.has(id))
        );

        saveDismissedIds(next);
        return next;
      });
    } catch {
      // Keep the portal usable if background polling temporarily fails.
    }
  }, []);

  useEffect(() => {
    void refreshLiveClasses();

    const intervalId = window.setInterval(
      () => void refreshLiveClasses(),
      POLL_INTERVAL_MS
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshLiveClasses]);

  const visibleClasses = useMemo(
    () =>
      liveClasses.filter(
        (liveClass) => !dismissedIds.has(liveClass.id)
      ),
    [dismissedIds, liveClasses]
  );

  const activeClass = visibleClasses[0];

  const dismiss = () => {
    if (!activeClass) {
      return;
    }

    setDismissedIds((current) => {
      const next = new Set(current);
      next.add(activeClass.id);
      saveDismissedIds(next);
      return next;
    });
  };

  if (!activeClass) {
    return null;
  }

  return (
    <aside
      className="student-live-class-popup"
      aria-live="polite"
      aria-label="Live class notification"
    >
      <button
        type="button"
        className="student-live-class-popup-close"
        aria-label="Close live class popup"
        onClick={dismiss}
      >
        ×
      </button>

      <div className="student-live-class-popup-status">
        <span className="student-live-class-popup-dot" />
        LIVE NOW
      </div>

      <h3>{activeClass.title}</h3>

      <div className="student-live-class-popup-meta">
        <span>{activeClass.subject_name || "Class"}</span>
        {activeClass.teacher_name && (
          <span>Teacher: {activeClass.teacher_name}</span>
        )}
        <span>
          {formatTime12Hour(activeClass.start_time)} -{" "}
          {formatTime12Hour(activeClass.end_time)}
        </span>
      </div>

      {visibleClasses.length > 1 && (
        <div className="student-live-class-popup-more">
          +{visibleClasses.length - 1} more live class
          {visibleClasses.length - 1 === 1 ? "" : "es"}
        </div>
      )}

      {activeClass.can_join && activeClass.meeting_link ? (
        <a
          className="student-live-class-popup-join"
          href={activeClass.meeting_link}
          target="_blank"
          rel="noreferrer"
        >
          Go to Live Class
          <span aria-hidden="true">→</span>
        </a>
      ) : (
        <button
          type="button"
          className="student-live-class-popup-join"
          disabled
        >
          Join link unavailable
        </button>
      )}
    </aside>
  );
}
