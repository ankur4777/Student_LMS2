import { test, expect } from "@playwright/test";

// The real Next.js course-detail page is exercised with synthetic browser
// sessions and intercepted API calls only. No production account or DB writes.
const apiDetail = "/api/recorded-courses/college-admin/courses/911/";
const existingLessons = [
  { id: 801, title: "QA Introduction", description: "Recorded lesson", position: 1, is_active: true },
  { id: 802, title: "QA Recap", description: "", position: 3, is_active: false },
];
const initialCourse = {
  id: 911, title: "QA Recorded Chemistry", description: "Synthetic course",
  price: "250.00", access_duration_days: 180, is_active: true,
  lessons: existingLessons,
};

function mockCors(route) {
  return {
    "Access-Control-Allow-Origin": route.request().headers().origin || "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  };
}

async function setupAdmin(page, fixture) {
  await page.addInitScript(() => {
    localStorage.setItem("college_admin_access_token", "mock-qa-token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.setItem("college_admin_user", JSON.stringify({
      id: 42, name: "Browser Detail QA Admin", organization: "QA Recorded Learning Institute",
    }));
  });
  await page.route(url => url.pathname.includes("/api/"), async route => {
    const method = route.request().method();
    const path = new URL(route.request().url()).pathname;
    const headers = mockCors(route);
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (path === apiDetail && method === "GET") {
      const status = fixture.loadStatus ?? 200;
      await route.fulfill(status === 200
        ? { status: 200, headers, json: { course: fixture.course } }
        : { status, headers, json: { detail: "Temporary course detail failure" } });
      return;
    }
    if (path === apiDetail && method === "PATCH") {
      const next = route.request().postDataJSON();
      fixture.patches.push(next);
      if (fixture.saveStatus && fixture.saveStatus !== 200) {
        await route.fulfill({
          status: fixture.saveStatus, headers,
          json: { price: ["QA price validation failed"] },
        });
        return;
      }
      fixture.course = { ...fixture.course, ...next };
      await route.fulfill({ status: 200, headers, json: {
        course: { ...fixture.course, lessons: undefined }, message: "Updated",
      } });
      return;
    }
    if (path === apiDetail + "lessons/" && method === "POST") {
      const data = route.request().postData() || "";
      fixture.uploads.push(data);
      if (fixture.uploadStatus && fixture.uploadStatus !== 201) {
        await route.fulfill({
          status: fixture.uploadStatus, headers,
          json: { detail: "Video upload failed in browser fixture" },
        });
        return;
      }
      const lesson = {
        id: 899, title: "QA Uploaded Video", description: "Synthetic upload",
        position: 4, is_active: true,
      };
      fixture.course = {
        ...fixture.course,
        lessons: [...fixture.course.lessons, lesson],
      };
      await route.fulfill({ status: 201, headers, json: { lesson } });
      return;
    }
    if (path.endsWith("/api/recorded-courses/learning-access/")) {
      // Optional authoring UI is disabled for this focused paid-course test.
      await route.fulfill({ status: 200, headers, json: { can_use_learning_center: false } });
      return;
    }
    if (path.endsWith("/api/accounts/college-admin/institution-settings/")) {
      await route.fulfill({ status: 200, headers, json: { name: "QA Recorded Learning Institute", logo: "" } });
      return;
    }
    if (path.endsWith("/api/notifications/")) {
      await route.fulfill({ status: 200, headers, json: { notifications: [] } });
      return;
    }
    if (path.endsWith("/api/notifications/unread-count/")) {
      await route.fulfill({ status: 200, headers, json: { unread_count: 0 } });
      return;
    }
    await route.fulfill({ status: 404, headers, json: { detail: "No QA fixture for this API" } });
  });
}

function freshFixture() {
  return {
    course: { ...initialCourse, lessons: existingLessons.map(item => ({ ...item })) },
    patches: [], uploads: [],
  };
}

test.describe("College Admin course detail UI (mocked local QA)", () => {
  test("renders course details, lesson list and saved admin profile without hydration errors", async ({ page }) => {
    const fixture = freshFixture();
    const hydrationErrors = [];
    const watch = message => {
      if (/hydration|server rendered html didn't match|react error #(?:418|423|425)/i.test(message)) {
        hydrationErrors.push(message);
      }
    };
    page.on("console", message => { if (message.type() === "error") watch(message.text()); });
    page.on("pageerror", error => watch(error.message));
    await setupAdmin(page, fixture);
    await page.goto("/college-admin/recorded-courses/911");

    await expect(page.getByRole("heading", { name: "Manage Recorded Course" })).toBeVisible();
    await expect(page.locator(".teacher-topbar").getByText("Browser Detail QA Admin", { exact: true })).toBeVisible();

    const details = page.getByRole("region", { name: "Recorded course details" });
    await expect(details.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("QA Recorded Chemistry");
    await expect(details.getByRole("spinbutton", { name: "Access Days" })).toHaveValue("180");

    const lessons = page.getByRole("region", { name: "Recorded course lessons" });
    await expect(lessons.getByRole("row").filter({ hasText: "QA Introduction" })).toBeVisible();
    await expect(lessons.getByRole("row").filter({ hasText: "QA Recap" }).getByText("Inactive")).toBeVisible();
    const uploader = page.getByRole("region", { name: "Upload recorded lesson" });
    await expect(uploader.getByRole("spinbutton", { name: "Position" })).toHaveValue("4");
    await expect(page.getByRole("link", { name: "Back to Recorded Courses" }))
      .toHaveAttribute("href", "/college-admin/recorded-courses");
    expect(hydrationErrors).toEqual([]);
  });

  test("validates save errors and successfully updates course fields through a simulated PATCH", async ({ page }) => {
    const fixture = freshFixture();
    fixture.saveStatus = 400;
    await setupAdmin(page, fixture);
    await page.goto("/college-admin/recorded-courses/911");

    const details = page.getByRole("region", { name: "Recorded course details" });
    await expect(details.getByRole("textbox", { name: "Title", exact: true })).toBeVisible();
    await details.getByRole("textbox", { name: "Title", exact: true }).fill("QA Chemistry Updated");
    await details.getByRole("spinbutton", { name: "Price (₹)" }).fill("325.50");
    await details.getByRole("spinbutton", { name: "Access Days" }).fill("90");
    await details.getByRole("checkbox", { name: "Active" }).uncheck();

    await details.getByRole("button", { name: "Save Changes" }).click();
    await expect(details.getByRole("alert")).toContainText("QA price validation failed");
    await expect(details.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("QA Chemistry Updated");

    fixture.saveStatus = 200;
    await details.getByRole("button", { name: "Save Changes" }).click();
    await expect(details.getByRole("status")).toHaveText("Course details saved successfully.");
    expect(fixture.patches.at(-1)).toMatchObject({
      title: "QA Chemistry Updated", price: "325.50",
      access_duration_days: 90, is_active: false,
    });
    await expect(details.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Recorded course lessons" })
      .getByRole("row").filter({ hasText: "QA Introduction" })).toBeVisible();
  });

  test("uploads a synthetic video and refreshes the lesson list", async ({ page }) => {
    const fixture = freshFixture();
    await setupAdmin(page, fixture);
    await page.goto("/college-admin/recorded-courses/911");

    const upload = page.getByRole("region", { name: "Upload recorded lesson" });
    await expect(upload.getByRole("textbox", { name: "Lesson Title" })).toBeVisible();
    await upload.getByRole("textbox", { name: "Lesson Title" }).fill("QA Uploaded Video");
    await upload.getByRole("textbox", { name: "Description" }).fill("Synthetic upload");
    await upload.getByRole("fileinput", { name: "Video" }).setInputFiles({
      name: "browser-qa.webm", mimeType: "video/webm", buffer: Buffer.from("browser test video only"),
    });
    await upload.getByRole("button", { name: "Upload Lesson" }).click();

    await expect(upload.getByRole("status")).toHaveText("Recorded lesson uploaded successfully.");
    await expect(upload.getByRole("textbox", { name: "Lesson Title" })).toHaveValue("");
    await expect(upload.getByRole("spinbutton", { name: "Position" })).toHaveValue("5");
    await expect(page.getByRole("region", { name: "Recorded course lessons" })
      .getByRole("row").filter({ hasText: "QA Uploaded Video" })).toBeVisible();
    expect(fixture.uploads.length).toBe(1);
    expect(fixture.uploads[0]).toContain("QA Uploaded Video");
  });

  test("offers retry when course details cannot be loaded", async ({ page }) => {
    const fixture = freshFixture();
    fixture.loadStatus = 503;
    await setupAdmin(page, fixture);
    await page.goto("/college-admin/recorded-courses/911");
    await expect(page.getByRole("alert")).toContainText("Temporary course detail failure");
    await expect(page.getByRole("region", { name: "Recorded course details" })).toHaveCount(0);

    fixture.loadStatus = 200;
    await page.getByRole("button", { name: "Retry loading course" }).click();
    await expect(page.getByRole("region", { name: "Recorded course details" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
