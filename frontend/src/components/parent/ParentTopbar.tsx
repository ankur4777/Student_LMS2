"use client";

import { useRouter } from "next/navigation";
import NotificationPopup from "@/components/notifications/NotificationPopup";

interface ParentTopbarProps {
  name: string;
  organization?: string;
}

export default function ParentTopbar({ name, organization }: ParentTopbarProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("parent_access_token");
    localStorage.removeItem("parent_refresh_token");
    localStorage.removeItem("parent_user");
    router.replace("/parent/login");
  };

  return (
    <>
      <NotificationPopup
        role="parent"
        tokenKey="parent_access_token"
        userStorageKey="parent_user"
        loginPath="/parent/login"
      />

      <header className="student-topbar">
        <div>
          <h4 className="mb-1 fw-bold">Parent Dashboard</h4>
          <p className="text-muted mb-0">Welcome back, {name}</p>
        </div>

        <div className="d-flex align-items-center gap-3">
          {organization && <div className="text-muted">{organization}</div>}
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>
    </>
  );
}
