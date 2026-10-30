# MySLS Recorded Learning — Phase 12 QA

Scope: `feature/recorded-learning-certificates` only. Do not deploy
these changes to GitHub `main` or the production VPS yet.

## Local setup / regression checks (VS Code PowerShell)

```powershell
cd C:\student_LMS
git status
git pull --ff-only origin feature/recorded-learning-certificates
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate recordedcourses --plan
```

Confirm the configured database is your **local MySQL** database before
migrating. Phase 12 introduces **0012_lesson_playback_session**:

```powershell
python manage.py migrate recordedcourses
python manage.py test recordedcourses.test_student_learning recordedcourses.test_module_assignments recordedcourses.test_module_quizzes recordedcourses.test_learning_enrollments recordedcourses.test_learning_finals recordedcourses.test_learning_content recordedcourses.test_learning_readiness
cd frontend
npm run build
```

## In-browser checks

1. Enable Learning & Certification for the **local test institution**.
   Set up a test course and upload a real video to its published module.
   Assign the course to a test student; do not enable production.
2. Sign in as Student, open My Learning and play a lesson.
   `POST /viewing-session/` should return a signed ticket.
3. As playback progresses, `POST /heartbeat/` submits the ticket,
   current position and browser-reported duration. Observe the displayed
   **session-tracked playback** percentage. Reports are spaced by the
   browser, and the server independently checks elapsed time.
4. Completing an ordinary-length recording without two valid heartbeat
   reports must return 400; a seek directly to its end should not earn
   enough credited progress to complete it.
5. Allow ordinary playback. Completion should succeed after the server
   observes at least 10 seconds, two valid reports, and about 80% of
   browser-reported duration as credible credited playback.
6. A short clip under 10 seconds can complete after one acceptable
   report covering at least 80% of its reported duration, provided
   the session started early enough.
7. Test pausing, large seeks, stale sessions, revoked enrollment, and
   access from another student/organization. Server validation must
   prevent unauthorized heartbeats and completions.
8. Complete subsequent modules, quizzes, assignments, final exam and
   certificate issuance. Ensure course progression still works.
9. Confirm an already-completed legacy lesson remains completed with
   its original completion method, and reports show session-backed
   counts separately.

## Known limitations / next safeguards

The client-reported position and duration remain untrusted. A scripted
client could simulate real-time progress over time. Server heartbeats
reduce casual skipping and accidental early completion, but **cannot
prove attention or identify the actual duration of an uploaded video**.
Do not advertise this as verified watch time.

For higher-assurance certification, store media duration from trusted
server-side probing at upload time, add appropriately constrained player
seeking / watched segments, verify real browser playback quality, and
consider supervised or proctored assessments where required.
