# MySLS — Option B: Bento Portal UI (feature-branch preview)

This is a **presentation-only** redesign on the
\`feature/recorded-learning-certificates\` branch. No production or \`main\`
changes, schema migrations, external CDNs, static stock assets, or route
renaming are part of this update.

## Scope

- Student portal: soft mint hero, asymmetric live-data summary tiles,
  clearer activity cards, pastel quick actions, refreshed Learning Center
  cards and lesson progress surfaces.
- Teacher portal: lavender welcome, live teaching KPIs, distinct class and
  assignment cards and the same navigation treatment.
- College Admin portal: warm-peach welcome, six varied-size KPI tiles,
  attendance/fees/analytics bento panels, restyled activity and shortcut tiles.
- Shared: calm neutral background, subtle glassy topbar, improved sidebar
  active states, rounded forms and table headers, consistent focus visibility,
  responsive grid breakpoints and reduced-motion behavior.

Existing feature-gated Student links, collapsed College Admin navigation,
API requests, actual statistics, auth/session handling and logout are retained.
The Parent portal, login pages, public site and storefront are unchanged.

The key file is \`frontend/src/app/portal-bento.css\`, imported after the
existing stylesheet in each of the three portal layouts. Main dashboard root
containers use \`mysls-bento-workspace\` to confine the asymmetric dashboard
layouts. Functional routes outside the dashboards get a compatible surface
treatment rather than disruptive JSX changes.

## Local review

\`\`\`powershell
cd C:\student_LMS
git status --short
git switch feature/recorded-learning-certificates
git pull --ff-only origin feature/recorded-learning-certificates
cd frontend
npm run build
npm run dev
\`\`\`

Review authenticated dashboards at
\`/student/dashboard\`, \`/teacher/dashboard\`, and
\`/college-admin/dashboard\`. Check navigation and the Learning Center with
disposable local accounts. Compare 1440px, tablet (768px) and mobile
(390px). Verify features hidden by academic access settings stay hidden.

The prior 6 Playwright UI fixture tests and 76 Django regression tests
have passed before this visual change; no new automated test pass is
claimed for the Bento redesign until these changes are built locally.
