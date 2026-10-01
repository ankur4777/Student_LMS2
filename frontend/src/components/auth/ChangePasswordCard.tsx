"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface ChangePasswordCardProps {
  accessTokenKey: string;
  refreshTokenKey: string;
  userStorageKey: string;
  loginPath: string;
}

export default function ChangePasswordCard({
  accessTokenKey,
  refreshTokenKey,
  userStorageKey,
  loginPath,
}: ChangePasswordCardProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    const token = localStorage.getItem(accessTokenKey);
    if (!token) {
      router.replace(loginPath);
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `${API_BASE}/api/accounts/change-password/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
            confirm_password: confirmPassword,
          }),
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        localStorage.removeItem(accessTokenKey);
        localStorage.removeItem(refreshTokenKey);
        localStorage.removeItem(userStorageKey);
        router.replace(loginPath);
        return;
      }

      if (!response.ok) {
        const validationErrors = Array.isArray(result?.errors)
          ? result.errors.join(" ")
          : "";
        setError(
          validationErrors ||
            result?.detail ||
            "Unable to change password."
        );
        return;
      }

      localStorage.removeItem(accessTokenKey);
      localStorage.removeItem(refreshTokenKey);
      localStorage.removeItem(userStorageKey);
      router.replace(`${loginPath}?passwordChanged=1`);
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card border-0 shadow-sm mt-4">
      <div className="card-body p-4">
        <h5 className="fw-bold mb-1">Change Password</h5>
        <p className="text-muted mb-4">
          Update your password. You will be asked to sign in again.
        </p>

        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label">Current Password</label>
              <input
                className="form-control"
                type="password"
                value={currentPassword}
                onChange={(event) =>
                  setCurrentPassword(event.target.value)
                }
                autoComplete="current-password"
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">New Password</label>
              <input
                className="form-control"
                type="password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(event.target.value)
                }
                autoComplete="new-password"
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Confirm New Password</label>
              <input
                className="form-control"
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                autoComplete="new-password"
                required
              />
            </div>

            <div className="col-12">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
