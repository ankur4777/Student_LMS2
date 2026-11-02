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
