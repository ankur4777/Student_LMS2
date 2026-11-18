/**
 * Resolve the browser API base without locking multi-domain MySLS sites to a
 * retired subdomain. Relative /api requests work when Nginx proxies /api/
 * from each public hostname to the Django backend.
 *
 * Production should still set NEXT_PUBLIC_API_BASE_URL to a live API origin
 * (or leave it empty for same-origin requests), then rebuild Next.js.
 */
const RETIRED_API_HOSTS = new Set([
  "lms.shabddtravels.in",
  "lms.shabddtravel.in",
]);

export function getApiBaseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");

  if (!configured) {
    return "";
  }

  try {
    if (RETIRED_API_HOSTS.has(new URL(configured).hostname.toLowerCase())) {
      return "";
    }
  } catch {
    // Keep other configuration values unchanged; do not guess an API host.
  }

  return configured;
}
