"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface ResetPasswordFormProps {
  role: "student" | "parent" | "teacher" | "college_admin";
  loginPath: string;
}

export default function ResetPasswordForm({
  role,
  loginPath,
}: ResetPasswordFormProps) {
  const [uid, setUid] = useState("");
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUid(params.get("uid") || "");
    setToken(params.get("token") || "");
    setReady(true);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `${API_BASE}/api/accounts/password-reset/confirm/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uid,
            token,
            role,
            new_password: newPassword,
            confirm_password: confirmPassword,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        const validationErrors = Array.isArray(result?.errors)
          ? result.errors.join(" ")
          : "";
        setError(
          validationErrors ||
            result?.detail ||
            "Unable to reset password."
        );
        return;
      }

      setMessage(
        result?.message ||
          "Password reset successfully. You can now sign in."
      );
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  const invalidLink = ready && (!uid || !token);

  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
      <div
        className="card border-0 shadow-sm"
        style={{ width: "100%", maxWidth: 440, borderRadius: 16 }}
      >
        <div className="card-body p-4 p-md-5">
          <h2 className="fw-bold mb-2">Reset Password</h2>
          <p className="text-muted mb-4">
            Choose a new password for your account.
          </p>

          {invalidLink && (
            <div className="alert alert-danger">
              This password reset link is incomplete or invalid.
            </div>
          )}

          {message && (
            <div className="alert alert-success">{message}</div>
          )}

          {error && (
            <div className="alert alert-danger">{error}</div>
          )}

          {!invalidLink && ready && !message && (
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
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

              <div className="mb-4">
                <label className="form-label">
                  Confirm New Password
                </label>
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

              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={saving}
              >
                {saving ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}

          <div className="text-center mt-4">
            <Link href={loginPath} className="text-decoration-none">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
