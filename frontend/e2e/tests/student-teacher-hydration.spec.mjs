import { test, expect } from "@playwright/test";

// Use only synthetic organization/user data. All backend requests are mocked;
// this file must never sign in to or modify real student or teacher accounts.
const organization = "Browser QA Institute";
const logo = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#fff1ec"/><text x="24" y="30" font-size="16" text-anchor="middle" fill="#b85c4b">QA</text></svg>'
);
const avatar = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="24" fill="#d98a77"/><text x="24" y="30" font-size="16" text-anchor="middle" fill="white">S</text></svg>'
);

function trackHydrationErrors(page) {
  const errors = [];
  const check = message => {
    if (/hydration|server rendered html didn't match|text content does not match|react error #(?:418|423|425)/i.test(message)) {
      errors.push(message.slice(0, 500));
    }
  };
  page.on("console", entry => {
    if (entry.type() === "error") check(entry.text());
  });
  page.on("pageerror", error => check(error.message));
  return errors;
}

async function mockPortalBackend(page) {
  await page.route(url => url.pathname.includes("/api/"), async route => {
    const headers = {
      "Access-Control-Allow-Origin": route.request().headers().origin || "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      Vary: "Origin",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const path = new URL(route.request().url()).pathname;
    let json = {};
    if (path.endsWith("/api/accounts/organization-branding/")) {
      json = { name: organization, logo, code: "BROWSER-QA" };
    } else if (path.endsWith("/api/recorded-courses/learning-access/")) {
      json = { can_use_learning_center: true };
    } else if (path.endsWith("/api/academics/student/feature-access/")) {
      json = { features: { recorded_courses: true } };
    } else if (path.endsWith("/api/recorded-courses/learning/student/courses/") ||
               path.endsWith("/api/recorded-courses/learning/manage/courses/")) {
      json = { courses: [] };
    } else if (path.endsWith("/api/recorded-courses/learning/student/certificates/")) {
      json = { certificates: [] };
    } else if (path.endsWith("/api/notifications/")) {
      json = { notifications: [] };
    } else if (path.endsWith("/api/notifications/unread-count/")) {
      json = { unread_count: 0 };
    } else if (path.endsWith("/api/live-classes/student/today/")) {
      json = [];
    } else {
      await route.fulfill({ status: 404, headers, json: { detail: "No browser QA fixture" } });
      return;
    }
    await route.fulfill({ status: 200, headers, json });
  });
}

test.describe("Student and Teacher branding hydration (mocked local QA)", () => {
  test("Student restores saved institution logo and profile picture without hydration errors", async ({ page }) => {
    const hydrationErrors = trackHydrationErrors(page);
    await mockPortalBackend(page);
    await page.addInitScript(({ organization, logo, avatar }) => {
      localStorage.setItem("student_access_token", "browser-qa-token-only");
      localStorage.removeItem("student_refresh_token");
      localStorage.setItem("student_user", JSON.stringify({
        id: "browser-qa-student", name: "Student QA",
        organization, organization_logo: logo, profile_picture: avatar,
      }));
    }, { organization, logo, avatar });

    await page.goto("/student/learning");
    await expect(page.getByRole("heading", { name: "My Courses" })).toBeVisible();
    const brand = page.locator(".student-portal-brand .portal-organization-brand");
    await expect(brand.getByText(organization, { exact: true })).toBeVisible();
    await expect(brand.locator("img")).toHaveAttribute("src", logo);

    // Previously, the server rendered text initials and the client rendered
    // this image during hydration, producing React's mismatch warning.
    const profile = page.locator(".student-portal-user");
    await expect(profile.getByText("Student QA", { exact: true })).toBeVisible();
    await expect(profile.locator("img.student-portal-avatar")).toHaveAttribute("src", avatar);
    await page.waitForLoadState("networkidle");
    expect(hydrationErrors, hydrationErrors.join("\n")).toEqual([]);
  });

  test("Teacher restores cached institution logo without hydration errors", async ({ page }) => {
    const hydrationErrors = trackHydrationErrors(page);
    await mockPortalBackend(page);
    await page.addInitScript(({ organization, logo }) => {
      localStorage.setItem("teacher_access_token", "browser-qa-token-only");
      localStorage.removeItem("teacher_refresh_token");
      localStorage.setItem("teacher_user", JSON.stringify({
        id: "browser-qa-teacher", name: "Teacher QA",
        organization, organization_logo: logo,
      }));
    }, { organization, logo });

    await page.goto("/teacher/recorded-courses");
    await expect(page.getByRole("heading", { name: "My Recorded Learning Courses" })).toBeVisible();
    const brand = page.locator(".teacher-portal-brand .portal-organization-brand");
    await expect(brand.getByText(organization, { exact: true })).toBeVisible();
    await expect(brand.locator("img")).toHaveAttribute("src", logo);
    await expect(page.locator(".teacher-portal-user").getByText("Teacher QA", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(hydrationErrors, hydrationErrors.join("\n")).toEqual([]);
  });
});
