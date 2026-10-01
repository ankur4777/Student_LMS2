"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface ForgotPasswordFormProps {
  role: "student" | "parent" | "teacher" | "college_admin";
  portalName: string;
  loginPath: string;
}

export default function ForgotPasswordForm({
  role,
  portalName,
  loginPath,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      setSending(true);

      const response = await fetch(
        `${API_BASE}/api/accounts/password-reset/request/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, role }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result?.detail || "Unable to send reset email.");
        return;
      }

      setMessage(
        result?.message ||
          "If an account exists for this email, a reset link has been sent."
      );
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
      <div
        className="card border-0 shadow-sm"
        style={{ width: "100%", maxWidth: 440, borderRadius: 16 }}
      >
        <div className="card-body p-4 p-md-5">
          <h2 className="fw-bold mb-2">Forgot Password</h2>
          <p className="text-muted mb-4">
            Enter the email registered with your {portalName} account.
          </p>

          {message && (
            <div className="alert alert-success">{message}</div>
          )}

          {error && (
            <div className="alert alert-danger">{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="form-label">Email Address</label>
              <input
                className="form-control"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your registered email"
                autoComplete="email"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={sending}
            >
              {sending ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

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
