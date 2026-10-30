# MySLS Phase 13 — Verified Lesson Video Duration

**Branch:** `feature/recorded-learning-certificates` only.
Do not merge to `main` or deploy the VPS as part of these local checks.

## Backend dependency

The Python requirements file is unchanged. For new module video uploads
the backend host must have the **ffprobe** executable (part of FFmpeg)
available on its process PATH.

On the Windows 10 development laptop, install FFmpeg from its official
distribution or a trusted Windows package manager. Restart VS Code after
updating the system PATH, then confirm:

```powershell
where.exe ffprobe
ffprobe -version
```

If ffprobe is missing, a new Learning Center module upload responds with
HTTP **503**, and the lesson is not created. Unsupported or corrupt videos
return **400**. MP4, WebM, and MOV are allowed (maximum 512 MB, 8-hour
duration). The legacy paid-course upload API is not changed.

## Pull, migrate, and test locally

```powershell
cd C:\student_LMS
git status
git pull --ff-only origin feature/recorded-learning-certificates

python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate recordedcourses --plan
```

Verify the connected database is **local** before applying the
additive `0013_verified_lesson_duration` migration:

```powershell
python manage.py migrate recordedcourses
python manage.py test recordedcourses.test_learning_media recordedcourses.test_learning_content recordedcourses.test_student_learning recordedcourses.test_learning_readiness recordedcourses.test_learning_enrollments
cd frontend
npm run build
```

## Staff and student smoke checks

1. Locally enable Learning & Certification for a test organization only.
2. Sign in as College Admin or an assigned Teacher, open a module, upload a
   genuine MP4, WebM or MOV. The lesson should show a positive **Verified**
   duration extracted by the backend, not entered by the uploader.
3. Attempt a bad/unsupported video: HTTP 400 and **no** lesson creation.
   Remove ffprobe from test PATH (only in a disposable environment): HTTP
   503 rather than silently accepting uninspected video.
4. Existing module videos remain unverified after migration (`NULL`)
   until staff choose **Verify duration** beside the video. That action
   reads the existing private file, uses the same ffprobe checks, and
   does not expose a file path or downloadable URL.
5. The Course Readiness panel flags active published videos with unverified
   durations. The panel is advisory; it does not itself stop legacy
   learners from completing the exam.
6. As a student, open a newly verified video. A playback ticket includes
   `verified_duration_seconds`; the course view labels the length
   **server-verified**. Heartbeat duration mismatches must return 400.
   A plausible reported position within the verified duration can accrue
   time only under the existing interval and session checks.
7. Check pre-existing lessons with `NULL` verified duration still play
   with Phase 12's browser-reported duration fallback (weaker evidence).
   Existing progress and issued certificates are not invalidated.

## Security limits

ffprobe inspects uploaded media locally with a temporary random filename,
a restricted allowed-extension list, a 25-second process timeout, and a
512 MB input cap. No shell or user-supplied URL is used.

The video duration is now trusted **only when it has been probed and
recorded by the server**. The video's playback position is still a
browser-reported signal and is not proof of attention or anti-cheating
guarantee. Older, unverified videos use the legacy fallback intentionally.
High-assurance certification requires further safeguards.
