"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import RoleSessionKeeper from "@/components/auth/RoleSessionKeeper";

import NotificationPopup from "@/components/notifications/NotificationPopup";
import StudentIcon from "@/components/student/StudentIcon";
import StudentLiveClassPopup from "@/components/student/StudentLiveClassPopup";

interface StudentTopbarProps {
  name: string;
  organization?: string;
}

function savedProfilePicture() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const saved = JSON.parse(
      localStorage.getItem("student_user") || "{}"
    );
    return saved.profile_picture || "";
  } catch {
    return "";
  }
}

function initials(name: string) {
  const value = (name || "S").trim();
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`
    : value.slice(0, 2)
  ).toUpperCase();
}

export default function StudentTopbar({
  name,
  organization,
}: StudentTopbarProps) {
  const router = useRouter();
  const [profilePicture, setProfilePicture] = useState(
    savedProfilePicture
  );

  useEffect(() => {
    const refreshPicture = () => {
      setProfilePicture(savedProfilePicture());
    };

    window.addEventListener(
      "student:profile-updated",
      refreshPicture
    );

    return () => {
      window.removeEventListener(
        "student:profile-updated",
        refreshPicture
      );
    };
  }, []);

  function handleLogout() {
    localStorage.removeItem("student_access_token");
    localStorage.removeItem("student_refresh_token");
    localStorage.removeItem("student_user");
    router.replace("/student/login");
  }

  return (
    <>
      <RoleSessionKeeper
        accessTokenKey="student_access_token"
        refreshTokenKey="student_refresh_token"
        userStorageKey="student_user"
        loginPath="/student/login"
      />

      <NotificationPopup
        role="student"
        tokenKey="student_access_token"
        userStorageKey="student_user"
        loginPath="/student/login"
      />

      <StudentLiveClassPopup />

      <header className="student-topbar student-portal-topbar">
        <div className="student-portal-topbar-title">
          <h4 className="mb-1">Student Portal</h4>
          <p className="mb-0">Classes, attendance, assignments and learning resources.</p>
        </div>

        <div className="student-portal-topbar-actions">
          {organization && (
            <div className="student-portal-organization">
              <StudentIcon name="school" size={16} />
              <span>{organization}</span>
            </div>
          )}

          <div className="student-portal-user">
            {profilePicture ? (
              <img
                src={profilePicture}
                alt=""
                className="student-portal-avatar"
                style={{ objectFit: "cover" }}
                onError={() => setProfilePicture("")}
              />
            ) : (
              <span className="student-portal-avatar">
                {initials(name)}
              </span>
            )}
            <div>
              <strong>{name}</strong>
              <small>Student</small>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-danger btn-sm student-portal-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>
    </>
  );
}
