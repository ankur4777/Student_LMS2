import { test, expect } from "@playwright/test";

// All API responses are simulated; no real student identity or production
// database is ever used. These are frontend UI regressions, not API tests.
const API = "/api/recorded-courses/learning/student/";
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
  await page.addInitScript(() => {
    localStorage.setItem("student_access_token", "browser-fixture-access-only");
    localStorage.setItem("student_user", JSON.stringify({
      id: "browser-qa", name: "Browser QA Student", organization: "Local Fixture Campus",
    }));
    localStorage.removeItem("student_refresh_token");
  });

  await page.route("**" + API + "courses/", route =>
    route.fulfill({
      status: coursesStatus,
      json: coursesStatus === 200 ? { courses } : { detail: "Local QA fixture API error" },
    }),
  );
  await page.route("**" + API + "certificates/", route =>
    route.fulfill({ status: 200, json: { certificates } }),
  );

  // Auxiliary sidebar requests are also simulated to make the tests
  // deterministic without requiring a Django server.
  await page.route("**/api/recorded-courses/learning-access/", route =>
    route.fulfill({ status: 200, json: { can_use_learning_center: true } }),
  );
  await page.route("**/api/academics/student/feature-access/", route =>
    route.fulfill({ status: 200, json: { features: { recorded_courses: true, ai_assistant: false } } }),
  );
  await page.route("**/api/live-classes/student/today/", route =>
    route.fulfill({ status: 200, json: [] }),
  );
}

test.describe("Student Learning Center UI (simulated backend responses)", () => {
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

    await page.route("**" + API + "certificates/QA-VALID-CERT/pdf/", route =>
      route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: "%PDF-1.4\n% Browser QA fixture (not a genuine certificate)\n",
      }),
    );
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
});
