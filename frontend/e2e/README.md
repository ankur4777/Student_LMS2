# MySLS Phase 19 — Local Browser Smoke Tests

Playwright checks the real browser redirects and read-only College Admin,
Teacher and Student recorded-learning pages. The College Admin test also
downloads the real tenant-scoped analytics CSV.

**Local QA only.** Use disposable accounts in a dedicated local organization,
never production, DU, or real student data. Learning & Certification must be
enabled **only** for the QA organization. These tests do not create courses,
submit exams, revoke certificates, or fake viewing progress.

## 1. Start the local services

In VS Code PowerShell terminals from `C:\student_LMS`:

```powershell
python manage.py runserver
```

In a separate terminal:

```powershell
cd C:\student_LMS\frontend
npm run dev
```

Make sure `frontend/.env.local` points `NEXT_PUBLIC_API_BASE_URL` at
`http://127.0.0.1:8000`. Restart Next.js if the variable was changed.
Use the feature branch `feature/recorded-learning-certificates`.

## 2. Install the isolated browser-testing dependencies

In a third terminal:

```powershell
cd C:\student_LMS\frontend\e2e
npm install
npx playwright install chromium
```

This is a separate `package.json` and does not change the production
frontend's installed dependencies or build scripts. Never commit
`node_modules`, generated reports or QA login credentials.

## 3. Set local QA credentials and run

Set environment variables in **the same PowerShell session** in which you
run the tests (use private disposable QA account values, not real passwords):

```powershell
$env:E2E_BASE_URL = "http://127.0.0.1:3000"
$env:E2E_COLLEGE_ADMIN_USERNAME = "<local QA admin username>"
$env:E2E_COLLEGE_ADMIN_PASSWORD = "<local QA admin password>"
$env:E2E_TEACHER_USERNAME = "<local QA teacher username>"
$env:E2E_TEACHER_PASSWORD = "<local QA teacher password>"
$env:E2E_STUDENT_USERNAME = "<local QA student username>"
$env:E2E_STUDENT_PASSWORD = "<local QA student password>"

npm test
```

Missing a role's credentials skips that role's positive-login check. The
three unauthorized-redirect checks still run. To assert a specific
assigned/enrolled course, you can also set:

```powershell
$env:E2E_TEACHER_COURSE_TITLE = "<assigned QA course title>"
$env:E2E_STUDENT_COURSE_TITLE = "<enrolled QA course title>"
```

For a visible Chrome run use `npm run test:headed`. Failures save
screenshots and traces under `test-results` and an HTML report under
`playwright-report`. Keep those files local; they might contain student
information or browser state.

## GitHub Actions browser smoke gate

The existing `.github/workflows/recorded-learning-ci.yml` now installs
Chromium in the Next.js job, starts the **built** frontend automatically,
and runs only the three unauthenticated redirect checks. No Django server,
QA credentials or real course records are needed for that CI subset.

If running the same subset against a locally built frontend:

```powershell
cd C:\\student_LMS\\frontend
npm run build
cd e2e
$env:E2E_START_WEB_SERVER = "1"
npm test -- --grep "Unauthenticated access must redirect to role login"
Remove-Item Env:E2E_START_WEB_SERVER
```

`E2E_START_WEB_SERVER=1` tells Playwright to start `npm run start`
in the parent `frontend` directory. Do not use it when `npm run dev`
is already serving port 3000; instead leave it unset and run `npm test`.
The CI check is a **browser routing/access smoke check**, not a
backend authorization test. Django role, tenant isolation and certificate
checks remain covered by separate backend tests.

## Simulated Student Learning Center UI regression checks

GitHub Actions also runs `tests/student-learning-mocked.spec.mjs` in Chromium.
Its network responses are **fixtures**, not Django responses; no real accounts
or database are used. These checks verify:

- Empty enrollment messaging when the API returns no courses.
- An enrolled-course progress card, percentage, and Continue learning link.
- Valid versus revoked certificates; only valid ones show Download PDF.
- Local PDF download naming using fixture bytes.
- Expired/unauthorized student access redirects to Student Login.
- An API error surfaces a warning while existing issued certificates still display.
- Course search and lesson-progress filters show the right results and clear cleanly.
- The Retry action recovers from a temporary API error without claiming no enrollments.

These tests are safe to execute in feature CI. They do **not** prove that
Django enforces authorization or that the videos/certificates themselves
are valid. The role/tenant isolation and completion rules are covered
by the Django test suite and must be exercised against local QA data.

Run only the CI-safe subset locally (no QA credentials required):

```powershell
cd C:\\student_LMS\\frontend\\e2e
npm test -- --grep "Unauthenticated access must redirect to role login|Student Learning Center UI"
```

## Cross-origin API mocking fix

Mocked API responses now include browser CORS response headers and handle
the `OPTIONS` preflight sent by `Authorization` requests from Next.js on
port 3000 to Django on port 8000. Request handlers match the API **pathname**,
even if your `NEXT_PUBLIC_API_BASE_URL` uses `localhost` instead of
`127.0.0.1`. No application API behavior has been changed.

## Strict-mode alert selector fix (November 3, 2026)

The production-build browser suite passed four out of six checks. The two
remaining failures were **Playwright locator ambiguity**, not missing error
messages: `getByRole("alert")` found the visible Learning Center error
message plus Next.js's invisible route announcer with `role="alert"`.
The checks now use `.student-learning [role='alert']` so they inspect only
this page's own warning. The same scoped locator is used to confirm the
warning clears after a successful retry. This does not modify the app.

## Trace-confirmed stuck hydration: run production browser smoke tests

The user-supplied Playwright trace from November 3, 2026 showed successful
HTTP 200 responses for the Student Login and My Courses pages and their
JavaScript bundles, but the Student Learning page stayed at **Loading your
courses...**. There were **no** Student Learning API requests at all.
The only recorded browser console errors were repeated Next.js dev-server
hot-reload WebSocket handshake errors (`/_next/hmr`). This shows that the
problem happens before the mocked API response is used; it does **not**
prove that the WebSocket errors themselves caused the page to stall.

Instead of changing Django or mocking more routes, run an isolated
**production Next.js build** for this browser suite, so the development
server and its HMR WebSocket are not involved. Stop any running `npm run
dev` instance first to avoid concurrent writes to `.next`:

```powershell
cd C:\student_LMS\frontend\e2e
npm run test:built
```

The script builds `frontend`, then Playwright launches `next start` on
**http://127.0.0.1:3100** and runs only the six mocked Student Learning
Center UI tests. It needs no Django server or login credentials. The
Playwright-managed server stops after the run; existing `main` and live
VPS files are unaffected.

If the tests still fail, inspect the **new** trace. It will be from the
production frontend rather than the hot-reloading development server.
This isolates whether the issue is caused by development-mode behavior
or a more general hydration/runtime problem. It is not a claim that
all six tests are passing.

## Troubleshooting: all simulated UI tests failed

If every simulated Student Learning Center test fails, the browser may be
reaching a stale frontend, the wrong application/port, or a page with a
client-side runtime error. This is **not** evidence of a Django learning
API failure because those API responses are mocked in this suite.

The browser tests now first load `/student/login` from `E2E_BASE_URL`,
confirm the correct heading, and set fixture-only session values using
the frontend's actual browser origin. On failures they print a safe
`[MySLS browser QA diagnosis]` entry with the final URL, headings,
and alerts (never passwords or tokens).

Use these terminals:

```powershell
# Terminal A — from the frontend folder
cd C:\student_LMS\frontend
npm run dev
```

```powershell
# Terminal B — from e2e
cd C:\student_LMS\frontend\e2e
$env:E2E_BASE_URL = "http://127.0.0.1:3000"
Remove-Item Env:E2E_START_WEB_SERVER -ErrorAction SilentlyContinue
npm test -- --grep "Student Learning Center UI" --workers=1
```

Check that Next.js prints `Local: http://localhost:3000` (or an
equivalent URL with port 3000). If Next.js chooses 3001 because port
3000 is occupied, **stop the unwanted server or set `E2E_BASE_URL` to the
actual Next.js port**. Use the HTML report to view browser screenshots:

```powershell
npx playwright show-report
```

If the tests still fail, share the first `[MySLS browser QA diagnosis]`
line and the first test's error context so the root cause can be
identified. Do not share personal credentials or JWT tokens.

## 4. Complete the manual browser acceptance journey

This automated smoke suite **does not** simulate real video watching,
module quizzes, assignment grading or a certificate lifecycle. Use the
full [manual browser checklist](../../docs/recorded-learning-browser-qa.md)
to verify actual MP4/WebM playback, server watch milestones, progression,
final exam, certificate issuance/revocation and tenant isolation.

The API-level integration journey is separately covered by:

```powershell
cd C:\student_LMS
python manage.py test recordedcourses.test_learning_journey
```

No production deployment or merge to `main` is part of Phase 19.
