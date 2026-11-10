import { test, expect } from "@playwright/test";

// Every API route is mocked. The tests run against the real Next.js Teacher UI,
// never a production teacher account or student submission.
const ROOT = "/api/recorded-courses/learning/manage/";
const ASSIGN = ROOT + "modules/11/assignment/";
const SUBS = ASSIGN + "submissions/";
const gradePath = id => ROOT + "submissions/" + id + "/grade/";
const seed = [
  {
    id: 501, student_name: "QA Pending Alice", answer_text: "Draft on the topic",
    has_file: true, attempt_number: 1, score_percent: null,
    feedback: "", graded_at: null,
  },
  {
    id: 502, student_name: "QA Graded Bob", answer_text: "Submitted a report",
    has_file: false, attempt_number: 1, score_percent: 86,
    feedback: "Clear research", graded_at: "2026-11-08T10:30:00Z",
  },
  {
    id: 503, student_name: "QA Pending Charlie", answer_text: "An alternative solution",
    has_file: false, attempt_number: 2, score_percent: null,
    feedback: "", graded_at: null,
  },
];
function learnerRow(id, name, completed, total, viewed, certificate, { awaiting = false, active = true } = {}) {
  return {
    student_id: id, student_name: name, admission_number: `QA-${id}`,
    access_active: active, modules_completed: completed, modules_total: total,
    lectures_viewed: viewed, lectures_total: 4, session_backed_lectures: viewed,
    progress_percent: total ? Math.round(100 * completed / total) : 0,
    final_exam_best_percent: certificate === "issued" ? 90 : null,
    final_exam_passed: certificate === "issued",
    certificate_status: certificate,
    modules: [{ id: 11, position: 1, title: "QA Module", completed: completed === total,
      lectures_viewed: viewed, lectures_total: 4, session_backed_lectures: viewed,
      quiz_status: "not_required", quiz_best_percent: null,
      assignment_status: awaiting ? "awaiting_review" : "not_required",
      assignment_best_percent: null }],
  };
}
const progressSeed = [
  learnerRow(201, "QA Alice", 0, 2, 0, "not_issued"),
  learnerRow(202, "QA Bob", 1, 2, 2, "revoked", { awaiting: true }),
  learnerRow(203, "QA Charlie", 2, 2, 4, "issued"),
  learnerRow(204, "QA Dana", 1, 2, 1, "not_issued", { active: false }),
  learnerRow(205, "QA Eve", 0, 2, 0, "issued"),
];
function fixture(overrides = {}) {
  return {
    assignment: {
      id: 770, title: "QA Lab Assignment", instructions: "Review the lesson.",
      passing_percent: 70, max_attempts: 3, is_published: true, submission_count: 3,
    },
    submissions: seed.map(value => ({ ...value })),
    submissionsGet: 200, assignmentGet: 200, gradeStatus: 200,
    failRefreshAfterGrade: false, grades: [],
    progressRows: [], progressStatus: 200, progressMalformed: false,
    progressRequests: [], csvRequests: [],
    ...overrides,
  };
}
const cors = route => ({
  "Access-Control-Allow-Origin": route.request().headers().origin || "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
});

async function setup(page, data) {
  await page.addInitScript(() => {
    localStorage.setItem("teacher_access_token", "qa-teacher-grading-only");
    localStorage.setItem("teacher_user", JSON.stringify({
      id: 21, name: "QA Assignment Teacher", organization: "QA Campus",
    }));
    localStorage.removeItem("teacher_refresh_token");
  });
  await page.route(url => url.pathname.includes("/api/"), async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const headers = cors(route);
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (path.endsWith("/api/recorded-courses/learning-access/")) {
      await route.fulfill({ status: 200, headers, json: { can_use_learning_center: true } });
      return;
    }
    if (path === ROOT + "courses/911/modules/") {
      await route.fulfill({ status: 200, headers, json: {
        course: { id: 911, title: "QA Learning Course" },
        modules: [{
          id: 11, course_id: 911, title: "QA Module", description: "",
          position: 1, is_published: true, lesson_count: 1, resource_count: 0,
        }],
      } });
      return;
    }
    if (path === ROOT + "modules/11/resources/") {
      await route.fulfill({ status: 200, headers, json: { resources: [] } });
      return;
    }
    if (path === ROOT + "modules/11/lessons/") {
      await route.fulfill({ status: 200, headers, json: { lessons: [] } });
      return;
    }
    if (path === ASSIGN && method === "GET") {
      await route.fulfill(data.assignmentGet === 200
        ? { status: 200, headers, json: { assignment: data.assignment } }
        : { status: data.assignmentGet, headers, json: { detail: "QA assignment settings unavailable" } });
      return;
    }
    if (path === SUBS && method === "GET") {
      await route.fulfill(data.submissionsGet === 200
        ? { status: 200, headers, json: { submissions: data.submissions } }
        : { status: data.submissionsGet, headers, json: { detail: "QA submissions list unavailable" } });
      return;
    }
    const gradeMatch = path.match(/\/learning\/manage\/submissions\/(\d+)\/grade\/$/);
    if (gradeMatch && method === "PATCH") {
      const id = Number(gradeMatch[1]);
      const submitted = route.request().postDataJSON();
      data.grades.push({ id, ...submitted });
      if (data.gradeStatus !== 200) {
        await route.fulfill({
          status: data.gradeStatus, headers,
          json: { detail: "QA grade rejected without saving" },
        });
        return;
      }
      data.submissions = data.submissions.map(s => s.id === id ? {
        ...s, score_percent: submitted.score_percent,
        feedback: submitted.feedback, graded_at: "2026-11-09T10:00:00Z",
      } : s);
      await route.fulfill({ status: 200, headers, json: {
        submission: data.submissions.find(s => s.id === id),
      } });
      if (data.failRefreshAfterGrade) data.submissionsGet = 503;
      return;
    }
    if (path === ROOT + "modules/11/quiz/") {
      await route.fulfill({ status: 200, headers, json: { quiz: null } });
      return;
    }
    if (path === ROOT + "courses/911/final-exam/") {
      await route.fulfill({ status: 200, headers, json: { exam: null } });
      return;
    }
    // These staff responses are simulated; no personal student data is accessed.
    if (path === ROOT + "courses/911/progress/" && method === "GET") {
      const pageNumber = Number(url.searchParams.get("page") || "1");
      const search = (url.searchParams.get("search") || "").toLocaleLowerCase();
      data.progressRequests.push({ page: pageNumber, search });
      if (data.progressStatus !== 200 || data.progressMalformed) {
        await route.fulfill({
          status: data.progressStatus, headers,
          json: data.progressMalformed ? {} : { detail: "QA progress endpoint unavailable" },
        });
        return;
      }
      const matching = data.progressRows.filter(student =>
        (student.student_name + " " + student.admission_number).toLocaleLowerCase().includes(search));
      const pageSize = 4;
      const start = (pageNumber - 1) * pageSize;
      await route.fulfill({ status: 200, headers, json: {
        students_total: matching.length, page: pageNumber, page_size: pageSize,
        has_next: start + pageSize < matching.length,
        students: matching.slice(start, start + pageSize),
      } });
      return;
    }
    if (path === ROOT + "courses/911/progress/export.csv" && method === "GET") {
      data.csvRequests.push(Object.fromEntries(url.searchParams));
      const search = (url.searchParams.get("search") || "").toLocaleLowerCase();
      const matches = data.progressRows.filter(student =>
        (student.student_name + " " + student.admission_number).toLocaleLowerCase().includes(search));
      await route.fulfill({
        status: 200, headers: { ...headers, "Content-Disposition": 'attachment; filename="mysls-progress.csv"' },
        contentType: "text/csv", body: "Student Name,Certificate Status\n" +
          matches.map(student => `${student.student_name},${student.certificate_status}`).join("\n") + "\n",
      });
      return;
    }
    if (path === ROOT + "courses/911/readiness/") {
      await route.fulfill({ status: 200, headers, json: {
        ready_for_final_exam: false, checks: [], warnings: [],
        modules: [], enrollments: {
          active: 0, manual_active: 0, purchased_active: 0, expired: 0,
          revoked: 0, pending_grading: 2, issued_certificates: 0,
        },
      } });
      return;
    }
    if (path.endsWith("/api/notifications/unread-count/")) {
      await route.fulfill({ status: 200, headers, json: { unread_count: 0 } });
      return;
    }
    if (path.endsWith("/api/notifications/")) {
      await route.fulfill({ status: 200, headers, json: { notifications: [] } });
      return;
    }
    if (path.endsWith("/api/accounts/organization-branding/")) {
      await route.fulfill({ status: 200, headers, json: { name: "QA Campus", logo: "" } });
      return;
    }
    await route.fulfill({ status: 200, headers, json: {} });
  });
}

async function openAssignment(page) {
  await page.goto("/teacher/recorded-courses/911");
  const editor = page.getByRole("region", { name: "Course modules and learning resources" });
  // Course editor prefixes module names with their position (e.g. "1. QA Module").
  await expect(editor.getByText("1. QA Module", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Manage content" }).click();
  const section = page.getByRole("region", { name: "Module assignments" });
  await expect(section.getByText("Student submissions (3)")).toBeVisible();
  return section;
}
const submission = (section, id, student) =>
  section.getByRole("article", { name: `Submission ${id} by ${student}` });

test.describe("Teacher module assignment grading UI (mocked QA)", () => {
  test("shows accurate pending and graded counts with working submission filters", async ({ page }) => {
    const f = fixture();
    await setup(page, f);
    const section = await openAssignment(page);
    await expect(section.getByLabel("Submission grading counts")).toContainText("Pending: 2 · Graded: 1");
    await expect(section.getByRole("article")).toHaveCount(3);
    const filter = section.getByRole("combobox", { name: "Show" });
    await filter.selectOption("pending");
    await expect(section.getByRole("article")).toHaveCount(2);
    await expect(submission(section, 501, "QA Pending Alice")).toBeVisible();
    await expect(submission(section, 502, "QA Graded Bob")).toHaveCount(0);
    await filter.selectOption("graded");
    await expect(submission(section, 502, "QA Graded Bob")).toBeVisible();
    await expect(section.getByRole("article")).toHaveCount(1);
    await filter.selectOption("all");
    await expect(section.getByRole("article")).toHaveCount(3);
  });

  test("searches the grading queue by student and restores filters", async ({ page }) => {
    const f = fixture();
    await setup(page, f);
    const section = await openAssignment(page);
    const search = section.getByRole("searchbox", { name: "Search student submissions" });
    const gradeFilter = section.getByRole("combobox", { name: "Show" });
    const sort = section.getByRole("combobox", { name: "Sort submissions" });

    await search.fill("aLiCe");
    await expect(section.getByRole("article")).toHaveCount(1);
    await expect(submission(section, 501, "QA Pending Alice")).toBeVisible();
    await expect(section.getByText("Showing 1 of 3 submissions")).toBeVisible();

    await gradeFilter.selectOption("graded");
    await expect(section.getByRole("article")).toHaveCount(0);
    await expect(section.getByText("No submissions match your search or grading filter.")).toBeVisible();
    await expect(section.getByText("Showing 0 of 3 submissions")).toBeVisible();

    await sort.selectOption("student_asc");
    await section.getByRole("button", { name: "Clear filters" }).click();
    await expect(search).toHaveValue("");
    await expect(gradeFilter).toHaveValue("all");
    await expect(sort).toHaveValue("default");
    await expect(section.getByRole("article")).toHaveCount(3);
    await expect(section.getByRole("button", { name: "Clear filters" })).toBeDisabled();
  });

  test("sorts grading submissions without changing the server response or grades", async ({ page }) => {
    const f = fixture();
    await setup(page, f);
    const section = await openAssignment(page);
    const sort = section.getByRole("combobox", { name: "Sort submissions" });
    const cards = section.getByRole("article");

    await expect(cards.first()).toContainText("QA Pending Alice");
    await sort.selectOption("student_asc");
    await expect(cards.first()).toContainText("QA Graded Bob");
    await expect(cards.nth(1)).toContainText("QA Pending Alice");
    await expect(cards.nth(2)).toContainText("QA Pending Charlie");

    await sort.selectOption("pending_first");
    await expect(cards.first()).toContainText("QA Pending Alice");
    await expect(cards.nth(1)).toContainText("QA Pending Charlie");
    await expect(cards.nth(2)).toContainText("QA Graded Bob");

    await sort.selectOption("default");
    await expect(cards.first()).toContainText("QA Pending Alice");
    await expect(cards.nth(1)).toContainText("QA Graded Bob");
    expect(f.grades).toHaveLength(0);
  });

  test("rejects invalid grades and preserves feedback after an API rejection", async ({ page }) => {
    const f = fixture({ gradeStatus: 409 });
    await setup(page, f);
    const section = await openAssignment(page);
    const alice = submission(section, 501, "QA Pending Alice");

    await alice.getByRole("button", { name: "Grade", exact: true }).click();
    await expect(section.getByRole("alert")).toContainText("Enter an integer grade from 0–100.");
    expect(f.grades).toHaveLength(0);

    await alice.getByRole("spinbutton", { name: "Grade 0–100" }).fill("88");
    await alice.getByRole("textbox", { name: "Feedback" }).fill("Helpful reasoning");
    await alice.getByRole("button", { name: "Grade", exact: true }).click();
    await expect(section.getByRole("alert")).toContainText("QA grade rejected without saving");
    await expect(alice.getByRole("spinbutton", { name: "Grade 0–100" })).toHaveValue("88");
    await expect(alice.getByRole("textbox", { name: "Feedback" })).toHaveValue("Helpful reasoning");
    expect(f.grades).toHaveLength(1);
  });

  test("grades a pending submission once and updates the queue immediately", async ({ page }) => {
    const f = fixture();
    await setup(page, f);
    const section = await openAssignment(page);
    const alice = submission(section, 501, "QA Pending Alice");
    await alice.getByRole("spinbutton", { name: "Grade 0–100" }).fill("92");
    await alice.getByRole("textbox", { name: "Feedback" }).fill("Solid explanation");
    await alice.getByRole("button", { name: "Grade", exact: true }).click();

    await expect(section.locator(".alert-success[role='status']")).toContainText("Grade saved");
    await expect(alice.getByText("Grade: 92% · Solid explanation")).toBeVisible();
    await expect(alice.getByRole("button", { name: "Grade", exact: true })).toHaveCount(0);
    await expect(section.getByLabel("Submission grading counts")).toContainText("Pending: 1 · Graded: 2");
    expect(f.grades).toEqual([{ id: 501, score_percent: 92, feedback: "Solid explanation" }]);
  });

  test("keeps a confirmed grade when refreshing the submissions list fails", async ({ page }) => {
    const f = fixture({ failRefreshAfterGrade: true });
    await setup(page, f);
    const section = await openAssignment(page);
    const alice = submission(section, 501, "QA Pending Alice");
    await alice.getByRole("spinbutton", { name: "Grade 0–100" }).fill("78");
    await alice.getByRole("textbox", { name: "Feedback" }).fill("Needs examples");
    await alice.getByRole("button", { name: "Grade", exact: true }).click();

    await expect(section.locator(".alert-success[role='status']")).toContainText("Grade saved, but the submissions list could not refresh");
    await expect(section.getByRole("alert")).toHaveCount(0);
    await expect(alice.getByText("Grade: 78% · Needs examples")).toBeVisible();
    expect(f.grades).toHaveLength(1);

    f.submissionsGet = 200;
    await section.getByRole("button", { name: "Refresh submissions" }).click();
    await expect(section.locator(".alert-success[role='status']")).toContainText("Assignment and grading status refreshed.");
    await expect(alice.getByText("Grade: 78% · Needs examples")).toBeVisible();
    expect(f.grades).toHaveLength(1);
  });

  test("recovers from a temporarily unavailable assignment submissions endpoint", async ({ page }) => {
    const f = fixture({ submissionsGet: 503 });
    await setup(page, f);
    await page.goto("/teacher/recorded-courses/911");
    const editor = page.getByRole("region", { name: "Course modules and learning resources" });
    await expect(editor.getByText("1. QA Module", { exact: true })).toBeVisible();
    await editor.getByRole("button", { name: "Manage content" }).click();
    const section = page.getByRole("region", { name: "Module assignments" });
    await expect(section.getByRole("alert")).toContainText("QA submissions list unavailable");
    await expect(section.getByRole("button", { name: "Retry loading assignments" })).toBeVisible();

    f.submissionsGet = 200;
    await section.getByRole("button", { name: "Retry loading assignments" }).click();
    await expect(section.getByText("Student submissions (3)")).toBeVisible();
    await expect(section.getByLabel("Submission grading counts")).toContainText("Pending: 2 · Graded: 1");
  });
});


const progress = page => page.getByRole("region", { name: "Student course progress dashboard" });

test.describe("Teacher module assignment grading UI — learner progress dashboard (mocked QA)", () => {
  test("filters current-page progress, pending grading and certificate states", async ({ page }) => {
    const f = fixture({ progressRows: progressSeed });
    await setup(page, f);
    await page.goto("/teacher/recorded-courses/911");
    const section = progress(page);
    const rows = section.getByRole("table", { name: "Student course progress" }).locator("tbody tr");
    const progressFilter = section.getByRole("combobox", { name: "Filter learner progress (this page)" });
    const certificateFilter = section.getByRole("combobox", { name: "Filter certificates (this page)" });
    await expect(rows).toHaveCount(4);
    await expect(section.getByRole("status").filter({ hasText: "Showing 4 of 4 learners" }))
      .toContainText("Awaiting grading: 1");
    await expect(section.getByRole("status").filter({ hasText: "Showing 4 of 4 learners" }))
      .toContainText("Certificates issued: 1");

    await progressFilter.selectOption("awaiting_grading");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("QA Bob");
    await expect(rows.first().getByText("Awaiting grading")).toBeVisible();
    await certificateFilter.selectOption("issued");
    await expect(rows).toHaveCount(0);
    await expect(section.getByText("No learners match the current-page filters. Other pages may have matches.")).toBeVisible();
    await section.getByRole("button", { name: "Clear current-page filters" }).click();

    await progressFilter.selectOption("completed");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("QA Charlie");
    await progressFilter.selectOption("not_started");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("QA Alice");
    await progressFilter.selectOption("in_progress");
    await expect(rows).toHaveCount(2);
    await progressFilter.selectOption("inactive_access");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("QA Dana");
    await progressFilter.selectOption("all");
    await certificateFilter.selectOption("revoked");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("QA Bob");
    await expect(rows.first().getByText("Revoked")).toBeVisible();
    expect(f.progressRequests.length).toBe(1); // local filters never refetch the full course
  });

  test("sorts progress rows and paginates without confusing page-level counts", async ({ page }) => {
    const f = fixture({ progressRows: progressSeed });
    await setup(page, f);
    await page.goto("/teacher/recorded-courses/911");
    const section = progress(page);
    const rows = section.getByRole("table", { name: "Student course progress" }).locator("tbody tr");
    const sort = section.getByRole("combobox", { name: "Sort current page" });
    await expect(rows).toHaveCount(4);
    await sort.selectOption("progress_high");
    await expect(rows.first()).toContainText("QA Charlie");
    await sort.selectOption("progress_low");
    await expect(rows.first()).toContainText("QA Alice");
    await sort.selectOption("name");
    await expect(rows.nth(1)).toContainText("QA Bob");
    await section.getByRole("button", { name: "Next", exact: true }).click();
    await expect(section.getByText("Page 2", { exact: true })).toBeVisible();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("QA Eve");
    await expect(section.getByText("Showing 1 of 1 learners on this page", { exact: false })).toBeVisible();
    await expect(section.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await section.getByRole("button", { name: "Previous" }).click();
    await expect(rows).toHaveCount(4);
    expect(f.progressRequests.some(request => request.page === 2)).toBe(true);
  });

  test("keeps server search and CSV export independent from current-page filters", async ({ page }) => {
    const f = fixture({ progressRows: progressSeed });
    await setup(page, f);
    await page.goto("/teacher/recorded-courses/911");
    const section = progress(page);
    await expect(section.getByText("5 enrolled students")).toBeVisible();
    const search = section.getByRole("textbox", { name: "Search enrolled students" });
    await search.fill("Alice");
    await section.getByRole("button", { name: "Search", exact: true }).click();
    const rows = section.getByRole("table", { name: "Student course progress" }).locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("QA Alice");
    await section.getByRole("combobox", { name: "Filter learner progress (this page)" }).selectOption("completed");
    await expect(rows).toHaveCount(0);

    const downloadEvent = page.waitForEvent("download");
    await section.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe("mysls-course-911-progress.csv");
    expect(f.csvRequests).toEqual([{ search: "Alice" }]);
    await expect(section.getByText("Search and CSV export include all matching learners across pages.", { exact: false }))
      .toBeVisible();
  });

  test("recovers from invalid progress API data without crashing the Teacher page", async ({ page }) => {
    const f = fixture({ progressRows: progressSeed, progressMalformed: true });
    await setup(page, f);
    await page.goto("/teacher/recorded-courses/911");
    const section = progress(page);
    await expect(section.getByRole("alert")).toContainText("Course progress response is incomplete");
    await expect(page.getByRole("heading", { name: "Student Learning Progress" })).toBeVisible();
    f.progressMalformed = false;
    await section.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(section.getByRole("table", { name: "Student course progress" }).locator("tbody tr")).toHaveCount(4);
    await expect(section.getByRole("alert")).toHaveCount(0);
  });
});
