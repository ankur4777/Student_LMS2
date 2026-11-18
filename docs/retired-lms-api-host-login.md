# MySLS login requests after retiring the legacy LMS subdomain

## Symptom

On a live hostname such as `https://mysls.au`, DevTools Network shows requests to
`https://lms.shabddtravels.in/api/accounts/college-admin/login/`.
The browser reports a network failure, and the login displays "Unable to connect to the server."

## Why

The frontend uses `NEXT_PUBLIC_API_BASE_URL` for requests. In Next.js, this public
value is embedded in the browser bundle **at build time**. Updating the server's
environment file without rebuilding and restarting the frontend will not update it.

## Application-side guard

`src/lib/apiBaseUrl.ts` ignores the retired `lms.shabddtravels.in` and
`lms.shabddtravel.in` API origins. Authentication pages and shared account
controls use this helper. When the value is empty or retired, requests become
relative to the current website (for example, `/api/accounts/college-admin/login/`).

**This requires each site's reverse proxy to forward `/api/` to the Django
service.** A frontend-only deployment cannot make an unavailable backend work.

## Deployment checklist

1. On your VPS, inspect the frontend's actual environment sources and service
   configuration (`frontend/.env.production`, `frontend/.env.local`,
   systemd or process-manager environment). Do not paste any secrets into chat.
2. If the backend is served through the same public hostname, set
   `NEXT_PUBLIC_API_BASE_URL=` (empty). Alternatively use a confirmed
   **working HTTPS API origin**, never a retired subdomain.
3. Make sure the Nginx `/api/` route forwards to your running Django/Gunicorn
   service for **every** active MySLS hostname. The Django URLs include
   `/api/accounts/college-admin/login/`. Check Nginx configuration before
   reloading it (`sudo nginx -t`). Do not replace production proxy config blindly.
4. Check Django `DJANGO_ALLOWED_HOSTS` and, if using cross-origin API
   requests, `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`.
5. On the target branch, rebuild Next.js **after** setting the correct environment
   (`cd frontend && npm ci && npm run build`). Restart the configured frontend
   process using your actual service manager. Deploy backend changes only if needed.
6. Confirm in browser DevTools Network that login uses the correct live API URL.
   Test an invalid login first: an HTTP 400/401 response shows routing works.
   Test valid credentials privately. Never share passwords, tokens, or request payloads.

## Troubleshooting status

- `ERR_NAME_NOT_RESOLVED`: DNS/retired host in URL
- `404` on `/api/accounts/college-admin/login/`: routing/proxy path mismatch
- `502`: proxy upstream/down Django/Gunicorn
- CORS error: wrong allowed-origin configuration for a cross-origin API
- `401` or `400` with JSON: API reached; inspect credentials/validation
- No request visible: inspect browser console and JavaScript errors

The guard currently covers portal authentication and shared password/session
flows. Many feature pages still use `NEXT_PUBLIC_API_BASE_URL` directly;
the production environment must be corrected and rebuilt for those as well.
