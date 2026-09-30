"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const REFRESH_BEFORE_EXPIRY_SECONDS = 10 * 60;

interface RoleSessionKeeperProps {
  accessTokenKey: string;
  refreshTokenKey: string;
  userStorageKey: string;
  loginPath: string;
}

function tokenExpiresSoon(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;

    const normalized = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const decoded = JSON.parse(
      atob(normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        "="
      ))
    );

    const expiresAt = Number(decoded.exp || 0);
    const now = Math.floor(Date.now() / 1000);

    return expiresAt - now <= REFRESH_BEFORE_EXPIRY_SECONDS;
  } catch {
    return true;
  }
}

export default function RoleSessionKeeper({
  accessTokenKey,
  refreshTokenKey,
  userStorageKey,
  loginPath,
}: RoleSessionKeeperProps) {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const clearRoleSession = () => {
      localStorage.removeItem(accessTokenKey);
      localStorage.removeItem(refreshTokenKey);
      localStorage.removeItem(userStorageKey);
    };

    const refreshAccessToken = async () => {
      const refresh = localStorage.getItem(refreshTokenKey);

      if (!refresh) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/auth/token/refresh/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refresh }),
          }
        );

        if (!active) {
          return;
        }

        if (!response.ok) {
          if (response.status === 401) {
            clearRoleSession();
            router.replace(loginPath);
          }
          return;
        }

        const result = await response.json();
        const access = String(result.access || "");

        if (access) {
          localStorage.setItem(accessTokenKey, access);
        }
      } catch {
        // Temporary network errors should not sign the user out.
      }
    };

    const keepSessionAlive = () => {
      const access = localStorage.getItem(accessTokenKey);
      const refresh = localStorage.getItem(refreshTokenKey);

      if (!refresh) {
        return;
      }

      if (!access || tokenExpiresSoon(access)) {
        void refreshAccessToken();
      }
    };

    keepSessionAlive();

    const intervalId = window.setInterval(
      keepSessionAlive,
      CHECK_INTERVAL_MS
    );

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [
    accessTokenKey,
    loginPath,
    refreshTokenKey,
    router,
    userStorageKey,
  ]);

  return null;
}
