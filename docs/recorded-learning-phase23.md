# Phase 23 — Full Recorded Learning API Journey and Local Browser Acceptance

This phase extends the existing **real Django API integration test** across
College Admin, Teacher and Student roles. It is not a Playwright test and
does not prove real browser playback timing or actual media decoding.

## Automated checks

The full API journey now checks:

1. Student access is denied before enrollment; duplicate enrollment is rejected.
2. Modules remain locked; direct video access and the final exam are blocked early.
3. Completing a lesson without a ticket or before playback progress returns 400.
4. Quiz submissions and grading must unlock the second module in sequence.
5. Unassigned and cross-organization teachers/admins cannot grade work.
6. A passing final issues one certificate, with no duplicate certificate on resubmit.
7. Another student cannot download the certificate; public verification works.
8. College Admin progress and analytics CSV exports are available with attachment headers.
9. Revocation removes a valid certificate from analytics and blocks owner PDF access.

The test uses Django's **separate test database**, and uploaded video bytes
are temporary. FFprobe is mocked only for the media upload in this journey.
No actual organization or student should ever be created for these tests.

## Run locally in VS Code (PowerShell)

**Before running:** confirm the local database connection in your environment
does **not** point at Hostinger, production, or any database containing
important real student records. Django creates and manages a test database,
but the command still uses the configured database server. Do not run it
with production database credentials.

From `C:\student_LMS`:

```powershell
git status --short
git pull --ff-only origin feature/recorded-learning-certificates
python manage.py check
python manage.py test recordedcourses.test_learning_journey --verbosity 2 --noinput
```

If this passes, run the broader regression set:

```powershell
python manage.py test recordedcourses.test_student_learning recordedcourses.test_module_assignments recordedcourses.test_module_quizzes recordedcourses.test_learning_finals recordedcourses.test_learning_enrollments recordedcourses.test_learning_analytics recordedcourses.test_learning_journey --noinput
```

These are backend tests and do not need `npm run dev`. The previous six
simulated Playwright tests may also be rerun separately using
`cd frontend\e2e; npm run test:built`, which does not contact Django.

## Actual browser + video verification still required

For a dedicated disposable local organization with manually created QA
accounts, follow [the existing browser checklist](recorded-learning-browser-qa.md).
It verifies a genuine MP4/WebM upload, real playback timing, teacher grading,
final exam, downloadable PDF/QR and tenant access. Never test against the live
VPS or actual student accounts.

**Gate for completion:** report the exact Django test count/results, any
failing traceback, and browser-acceptance results separately. Do not claim
the full feature is production-ready from mocked-browser tests alone.
