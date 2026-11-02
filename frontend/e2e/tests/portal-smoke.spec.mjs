import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Always use a disposable, local QA organization. Never point these tests at
// production or use credentials belonging to a real student.
const roles = {
  "college-admin": {
    name: "College Admin",
    prefix: "COLLEGE_ADMIN",
    protected: "/college-admin/recorded-courses",
  },
  teacher: {
    name: "Teacher",
    prefix: "TEACHER",
    protected: "/teacher/recorded-courses",
  },
  student: {
    name: "Student",
    prefix: "STUDENT",
    protected: "/student/learning",
  },
};

function credentialsFor(role) {
  const prefix = roles[role].prefix;
  const username = process.env[`E2E_${prefix}_USERNAME`];
  const password = process.env[`E2E_${prefix}_PASSWORD`];
  return username && password ? { username, password } : null;
}

async function login(page, role, credentials) {
  await page.goto(`/${role}/login`);
  await page.getByPlaceholder("Enter your username or email").fill(credentials.username);
  await page.locator('input[type="password"]').fill(credentials.password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}/dashboard(?:[/?#]|$)`));
}

test.describe("Unauthenticated access must redirect to role login", () => {
  for (const [role, info] of Object.entries(roles)) {
    test(`${info.name} recorded-learning page is protected`, async ({ page }) => {
      await page.goto(info.protected);
      await expect(page).toHaveURL(new RegExp(`/${role}/login(?:[/?#]|$)`));
      await expect(page.getByRole("heading", { name: `${info.name} Login` })).toBeVisible();
    });
  }
});

test.describe("Local QA role journeys (read-only)", () => {
  test("College Admin sees analytics and can download an organization CSV", async ({ page }) => {
    const credentials = credentialsFor("college-admin");
    test.skip(!credentials, "Set E2E_COLLEGE_ADMIN_USERNAME and E2E_COLLEGE_ADMIN_PASSWORD");
    await login(page, "college-admin", credentials);
    await page.goto(roles["college-admin"].protected);
    await expect(page.getByRole("heading", { name: "Recorded Courses", exact: true })).toBeVisible();

    // This assertion intentionally requires Learning & Certification to be
    // enabled on the disposable QA organization, not just a valid login.
    const analytics = page.getByRole("region", { name: "Organization learning analytics" });
    await expect(analytics).toBeVisible();
    await expect(analytics.getByText("Learning & Certification Analytics")).toBeVisible();
    await expect(analytics.getByText("Recorded courses", { exact: true })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await analytics.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("mysls-learning-analytics.csv");
    const csv = await readFile(await download.path(), "utf8");
    expect(csv).toContain("Course");
    expect(csv).toContain("TOTAL (matching courses)");
  });

  test("Teacher can reach assigned recorded-learning courses", async ({ page }) => {
    const credentials = credentialsFor("teacher");
    test.skip(!credentials, "Set E2E_TEACHER_USERNAME and E2E_TEACHER_PASSWORD");
    await login(page, "teacher", credentials);
    await page.goto(roles.teacher.protected);
    await expect(page.getByRole("heading", { name: "My Recorded Learning Courses" })).toBeVisible();

    const expected = process.env.E2E_TEACHER_COURSE_TITLE;
    if (expected) {
      await expect(page.getByRole("heading", { name: expected, exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Manage course" }).first()).toBeVisible();
    } else {
      await expect(page.getByText("Loading assigned courses...")).toBeHidden();
    }
  });

  test("Student can open Learning Center and an enrolled course when configured", async ({ page }) => {
    const credentials = credentialsFor("student");
    test.skip(!credentials, "Set E2E_STUDENT_USERNAME and E2E_STUDENT_PASSWORD");
    await login(page, "student", credentials);
    await page.goto(roles.student.protected);
    await expect(page.getByRole("heading", { name: "My Courses" })).toBeVisible();
    await expect(page.getByText("Loading your courses...")).toBeHidden();

    const expected = process.env.E2E_STUDENT_COURSE_TITLE;
    if (expected) {
      const courseCard = page.locator("article.learning-card").filter({
        has: page.getByRole("heading", { name: expected, exact: true }),
      });
      await expect(courseCard).toBeVisible();
      await courseCard.getByRole("link", { name: "Continue learning" }).click();
      await expect(page.getByRole("heading", { name: expected, exact: true })).toBeVisible();
    }
  });
});
