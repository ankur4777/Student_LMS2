# MySLS Bento UI — Navigation & Dashboard Polish

This is a frontend-only refinement for the approved Option B layout across
College Admin, Teacher, and Student portals.

The shared \`portal-polish.css\` is imported after the existing Bento
and typography styles in each portal layout. It improves the visual
system without changing course access rules, totals, API calls, role
sessions or destination URLs.

## Changes

- Green active navigation/icon styling matching the light sage Bento cards.
- Consistent card heights, compact but readable spacing, softer hover states.
- Attendance donut switched to sage; fee donut to muted coral.
- Softer analytics bar charts, balanced action tile sizes, longer names wrap.
- Adaptive admin dashboard: two columns at typical laptop widths, one
  column on narrow tablets, two quick-action tiles on small phones.
- Analytics and institution snapshot grid reflow without horizontal clipping.
- Student and Teacher class cards and course titles get consistent text wrapping.
- Mobile sidebar backdrops are now native Close navigation buttons instead
  of divs, the menu button reports its expanded state and target, active links
  expose aria-current, and Escape closes the drawer.

No new dependencies, images, migrations or production assets are introduced.

## Local review

Use the local feature branch (do not deploy this commit):

\`\`\`powershell
cd C:\student_LMS
git status --short
git pull --ff-only origin feature/recorded-learning-certificates
cd frontend
npm run build
npm run dev
\`\`\`

Review:
- \`/student/dashboard\` and \`/student/learning\`
- \`/teacher/dashboard\`
- \`/college-admin/dashboard\`

Check 1440, 1366, 1024, 768 and 390px screens. Inspect charts, summary
numbers, quick actions, menu active states, keyboard Escape and Tab focus.
Existing feature permissions and all API endpoints must remain functional.
Run the Playwright fixture tests again separately if needed.

**Verification:** This change is committed to the feature branch, but a
successful Next.js build and visual checks on the local Windows environment
are required before any merge or production deployment.
