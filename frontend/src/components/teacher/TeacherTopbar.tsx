"use client";

import { useRouter } from "next/navigation";

import NotificationPopup from "@/components/notifications/NotificationPopup";

interface TeacherTopbarProps {
  name: string;
  organization: string;
}

export default function TeacherTopbar({
  name,
  organization,
}: TeacherTopbarProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("teacher_access_token");
    localStorage.removeItem("teacher_refresh_token");
    localStorage.removeItem("teacher_user");

    router.replace("/teacher/login");
  };

  return (
    <>
      <NotificationPopup
        role="teacher"
        tokenKey="teacher_access_token"
        userStorageKey="teacher_user"
        loginPath="/teacher/login"
      />

      <header className="teacher-topbar">
        <div>
          <h4 className="mb-1">
            Teacher Dashboard
          </h4>

          <p className="mb-0 text-muted">
            {organization}
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <div>
            <strong>{name}</strong>
            <div className="small text-muted">
              Teacher
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
