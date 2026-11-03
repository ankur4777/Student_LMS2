# MySLS Portal Typography Refresh (Bento Option B)

This typography pass follows the approved Bento UI layout and is limited
to authenticated Student, Teacher and College Admin pages.

## Visual rules

- Native Windows-friendly type: Segoe UI Variable Text / Segoe UI with
  Inter and Arial fallback; no remote font downloads or new font files.
- Neutral 14px body with a 1.55 line-height.
- Welcome headlines 25–32px, moderate 685 weight rather than 800+.
- KPIs 26–33px, 705 weight with restrained letter spacing.
- Panel headings 16px and 680 weight, consistent title and subtitle rhythm.
- Sidebar navigation 13px, secondary labels 12–12.5px.
- Professional table/forms defaults; lecture/course text also updated.
- Responsive font sizing for phones.

The CSS lives in \`frontend/src/app/portal-typography.css\`. It is
imported after \`portal-bento.css\` in all three portal layouts. No
backend/API, route, authentication, value, navigation, or permissions
change is part of this commit. Login pages and public marketing pages
are intentionally out of scope.

## Validate locally

\`\`\`powershell
cd C:\student_LMS
git switch feature/recorded-learning-certificates
git pull --ff-only origin feature/recorded-learning-certificates
cd frontend
npm run build
npm run dev
\`\`\`

Compare authenticated dashboards for Student, Teacher, and College Admin
at 1440px and 390px wide. Inspect attendance and fee donut text, KPI
currency wrapping, the Student Learning Center, forms, charts, class
tables, sidebar labels and popup controls for readable text and clipping.

The screenshots previously supplied by the user show the College Admin
dashboard before this typography pass. The update has not been tested
in their local browser at commit time; visual acceptance remains pending.
