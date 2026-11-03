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
