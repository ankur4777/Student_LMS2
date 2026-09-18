"use client";

import { useRouter } from "next/navigation";

import NotificationPopup from "@/components/notifications/NotificationPopup";

interface StudentTopbarProps {
  name: string;
  organization?: string;
}

export default function StudentTopbar({
  name,
}: StudentTopbarProps) {
  const router = useRouter();

  const initial = name
    ? name.charAt(0).toUpperCase()
    : "S";

  function handleLogout() {
    localStorage.removeItem("student_access_token");
    localStorage.removeItem("student_refresh_token");
    localStorage.removeItem("student_user");

    router.replace("/student/login");
  }

  return (
    <>
      <NotificationPopup
        role="student"
        tokenKey="student_access_token"
        userStorageKey="student_user"
        loginPath="/student/login"
      />

      <header className="student-topbar">
        <div>
          <h4 className="mb-1">
            Student Dashboard
          </h4>

          <p className="mb-0 text-muted">
            Welcome back, {name}
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">

          <div className="topbar-profile">
            <div className="profile-avatar">
              {initial}
            </div>

            <div>
              <strong>{name}</strong>
              <small>Student</small>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={handleLogout}
          >
            Logout
          </button>

        </div>
      </header>
    </>
  );
}
