import { test, expect } from "@playwright/test";

// The course, module assessments, and student identity are entirely simulated.
// Route mocks intercept API requests; no real attempts or submissions are made.
const COURSE = "/api/recorded-courses/learning/student/courses/901/";
const QUIZ = "/api/recorded-courses/learning/student/modules/11/quiz/";
const ASSIGNMENT = "/api/recorded-courses/learning/student/modules/11/assignment/";
const lesson = {
  id: 9011, title: "QA Recorded Lecture", description: "",
  position: 1, completed: true, completion_method: "signed_session",
  verified_duration_seconds: 40,
};
const questions = [
  { id: 611, prompt: "QA Module Question 1", choices: [
    { index: 0, text: "First wrong choice" }, { index: 1, text: "First right choice" },
  ] },
  { id: 612, prompt: "QA Module Question 2", choices: [
    { index: 0, text: "Second right choice" }, { index: 1, text: "Second wrong choice" },
  ] },
];
const quiz = () => ({
  id: 91, title: "QA Module Quiz", passing_percent: 70,
  max_attempts: 2, attempts_used: 0, attempts_remaining: 2,
  passed: false, best_score_percent: null, unlocked: true,
});
const assignment = () => ({
  id: 92, title: "QA Module Assignment", instructions: "Explain your approach.",
  passing_percent: 70, max_attempts: 2,
  attempts_used: 0, attempts_remaining: 2, passed: false, unlocked: true,
  pending_review: false, latest_submission: null,
});
const course = fixture => ({
  id: 901, title: "QA Assessments Course", description: "Only mock browser fixtures",
  completed_lessons: 1, total_lessons: 1, final_exam: null,
  modules: [{
    id: 11, title: "QA Assessments Module", description: "", position: 1,
    locked: false, completed: fixture.q.passed && fixture.a.passed,
    completed_lessons: 1, total_lessons: 1, lessons: [lesson],
    resources: [], quiz: fixture.q, assignment: fixture.a,
  }],
});
function freshFixture(overrides = {}) {
  return {
    q: quiz(), a: assignment(),
    quizGet: 200, quizPost: 201, assignmentGet: 200, assignmentPost: 201,
    failQuizRefresh: false, failAssignmentRefresh: false,
    quizPosts: [], assignmentPosts: [],
    ...overrides,
  };
}
function cors(route) {
  return {
    "Access-Control-Allow-Origin": route.request().headers().origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

async function setup(page, fixture) {
  await page.addInitScript(() => {
    localStorage.setItem("student_access_token", "qa-module-assessment-token");
    localStorage.setItem("student_user", JSON.stringify({
      id: 700, name: "QA Module Student", organization: "QA Campus",
    }));
    localStorage.removeItem("student_refresh_token");
  });

  await page.route(url => url.pathname.includes("/api/"), async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const headers = cors(route);
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (path === COURSE && method === "GET") {
      await route.fulfill({ status: 200, headers, json: { course: course(fixture) } });
      return;
    }
    if (path === QUIZ && method === "GET") {
      await route.fulfill(fixture.quizGet === 200
        ? { status: 200, headers, json: {
          quiz: fixture.q, questions: fixture.q.passed || !fixture.q.attempts_remaining ? [] : questions,
        } }
        : { status: fixture.quizGet, headers, json: { detail: "QA quiz service unavailable" } });
      return;
    }
    if (path === QUIZ && method === "POST") {
      const body = route.request().postDataJSON();
      fixture.quizPosts.push(body);
      if (fixture.quizPost !== 201) {
        await route.fulfill({
          status: fixture.quizPost, headers,
          json: { detail: "QA quiz submission rejected without recording an attempt" },
        });
        return;
      }
      const score = 100;
      fixture.q = {
        ...fixture.q, attempts_used: fixture.q.attempts_used + 1,
        attempts_remaining: Math.max(0, fixture.q.attempts_remaining - 1),
        passed: true, best_score_percent: score,
      };
      await route.fulfill({ status: 201, headers, json: {
        quiz: fixture.q, attempt: { score_percent: score, passed: true },
      } });
      if (fixture.failQuizRefresh) fixture.quizGet = 503;
      return;
    }
    if (path === ASSIGNMENT && method === "GET") {
      await route.fulfill(fixture.assignmentGet === 200
        ? { status: 200, headers, json: { assignment: fixture.a } }
        : { status: fixture.assignmentGet, headers, json: { detail: "QA assignment service unavailable" } });
      return;
    }
    if (path === ASSIGNMENT && method === "POST") {
      fixture.assignmentPosts.push(route.request().postData() || "");
      if (fixture.assignmentPost !== 201) {
        await route.fulfill({
          status: fixture.assignmentPost, headers,
          json: { detail: "QA assignment was not submitted" },
        });
        return;
      }
      fixture.a = {
        ...fixture.a, attempts_used: fixture.a.attempts_used + 1,
        attempts_remaining: Math.max(0, fixture.a.attempts_remaining - 1),
        pending_review: true,
        latest_submission: {
          score_percent: null, feedback: "", graded_at: null,
        },
      };
      await route.fulfill({ status: 201, headers, json: { submission: {
        id: 555, attempt_number: fixture.a.attempts_used, graded_at: null,
      } } });
      if (fixture.failAssignmentRefresh) fixture.assignmentGet = 503;
      return;
    }
    if (path.endsWith("/api/recorded-courses/learning/student/lessons/9011/play/")) {
      await route.fulfill({ status: 200, headers, contentType: "video/webm",
        body: "qa-fixture-video-not-real" });
      return;
    }
    if (path.endsWith("/api/recorded-courses/learning-access/")) {
      await route.fulfill({ status: 200, headers, json: { can_use_learning_center: true } });
      return;
    }
    if (path.endsWith("/api/academics/student/feature-access/")) {
      await route.fulfill({ status: 200, headers, json: { features: { recorded_courses: true } } });
      return;
    }
    if (path.endsWith("/api/accounts/organization-branding/")) {
      await route.fulfill({ status: 200, headers, json: { name: "QA Campus", logo: "" } });
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
    if (path.endsWith("/api/live-classes/student/today/")) {
      await route.fulfill({ status: 200, headers, json: [] });
      return;
    }
    await route.fulfill({ status: 404, headers, json: { detail: "No assessment QA fixture" } });
  });
}
const quizSection = page => page.getByRole("region", { name: "Module quiz" });
const assignmentSection = page => page.getByRole("region", { name: "Module assignment" });

test.describe("Student module quiz and assignment UI (mocked QA)", () => {
  test("Quiz recovers from a temporary GET error before accepting answers", async ({ page }) => {
    const f = freshFixture({ quizGet: 503 });
    await setup(page, f);
    await page.goto("/student/learning/901");

    await expect(quizSection(page).getByRole("alert")).toContainText("QA quiz service unavailable");
    await expect(quizSection(page).getByRole("button", { name: "Submit answers" })).toHaveCount(0);
    f.quizGet = 200;
    await quizSection(page).getByRole("button", { name: "Retry loading quiz" }).click();
    await expect(quizSection(page).getByText("QA Module Question 1")).toBeVisible();
    await expect(quizSection(page).getByText("2 attempts remaining.")).toBeVisible();
    expect(f.quizPosts).toHaveLength(0);
  });

  test("Quiz keeps selected answers when POST is rejected and records only accepted attempts", async ({ page }) => {
    const f = freshFixture({ quizPost: 400 });
    await setup(page, f);
    await page.goto("/student/learning/901");

    const q = quizSection(page);
    const send = q.getByRole("button", { name: "Submit answers" });
    await expect(send).toBeDisabled();
    await q.getByLabel("First right choice").check();
    await expect(send).toBeDisabled();
    await q.getByLabel("Second right choice").check();
    await expect(send).toBeEnabled();

    await send.click();
    await expect(q.getByRole("alert")).toContainText("without recording an attempt");
    await expect(q.getByLabel("First right choice")).toBeChecked();
    await expect(q.getByLabel("Second right choice")).toBeChecked();
    expect(f.q.attempts_used).toBe(0);
    f.quizPost = 201;
    await send.click();
    await expect(q.getByRole("status").filter({ hasText: "Latest recorded quiz score" }))
      .toContainText("100%. Passed.");
    await expect(q).toContainText("Quiz passed! Best score: 100%");
    expect(f.quizPosts).toHaveLength(2);
    expect(f.quizPosts[1]).toEqual({ answers: { "611": 1, "612": 0 } });
  });

  test("A recorded quiz attempt is never misreported as failed when the next GET fails", async ({ page }) => {
    const f = freshFixture({ failQuizRefresh: true });
    await setup(page, f);
    await page.goto("/student/learning/901");
    const q = quizSection(page);
    await q.getByLabel("First right choice").check();
    await q.getByLabel("Second right choice").check();
    await q.getByRole("button", { name: "Submit answers" }).click();

    await expect(q.getByRole("status").filter({ hasText: "Latest recorded quiz score" }))
      .toContainText("100%. Passed.");
    await expect(q.getByRole("alert")).toContainText("Your quiz attempt was recorded");
    await expect(q.getByRole("button", { name: "Submit answers" })).toHaveCount(0);
    expect(f.quizPosts).toHaveLength(1);

    f.quizGet = 200;
    await q.getByRole("button", { name: "Retry loading quiz" }).click();
    await expect(q).toContainText("Quiz passed! Best score: 100%");
    expect(f.quizPosts).toHaveLength(1);
  });

  test("Assignment preserves draft after rejected POST, then awaits grading after accepted submission", async ({ page }) => {
    const f = freshFixture({ assignmentPost: 400, failAssignmentRefresh: true });
    await setup(page, f);
    await page.goto("/student/learning/901");
    const a = assignmentSection(page);
    const answer = a.getByRole("textbox", { name: "Written answer" });
    await answer.fill("QA written solution to module assignment");
    await a.getByRole("button", { name: "Submit assignment" }).click();
    await expect(a.getByRole("alert")).toContainText("QA assignment was not submitted");
    await expect(answer).toHaveValue("QA written solution to module assignment");
    expect(f.a.attempts_used).toBe(0);

    f.assignmentPost = 201;
    await a.getByRole("button", { name: "Submit assignment" }).click();
    await expect(a.getByRole("status").filter({ hasText: "Assignment submitted for teacher review" }))
      .toBeVisible();
    await expect(a.getByRole("alert")).toContainText("Your assignment was submitted");
    await expect(a.getByRole("button", { name: "Submit assignment" })).toHaveCount(0);
    expect(f.assignmentPosts).toHaveLength(2);
    expect(f.assignmentPosts[1]).toContain("QA written solution to module assignment");

    f.assignmentGet = 200;
    await a.getByRole("button", { name: "Retry loading assignment" }).click();
    await expect(a.getByText("Your submission is awaiting grading.")).toBeVisible();
    await expect(a.getByRole("button", { name: "Refresh grading status" })).toBeEnabled();
    expect(f.a.attempts_used).toBe(1);
  });

  test("Assignment checks teacher grading feedback and synchronizes module milestones", async ({ page }) => {
    const f = freshFixture({
      a: {
        ...assignment(), attempts_used: 1, attempts_remaining: 1, pending_review: true,
        latest_submission: { score_percent: null, feedback: "", graded_at: null },
      },
      q: { ...quiz(), passed: true, attempts_used: 1, attempts_remaining: 1, best_score_percent: 90 },
    });
    await setup(page, f);
    await page.goto("/student/learning/901");
    const a = assignmentSection(page);
    await expect(a.getByText("Your submission is awaiting grading.")).toBeVisible();
    const milestones = page.getByRole("region", { name: "Learning milestones and certification" });
    await expect(milestones.getByText("0 of 1 completed")).toBeVisible();

    f.a = {
      ...f.a, pending_review: false, passed: true,
      latest_submission: { score_percent: 88, feedback: "Good analysis and citations.",
        graded_at: "2026-11-09T10:00:00Z" },
    };
    await a.getByRole("button", { name: "Refresh grading status" }).click();
    await expect(a.getByText("Assignment passed.")).toBeVisible();
    await expect(a.getByRole("status").filter({ hasText: "Latest teacher grade" }))
      .toContainText("Latest teacher grade: 88%");
    await expect(a.getByText("Good analysis and citations.")).toBeVisible();
    await expect(milestones.getByText("1 of 1 completed")).toBeVisible();
    await expect(milestones.getByRole("status")).toContainText(
      "All modules are complete. The final exam has not been published yet.",
    );
  });
});
