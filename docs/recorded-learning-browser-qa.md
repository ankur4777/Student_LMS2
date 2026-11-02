# MySLS Recorded Learning — Browser Acceptance Checklist

Use a **local, disposable test organization**. Learning & Certification is
**OFF by default** and must remain **OFF for DU**. Never follow this checklist
against the live production VPS or an organization with real student records.

Automated API journey: `python manage.py test recordedcourses.test_learning_journey`.
That test validates API authorization and the complete learning sequence, but it
does **not** drive a real browser or prove Chrome video playback timing.

## Prepare (local development only)

1. Pull the feature branch after checking for local working-tree changes:
   `git pull --ff-only origin feature/recorded-learning-certificates`.
2. Confirm `python manage.py check`; run the backend (`python manage.py runserver`)
   and frontend (`cd frontend && npm run dev`) in separate VS Code terminals.
3. Sign in with local test-role users for a dedicated QA organization: College Admin,
   assigned Teacher, Student and a separate organization College Admin.
4. Only a MySLS Platform Admin can enable Learning & Certification for the QA
   organization. Verify the DU organization's toggle remains disabled.
5. Prepare a **real, short MP4/WebM video**, notes/PDF and a sample assignment answer.
   Do not use the placeholder bytes from automated integration tests.

## College Admin — recorded course

- [ ] Open `http://localhost:3000/college-admin/recorded-courses`.
- [ ] Check `Learning & Certification Analytics` appears for the QA organization.
- [ ] Create a course with a unique QA title, price and access duration.
- [ ] Click **Manage** and create two sequential published learning modules.
- [ ] Upload the real video to both modules; check server-verified durations.
- [ ] Assign a Teacher; add any notes or learning resources.
- [ ] Teacher authors a quiz and assignment in module one, with valid questions.
- [ ] College Admin publishes the quiz, assignment and final course exam.
- [ ] Check readiness; address any missing-video or exam warnings.
- [ ] Manually enroll a test student; verify the student entitlement is active.

## Student and Teacher — complete learning flow

- [ ] Student opens Learning Center and sees the enrolled course.
- [ ] Student sees module one but module two is locked.
- [ ] Play module-one video continuously. Confirm progress ticks forward,
      session heartbeats are accepted and **Complete** only succeeds after
      enough watch progress (not by jumping straight to the end).
- [ ] Attempt to skip to module two or final exam; confirm blocked.
- [ ] Pass module-one quiz. Confirm answer key is never exposed to student.
- [ ] Submit module-one assignment; next module remains locked.
- [ ] Assigned Teacher grades submission; confirm unassigned teacher cannot grade.
- [ ] Module two unlocks; watch video and complete its required work.
- [ ] Final exam unlocks. Submit correct answers once and pass.
- [ ] Download certificate PDF; use QR / public verification page.
- [ ] Verify certificate details, score and organization are correct.

## Reporting, security and negative checks

- [ ] College Admin course-progress dashboard shows 100% module completion.
- [ ] Export **Course Progress CSV**; open in Excel and check fields.
- [ ] Certificate registry lists the issued certificate; filter/search and export CSV.
- [ ] Organization analytics counts enrollments, passing finals and certificates.
- [ ] Export organization analytics CSV, with and without a course-title filter;
      totals must match the displayed per-course figures.
- [ ] Different organization College Admin must not see the QA course or its
      analytics; Teacher cannot use College Admin-only registry/export.
- [ ] Revoke QA certificate with a reason. Public verification must show revoked;
      original PDF URL should return 410 for the student.
- [ ] Disable Learning & Certification for the QA organization after testing;
      verify DU and the legacy recorded-course purchase flows were not altered.

## Test recording

Record the test organization's name (not real student data), local time,
browser and console errors, API response codes, and any screenshots of failure.
Do **not** submit passwords, tokens, Django SECRET_KEY or real student records.
