# MySLS Recorded Learning – Local QA (Phase 11)

This checklist applies **only** to branch `feature/recorded-learning-certificates`.
Do not apply unfinished changes to `main` or a production VPS.

## Setup

In VS Code PowerShell:

```powershell
cd C:\student_LMS
git status
git pull --ff-only origin feature/recorded-learning-certificates
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test recordedcourses.test_student_learning recordedcourses.test_module_assignments recordedcourses.test_learning_enrollments recordedcourses.test_learning_finals recordedcourses.test_learning_readiness
cd frontend
npm run build
```

Phase 11 requires migration `0011_lesson_completion_method`. Review the
local database connection and migration plan before applying it:

```powershell
cd C:\student_LMS
python manage.py migrate recordedcourses --plan
python manage.py migrate recordedcourses
```

Older progress records remain `learner_reported`; new ticket-backed completions
record `signed_session` for reporting. Neither proves attentive watching.

## Local portal smoke test

1. Enable the organization's **Learning & Certification** setting in the
   local Platform Admin / Django admin. Enable the class feature
   `recorded_courses` for the test student. Do **not** enable production.
2. Sign in as College Admin and create a course/module with an actual
   uploaded video. Publish module and any required module quiz/assignment,
   then configure the final exam.
3. Assign the course to the test student under the College Admin's
   Enrollment panel (no purchase). Confirm an existing paid enrollment
   cannot be modified by the manual workflow.
4. Sign in as the student and open **My Learning**. Confirm the assigned
   course and permitted videos appear.
5. **Direct POST to /complete/ with no playback ticket must return 400**
   for an incomplete, authorized lesson.
6. Begin video playback. The browser should call the viewing-session
   endpoint. An immediate completion POST using that ticket must return
   400 until at least 10 seconds have passed on the server.
7. After the playback event ends, submit the ticket; completion should
   return 200 with `completion_type=learner_reported_with_session`.
   Repeated completion of the *same completed lesson* remains idempotent.
8. Confirm a ticket is rejected when modified, used for a different lesson,
   or used by another student. Revoked/expired course access must block
   session creation and completion.
9. Complete all required module quizzes/assignments and have College Admin
   grade assignments. Confirm later modules and the final exam unlock only
   after their prerequisites are met.
10. Pass the final exam and download the PDF certificate. Verify QR/status
    on the public verification page. The certificate remains downloadable
    by its owner if course access is later revoked, unless the certificate
    itself is revoked.

## Known security limits

- A signed session validates **student identity, lesson ID, organization,
  expiry, and minimum elapsed server time**. It does **not** cryptographically
  prove attentive viewing, prevent seeking, or establish watch duration.
- The lesson completion state remains explicitly **learner-reported**.
  Certification also requires passing quizzes, graded assignments and the
  final exam.
- The session minimum is currently 10 seconds. For clips shorter than that,
  completing immediately at video end may be rejected; play/replay after
  the minimum interval. Later work should use trusted media duration and
  server-observed watch milestones before any high-assurance certification.
- Access permissions are checked on **both session creation and completion**.
  Legacy purchased-recording endpoints remain separate.
