import { test, expect } from "@playwright/test";

// Isolated frontend browser QA: every API call is intercepted, with no
// production users, exam attempts or certificate records accessed.
const coursePath = "/api/recorded-courses/learning/student/courses/901/";
const finalPath = "/api/recorded-courses/learning/student/courses/901/final-exam/";
const certID = "11111111-2222-4333-8444-555555555555";
const questions = [
  { id: 601, prompt: "QA Question A", choices: [
    { index: 0, text: "A wrong answer" }, { index: 1, text: "A correct answer" },
  ] },
  { id: 602, prompt: "QA Question B", choices: [
    { index: 0, text: "Another correct answer" }, { index: 1, text: "Another wrong answer" },
  ] },
];

function initialFinal(overrides = {}) {
  return {
    id: 77, title: "QA Final Examination", passing_percent: 70,
    max_attempts: 2, attempts_used: 0, attempts_remaining: 2,
    passed: false, unlocked: true, required_modules: 1,
    best_score_percent: null, certificate_id: null,
    ...overrides,
  };
}
function makeFixture(overrides = {}) {
  return {
    final: initialFinal(),
    getStatus: 200, submitStatus: 201, postCount: 0, submitted: [],
    passOnSubmit: false, failRefreshAfterPost: false, downloadCount: 0,
    ...overrides,
  };
}
const cors = route => ({
  "Access-Control-Allow-Origin": route.request().headers().origin || "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
});

async function setup(page, fixture) {
  await page.addInitScript(() => {
    localStorage.setItem("student_access_token", "browser-only-exam-token");
    localStorage.setItem("student_user", JSON.stringify({
      name: "QA Final Exam Student", organization: "QA Campus",
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
    if (path === coursePath && method === "GET") {
      await route.fulfill({ status: 200, headers, json: { course: {
        id: 901, title: "QA Exam Course", description: "Synthetic assessment course",
        modules: [], completed_lessons: 0, total_lessons: 0,
        final_exam: fixture.final,
      } } });
      return;
    }
    if (path === finalPath && method === "GET") {
      const status = fixture.getStatus;
      await route.fulfill(status === 200
        ? { status: 200, headers, json: {
          exam: fixture.final,
          questions: fixture.final.unlocked && !fixture.final.passed &&
            fixture.final.attempts_remaining > 0 ? questions : [],
        } }
        : { status, headers, json: { detail: "QA final exam temporarily unavailable" } });
      return;
    }
    if (path === finalPath && method === "POST") {
      fixture.postCount += 1;
      fixture.submitted.push(route.request().postDataJSON());
      if (fixture.submitStatus !== 201) {
        await route.fulfill({ status: fixture.submitStatus, headers, json: {
          detail: "QA answer submission rejected; no attempt was recorded",
        } });
        return;
      }
      const passed = fixture.passOnSubmit;
      const score = passed ? 100 : 50;
      fixture.final = {
        ...fixture.final,
        attempts_used: fixture.final.attempts_used + 1,
        attempts_remaining: Math.max(0, fixture.final.attempts_remaining - 1),
        passed, best_score_percent: score,
        certificate_id: passed ? certID : null,
      };
      await route.fulfill({ status: 201, headers, json: {
        exam: fixture.final, attempt: { score_percent: score, passed },
        certificate_id: fixture.final.certificate_id,
      } });
      if (fixture.failRefreshAfterPost) fixture.getStatus = 503;
      return;
    }
    if (path === `/api/recorded-courses/learning/student/certificates/${certID}/pdf/`) {
      fixture.downloadCount += 1;
      await route.fulfill({ status: 200, headers, contentType: "application/pdf",
        body: "%PDF-1.4\\n% Synthetic QA certificate, not a genuine certificate\\n" });
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
    await route.fulfill({ status: 404, headers, json: { detail: "QA fixture endpoint not configured" } });
  });
}

const exam = page => page.getByRole("region", { name: "Final course examination" });

test.describe("Student final exam submission and certificate UI (mocked QA)", () => {
  test("keeps the final exam locked when published modules are incomplete", async ({ page }) => {
    const fixture = makeFixture({ final: initialFinal({ unlocked: false }) });
    await setup(page, fixture);
    await page.goto("/student/learning/901");
    await expect(exam(page).getByRole("heading", { name: "QA Final Examination" })).toBeVisible();
    await expect(exam(page)).toContainText("Complete all published modules");
    await expect(exam(page).getByRole("button", { name: "Submit Final Exam" })).toHaveCount(0);
    expect(fixture.postCount).toBe(0);
  });

  test("retries a temporary exam-load error before displaying questions", async ({ page }) => {
    const fixture = makeFixture({ getStatus: 503 });
    await setup(page, fixture);
    await page.goto("/student/learning/901");
    await expect(exam(page).getByRole("alert")).toContainText("QA final exam temporarily unavailable");
    await expect(exam(page).getByRole("button", { name: "Submit Final Exam" })).toHaveCount(0);
    fixture.getStatus = 200;
    await exam(page).getByRole("button", { name: "Retry loading final exam" }).click();
    await expect(exam(page).getByText("2 exam attempts remaining.")).toBeVisible();
    await expect(exam(page).getByText("QA Question A")).toBeVisible();
    expect(fixture.postCount).toBe(0);
  });

  test("requires all answers and preserves them after a rejected submission", async ({ page }) => {
    const fixture = makeFixture({ submitStatus: 400 });
    await setup(page, fixture);
    await page.goto("/student/learning/901");

    const submit = exam(page).getByRole("button", { name: "Submit Final Exam" });
    await expect(submit).toBeDisabled();
    await exam(page).getByLabel("A correct answer").check();
    await expect(submit).toBeDisabled();
    await exam(page).getByLabel("Another correct answer").check();
    await expect(submit).toBeEnabled();

    await submit.click();
    await expect(exam(page).getByRole("alert")).toContainText("no attempt was recorded");
    await expect(exam(page).getByLabel("A correct answer")).toBeChecked();
    await expect(exam(page).getByLabel("Another correct answer")).toBeChecked();
    expect(fixture.final.attempts_used).toBe(0);

    fixture.submitStatus = 201;
    await submit.click();
    await expect(exam(page).getByRole("status").filter({ hasText: "Latest recorded exam score" }))
      .toContainText("50% — Not passed");
    await expect(exam(page).getByText("1 exam attempt remaining.")).toBeVisible();
    expect(fixture.postCount).toBe(2);
    expect(fixture.submitted[1]).toEqual({ answers: { "601": 1, "602": 0 } });
  });

  test("distinguishes an accepted passing attempt from a later GET failure and allows certificate download", async ({ page }) => {
    const fixture = makeFixture({ passOnSubmit: true, failRefreshAfterPost: true });
    await setup(page, fixture);
    await page.goto("/student/learning/901");

    await exam(page).getByLabel("A correct answer").check();
    await exam(page).getByLabel("Another correct answer").check();
    await exam(page).getByRole("button", { name: "Submit Final Exam" }).click();

    await expect(exam(page).getByRole("status").filter({ hasText: "Latest recorded exam score" }))
      .toContainText("100% — Passed");
    await expect(exam(page).getByRole("alert")).toContainText("Your attempt was recorded");
    await expect(exam(page).getByRole("button", { name: "Submit Final Exam" })).toHaveCount(0);
    expect(fixture.postCount).toBe(1);

    fixture.getStatus = 200;
    await exam(page).getByRole("button", { name: "Retry loading final exam" }).click();
    await expect(exam(page).getByText("Final examination passed!")).toBeVisible();
    await expect(exam(page).getByRole("button", { name: "Download PDF certificate" })).toBeEnabled();
    await expect(exam(page).getByRole("link", { name: "Verify certificate" }))
      .toHaveAttribute("href", `/verify/certificate/${certID}`);

    const waitForDownload = page.waitForEvent("download");
    await exam(page).getByRole("button", { name: "Download PDF certificate" }).click();
    const download = await waitForDownload;
    expect(download.suggestedFilename()).toBe("MySLS-Course-Certificate.pdf");
    expect(fixture.downloadCount).toBe(1);
    expect(fixture.postCount).toBe(1);
  });
});
