# Phase 24 — Genuine Video Playback Verification (Local QA)

Phase 23 is verified: **76 Django regression tests passed** and the
complete API journey test passed. Phase 22's **6 frontend fixture tests**
also passed. Those results do **not** establish that a real MP4 plays in
Chrome with the correct watch timing.

## Automated test added

`recordedcourses.test_learning_real_video` generates a genuine 3-second,
H.264 MP4 using installed FFmpeg; the application's real ffprobe checks
its duration. It then exercises the normal College Admin lesson-upload
endpoint, confirms private storage and authorized byte-for-byte streaming,
and tests unauthorized/other-tenant access, session metadata, premature
completion, mismatched reported duration, and the organization master switch.

There are **no mocked video-duration checks** in this new test. It uses
Django's isolated test database and a disposable temporary storage folder.
The 3-second clip is for rapid API verification, not a real-time Chrome
viewing test; no backend watch-time settings are weakened.

### Run in Windows 10 / VS Code PowerShell

Before running, confirm your database settings target the **local database
server**, not your live VPS/database. Django will create a separate test
database on that configured server.

```powershell
cd C:\student_LMS
git pull --ff-only origin feature/recorded-learning-certificates
ffmpeg -version
ffprobe -version
python manage.py test recordedcourses.test_learning_real_video --noinput --verbosity 2
```

If FFmpeg/ffprobe are unavailable, install them in Windows and add their
`bin` directory to your system PATH; restart VS Code. The real-media
test will fail with a clear dependency message rather than silently skip.

On a pass, run this larger focused suite:

```powershell
python manage.py test recordedcourses.test_learning_real_video recordedcourses.test_learning_journey recordedcourses.test_student_learning --noinput
```

## Manual browser test with genuinely watchable video

Do these steps **only** against a disposable organization on the local
Django + Next.js instance, not DU or production.

1. Prepare a longer, genuinely watchable H.264 test video (18 seconds) in
   your Windows temporary folder. This file is not committed to Git:

   ```powershell
   ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=320x180:rate=15" -t 18 -an -c:v libx264 -pix_fmt yuv420p -movflags +faststart "$env:TEMP\mysls-local-qa.mp4"
   ffprobe -v error -show_entries format=duration:stream=codec_type -of json "$env:TEMP\mysls-local-qa.mp4"
   ```

2. Use a **local** Platform Admin to enable Learning & Certification for a
   dedicated disposable QA organization. Keep DU disabled.
3. Sign in as that organization's College Admin. Create a QA recorded
   course and a published module; upload the generated MP4 and confirm
   the server-verified duration is about 18 seconds.
4. Assign a local QA teacher, create and publish a quiz, an assignment,
   and a final exam. Enroll a disposable student (manual enrollment).
5. Sign in as the QA Student. Open `/student/learning`, select the course,
   click Play, and watch continuously. Check the video plays normally,
   reports heartbeats, and becomes completed only after sufficient
   progress. Attempt immediate completion or jumping ahead and verify
   that the backend blocks it.
6. Pass the quiz, submit the assignment, grade it as the assigned Teacher,
   then verify module/final-exam unlocking. Pass the final, download the
   certificate, visit public verification, and verify revocation status.
7. Open DevTools → Network, filter for `learning/student/lessons`, and
   record response status codes only. Never copy access tokens, signed
   viewing tickets, or real student details into test reports.
8. Disable the QA organization's Learning feature when testing ends.
   Verify the legacy paid recorded-course flow is unchanged.

### Explicit acceptance boundary

- An API test with a real video file is **not** a real-time video player test.
- Student video progress is session-backed but is not proof of attention.
- The feature is **not production-ready solely on the basis of these tests**.
  Finish the manual browser acceptance checklist and check deployments
  independently before considering a merge into `main`.
