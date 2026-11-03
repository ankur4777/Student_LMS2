import { test, expect } from "@playwright/test";

// All API responses are simulated; no real student identity or production
// database is ever used. These are frontend UI regressions, not API tests.
const API = "/api/recorded-courses/learning/student/";

// Browser fetches from Next.js and Django may be cross-origin. The
// Authorization header triggers a CORS preflight even for a mocked GET.
function isApiUrl(url, suffix) {
  return url.pathname.endsWith(suffix);
}
function mockCorsHeaders(route) {
  return {
    "Access-Control-Allow-Origin": route.request().headers().origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Vary": "Origin",
  };
}
async function fulfillMockJson(route, { status = 200, json }) {
  const headers = mockCorsHeaders(route);
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers });
    return;
  }
  await route.fulfill({ status, headers, json });
}

const VALID = {
  id: "QA-VALID-CERT",
  course_id: 901,
  course_title: "Browser QA Fundamentals",
  issued_at: "2026-01-10T09:00:00Z",
  score_percent: 90,
  revoked: false,
};
const REVOKED = {
  ...VALID,
  id: "QA-REVOKED-CERT",
  course_id: 902,
  course_title: "Browser QA Archived",
  revoked: true,
};

async function setupMockStudent(page, {
  courses = [],
  certificates = [],
  coursesStatus = 200,
} = {}) {
  // Establish the fixture session on the exact frontend origin, rather
  // than relying on an init script that may run on intermediate documents.
  // This also fails early when port 3000 serves a different application.
  const loginResponse = await page.goto("/student/login");
  if (!loginResponse?.ok()) {
    throw new Error(`MySLS preflight: Student Login did not load (HTTP ${loginResponse?.status() ?? "no response"}) at ${page.url()}. Check the frontend terminal and E2E_BASE_URL.`);
  }
  await expect(
    page.getByRole("heading", { name: "Student Login", exact: true }),
    "MySLS preflight: the Student Login heading must be visible before fixture setup. Check that port 3000 serves this project.",
  ).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem("student_access_token", "browser-fixture-access-only");
    localStorage.setItem("student_user", JSON.stringify({
      id: "browser-qa", name: "Browser QA Student", organization: "Local Fixture Campus",
    }));
    localStorage.removeItem("student_refresh_token");
  });
  expect(await page.evaluate(
    () => localStorage.getItem("student_access_token"),
  )).toBe("browser-fixture-access-only");

  await page.route(url => isApiUrl(url, API + "courses/"), route =>
    fulfillMockJson(route, {
      status: coursesStatus,
      json: coursesStatus === 200 ? { courses } : { detail: "Local QA fixture API error" },
    }),
  );
  await page.route(url => isApiUrl(url, API + "certificates/"), route =>
    fulfillMockJson(route, { json: { certificates } }),
  );
  // Sidebar and popup requests also need CORS preflight support.
  await page.route(url => isApiUrl(url, "/api/recorded-courses/learning-access/"), route =>
    fulfillMockJson(route, { json: { can_use_learning_center: true } }),
  );
  await page.route(url => isApiUrl(url, "/api/academics/student/feature-access/"), route =>
    fulfillMockJson(route, { json: { features: { recorded_courses: true, ai_assistant: false } } }),
  );
  await page.route(url => isApiUrl(url, "/api/live-classes/student/today/"), route =>
    fulfillMockJson(route, { json: [] }),
  );
}

test.describe("Student Learning Center UI (simulated backend responses)", () => {
  // Attach safe browser diagnostics on failures. Never log auth tokens.
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    const headings = await page.locator("h1, h2").allTextContents().catch(() => []);
    const details = {
      url: page.url(),
      headings: headings.map(h => h.trim().slice(0, 120)).slice(0, 8),
      visibleAlerts: await page.getByRole("alert").allTextContents().catch(() => []),
      preview: (await page.locator("body").innerText().catch(() => "")).slice(0, 350),
    };
    console.log("[MySLS browser QA diagnosis]", JSON.stringify(details));
  });
  test("shows the no-enrollments state", async ({ page }) => {
    await setupMockStudent(page);
    await page.goto("/student/learning");
    await expect(page.getByRole("heading", { name: "My Courses" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No enrolled courses yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse recorded courses" })).toHaveAttribute(
      "href", "/student/recorded-courses",
    );
  });

  test("shows course progress and keeps revoked certificates non-downloadable", async ({ page }) => {
    await setupMockStudent(page, {
      courses: [{
        id: 901, title: "Browser QA Fundamentals", description: "Fixture only",
        module_count: 2, completed_lessons: 2, total_lessons: 4,
        access_expires_at: null,
      }],
      certificates: [VALID, REVOKED],
    });
    await page.goto("/student/learning");
    const card = page.locator("article.learning-card", {
      has: page.getByRole("heading", { name: "Browser QA Fundamentals", exact: true }),
    });
    await expect(card).toBeVisible();
    await expect(card.getByText("2/4 lectures viewed")).toBeVisible();
    await expect(card.getByText("50% viewed")).toBeVisible();
    await expect(card.getByRole("progressbar", {
      name: "Reported lesson progress for Browser QA Fundamentals",
    })).toHaveAttribute("aria-valuenow", "50");
    await expect(card.getByRole("link", { name: "Continue learning" })).toHaveAttribute(
      "href", "/student/learning/901",
    );

    const certs = page.getByRole("region", { name: "Earned course certificates" });
    await expect(certs).toBeVisible();
    const valid = certs.locator("article").filter({ hasText: "Browser QA Fundamentals" });
    const revoked = certs.locator("article").filter({ hasText: "Browser QA Archived" });
    await expect(valid.getByRole("button", { name: "Download PDF" })).toBeVisible();
    await expect(valid.getByRole("link", { name: "Verify" })).toHaveAttribute(
      "href", "/verify/certificate/QA-VALID-CERT",
    );
    await expect(revoked.getByText("Revoked", { exact: true })).toBeVisible();
    await expect(revoked.getByRole("button", { name: "Download PDF" })).toHaveCount(0);

    await page.route(url => isApiUrl(url, API + "certificates/QA-VALID-CERT/pdf/"), route => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: mockCorsHeaders(route) });
      }
      return route.fulfill({
        status: 200,
        headers: mockCorsHeaders(route),
        contentType: "application/pdf",
        body: "%PDF-1.4\n% Browser QA fixture (not a genuine certificate)\n",
      });
    });
    const downloading = page.waitForEvent("download");
    await valid.getByRole("button", { name: "Download PDF" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe("MySLS-Certificate-QA-VALID-CERT.pdf");
  });

  test("redirects to student login when the courses endpoint reports an expired session", async ({ page }) => {
    await setupMockStudent(page, { coursesStatus: 401 });
    await page.goto("/student/learning");
    await expect(page).toHaveURL(/\/student\/login(?:[/?#]|$)/);
    await expect(page.getByRole("heading", { name: "Student Login" })).toBeVisible();
  });

  test("displays a server error while retaining independently issued certificates", async ({ page }) => {
    await setupMockStudent(page, { coursesStatus: 503, certificates: [VALID] });
    await page.goto("/student/learning");
    await expect(page.getByRole("alert")).toContainText("Local QA fixture API error");
    await expect(page.getByRole("heading", { name: "My Certificates" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  });
  test("searches enrolled courses and filters by lesson progress without treating exams as completed", async ({ page }) => {
    await setupMockStudent(page, {
      courses: [
        { id: 901, title: "Algebra Fundamentals", description: "Mathematics", module_count: 1, completed_lessons: 0, total_lessons: 2, access_expires_at: null },
        { id: 902, title: "Physics Lab", description: "Science", module_count: 1, completed_lessons: 1, total_lessons: 2, access_expires_at: null },
        { id: 903, title: "English Literature", description: "Language", module_count: 1, completed_lessons: 2, total_lessons: 2, access_expires_at: null },
        { id: 904, title: "Orientation", description: "Introduction", module_count: 0, completed_lessons: 0, total_lessons: 0, access_expires_at: null },
      ],
    });
    await page.goto("/student/learning");
    await expect(page.locator("article.learning-card")).toHaveCount(4);
    await expect(page.getByText("4 of 4 courses")).toBeVisible();
    await page.getByLabel("Search courses").fill("math");
    await expect(page.locator("article.learning-card")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Algebra Fundamentals" })).toBeVisible();
    await page.getByLabel("Search courses").clear();
    await page.getByLabel("View by progress").selectOption("in_progress");
    await expect(page.locator("article.learning-card")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Physics Lab" })).toBeVisible();
    await page.getByLabel("View by progress").selectOption("lessons_viewed");
    await expect(page.locator("article.learning-card")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "English Literature" })).toBeVisible();
    await page.getByLabel("View by progress").selectOption("not_started");
    await expect(page.locator("article.learning-card")).toHaveCount(2);
    await page.getByLabel("Search courses").fill("missing");
    await expect(page.getByRole("heading", { name: "No matching courses" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.locator("article.learning-card")).toHaveCount(4);
  });

  test("offers retry and recovers from a temporary course API error", async ({ page }) => {
    await setupMockStudent(page, { coursesStatus: 503 });
    await page.goto("/student/learning");
    await expect(page.getByRole("alert")).toContainText("Local QA fixture API error");
    await expect(page.getByRole("heading", { name: "No enrolled courses yet" })).toHaveCount(0);
    await page.route(url => isApiUrl(url, API + "courses/"), route =>
      fulfillMockJson(route, { json: { courses: [
        { id: 903, title: "Recovered QA Course", description: "", module_count: 1, completed_lessons: 0, total_lessons: 1, access_expires_at: null },
      ] } }),
    );
    await page.getByRole("button", { name: "Retry loading courses" }).click();
    await expect(page.getByRole("heading", { name: "Recovered QA Course" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

});
