import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

// These browser tests exercise the real Next.js pages with only synthetic
// account data and mocked API requests. They never write to a database.
const campus = "QA Recorded Learning Institute";
const analyticsCourse = "QA Advanced Biology";
const paidCourses = [
  { id: 911, title: "QA Recorded Chemistry", description: "Synthetic content", price: "250.00", access_duration_days: 180, is_active: true, lesson_count: 4 },
  { id: 912, title: "QA Intro to Programming", description: "", price: "0.00", access_duration_days: 30, is_active: false, lesson_count: 0 },
];
const teacherCourses = [
  { id: 911, title: "QA Recorded Chemistry", description: "Synthetic course", module_count: 2, lesson_count: 4 },
  { id: 913, title: "QA Recorded Mathematics", description: "", module_count: 1, lesson_count: 2 },
];
const totals = {
  courses: 1, active_courses: 1,
  enrolled_students: 8, active_enrollments: 7, manual_active: 5, purchased_active: 2,
  expired_enrollments: 1, revoked_enrollments: 0, final_attempts: 6,
  students_attempted_final: 4, students_passed_final: 3,
  pending_assignment_grading: 1, graduated_students: 2,
  valid_certificates: 2, revoked_certificates: 0, graduation_percent: 25,
};
const analytics = {
  totals,
  courses: [{
    ...totals, course_id: 919, title: analyticsCourse,
    active: true, published_modules: 3, average_attempt_score: 78,
    enrolled_students: 4, graduated_students: 2, graduation_percent: 50,
  }],
  definitions: {},
};

function hydrationErrors(page) {
  const errors = [];
  const record = message => {
    if (/hydration|server rendered html didn't match|text content does not match|react error #(?:418|423|425)/i.test(message)) {
      errors.push(message.slice(0, 500));
    }
  };
  page.on("console", entry => { if (entry.type() === "error") record(entry.text()); });
  page.on("pageerror", error => record(error.message));
  return errors;
}

async function initRole(page, role) {
  await page.addInitScript(({ role, campus }) => {
    const prefix = role === "college-admin" ? "college_admin" : "teacher";
    const name = role === "college-admin" ? "Browser QA Admin" : "Browser QA Teacher";
    localStorage.setItem(prefix + "_access_token", "qa-browser-token-only");
    localStorage.removeItem(prefix + "_refresh_token");
    localStorage.setItem(prefix + "_user", JSON.stringify({
      id: "qa-" + prefix, name, organization: campus,
    }));
  }, { role, campus });
}

async function mockBackend(page, {
  analyticsEnabled = true,
  paid = paidCourses,
  assigned = teacherCourses,
  collegeStatus = 200,
  teacherStatus = 200,
} = {}) {
  await page.route(url => url.pathname.includes("/api/"), async route => {
    const headers = {
      "Access-Control-Allow-Origin": route.request().headers().origin || "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      Vary: "Origin",
    };
    const method = route.request().method();
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (method !== "GET") {
      // Ensure this fixture cannot create or modify courses.
      await route.fulfill({ status: 405, headers, json: { detail: "Read-only QA fixture" } });
      return;
    }
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/api/recorded-courses/college-admin/courses/")) {
      await route.fulfill(collegeStatus === 200
        ? { status: 200, headers, json: { courses: paid } }
        : { status: collegeStatus, headers, json: { detail: "Temporary recorded course list failure" } });
    } else if (pathname.endsWith("/api/recorded-courses/learning/manage/analytics/")) {
      await route.fulfill(analyticsEnabled
        ? { status: 200, headers, json: analytics }
        : { status: 403, headers, json: { detail: "Learning feature disabled" } });
    } else if (pathname.endsWith("/api/recorded-courses/learning/manage/analytics/export.csv")) {
      await route.fulfill({
        status: 200, headers: { ...headers, "Content-Type": "text/csv" },
        body: "Course,Graduated\\nQA Advanced Biology,2\\nTOTAL (matching courses),2\\n",
      });
    } else if (pathname.endsWith("/api/recorded-courses/learning/manage/courses/")) {
      await route.fulfill(teacherStatus === 200
        ? { status: 200, headers, json: { courses: assigned } }
        : { status: teacherStatus, headers, json: { detail: "Recorded Learning unavailable for QA teacher" } });
    } else if (pathname.endsWith("/api/accounts/college-admin/institution-settings/") ||
               pathname.endsWith("/api/accounts/organization-branding/")) {
      await route.fulfill({ status: 200, headers, json: { name: campus, logo: "" } });
    } else if (pathname.endsWith("/api/recorded-courses/learning-access/")) {
      await route.fulfill({ status: 200, headers, json: { can_use_learning_center: true } });
    } else if (pathname.endsWith("/api/notifications/unread-count/")) {
      await route.fulfill({ status: 200, headers, json: { unread_count: 0 } });
    } else if (pathname.endsWith("/api/notifications/")) {
      await route.fulfill({ status: 200, headers, json: { notifications: [] } });
    } else {
      await route.fulfill({ status: 404, headers, json: { detail: "QA fixture endpoint not configured" } });
    }
  });
}

test.describe("Recorded Learning management UI (mocked local QA)", () => {
  test("College Admin can view paid courses, learning analytics and download CSV", async ({ page }) => {
    const errors = hydrationErrors(page);
    await initRole(page, "college-admin");
    await mockBackend(page);
    await page.goto("/college-admin/recorded-courses");
    await expect(page.getByRole("heading", { name: "Recorded Courses", exact: true })).toBeVisible();
    await expect(page.locator(".teacher-topbar").getByText("Browser QA Admin", { exact: true })).toBeVisible();

    const paidTable = page.locator("table").last();
    const chemistry = paidTable.getByRole("row").filter({ hasText: "QA Recorded Chemistry" });
    await expect(chemistry).toBeVisible();
    await expect(chemistry.getByText("Active", { exact: true })).toBeVisible();
    await expect(chemistry.getByRole("link", { name: "Manage" })).toHaveAttribute(
      "href", "/college-admin/recorded-courses/911",
    );
    const inactive = paidTable.getByRole("row").filter({ hasText: "QA Intro to Programming" });
    await expect(inactive.getByText("Inactive", { exact: true })).toBeVisible();

    const panel = page.getByRole("region", { name: "Organization learning analytics" });
    await expect(panel.getByRole("heading", { name: "Learning & Certification Analytics" })).toBeVisible();
    await expect(panel.getByRole("progressbar", {
      name: "Graduation rate for QA Advanced Biology",
    })).toHaveAttribute("aria-valuenow", "50");
    await panel.getByRole("textbox", { name: "Filter courses by title" }).fill("no matching course");
    await expect(panel.getByText("No matching courses.")).toBeVisible();
    await panel.getByRole("textbox", { name: "Filter courses by title" }).fill("");

    const downloadEvent = page.waitForEvent("download");
    await panel.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe("mysls-learning-analytics.csv");
    expect(await readFile(await download.path(), "utf8")).toContain("TOTAL (matching courses)");

    expect(errors, errors.join("\\n")).toEqual([]);
  });

  test("College Admin retains paid course management when Learning is disabled", async ({ page }) => {
    await initRole(page, "college-admin");
    await mockBackend(page, { analyticsEnabled: false });
    await page.goto("/college-admin/recorded-courses");
    await expect(page.getByRole("heading", { name: "Recorded Courses", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Organization learning analytics" })).toHaveCount(0);
    const courseRow = page.locator("table").getByRole("row").filter({ hasText: "QA Recorded Chemistry" });
    await expect(courseRow.getByRole("link", { name: "Manage" })).toHaveAttribute(
      "href", "/college-admin/recorded-courses/911",
    );
    await expect(page.getByRole("heading", { name: "Create Recorded Course" })).toBeVisible();
  });

  test("College Admin searches and filters paid courses without affecting analytics", async ({ page }) => {
    await initRole(page, "college-admin");
    await mockBackend(page);
    await page.goto("/college-admin/recorded-courses");

    const management = page.getByRole("region", { name: "Recorded course management" });
    const search = management.getByRole("searchbox", { name: "Search recorded courses" });
    const status = management.getByRole("combobox", { name: "Filter courses by status" });
    const courseTable = management.getByRole("table", { name: "Recorded courses" });

    await expect(management.getByText("Total: 2", { exact: true })).toBeVisible();
    await expect(management.getByText("Active: 1", { exact: true })).toBeVisible();
    await expect(management.getByText("Inactive: 1", { exact: true })).toBeVisible();
    await expect(management.getByText("Showing 2 of 2 recorded courses")).toBeVisible();

    await search.fill("synthetic");
    await expect(management.getByText("Showing 1 of 2 recorded courses")).toBeVisible();
    await expect(courseTable.getByRole("row").filter({ hasText: "QA Recorded Chemistry" })).toBeVisible();
    await expect(courseTable.getByRole("row").filter({ hasText: "QA Intro to Programming" })).toHaveCount(0);

    await search.fill("");
    await status.selectOption("inactive");
    await expect(management.getByText("Showing 1 of 2 recorded courses")).toBeVisible();
    await expect(courseTable.getByRole("row").filter({ hasText: "QA Intro to Programming" })).toBeVisible();

    await status.selectOption("active");
    await expect(courseTable.getByRole("row").filter({ hasText: "QA Recorded Chemistry" })).toBeVisible();

    // The independent analytics section still shows its own unfiltered data.
    await expect(page.getByRole("region", { name: "Organization learning analytics" })
      .getByRole("link", { name: analyticsCourse })).toBeVisible();

    await search.fill("missing course");
    await expect(management.getByRole("heading", { name: "No matching recorded courses" })).toBeVisible();
    await expect(management.getByRole("link", { name: "Manage" })).toHaveCount(0);
    await management.getByRole("button", { name: "Clear course filters" }).click();
    await expect(search).toHaveValue("");
    await expect(status).toHaveValue("all");
    await expect(courseTable.getByRole("link", { name: "Manage" })).toHaveCount(2);
  });

  test("College Admin sorts course rows by title, price and lessons", async ({ page }) => {
    await initRole(page, "college-admin");
    await mockBackend(page);
    await page.goto("/college-admin/recorded-courses");

    const management = page.getByRole("region", { name: "Recorded course management" });
    const sort = management.getByRole("combobox", { name: "Sort courses" });
    const rows = management.getByRole("table", { name: "Recorded courses" }).locator("tbody tr");
    await expect(rows).toHaveCount(2);

    await sort.selectOption("title_asc");
    await expect(rows.first()).toContainText("QA Intro to Programming");
    await sort.selectOption("title_desc");
    await expect(rows.first()).toContainText("QA Recorded Chemistry");
    await sort.selectOption("price_asc");
    await expect(rows.first()).toContainText("QA Intro to Programming");
    await sort.selectOption("price_desc");
    await expect(rows.first()).toContainText("QA Recorded Chemistry");
    await sort.selectOption("most_lessons");
    await expect(rows.first()).toContainText("QA Recorded Chemistry");

    await management.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(sort).toHaveValue("original");
    await expect(rows.first()).toContainText("QA Recorded Chemistry");
  });

  test("College Admin shows a separate empty state when no courses exist", async ({ page }) => {
    await initRole(page, "college-admin");
    await mockBackend(page, { paid: [] });
    await page.goto("/college-admin/recorded-courses");
    const management = page.getByRole("region", { name: "Recorded course management" });
    await expect(management.getByText("No recorded courses created yet.")).toBeVisible();
    await expect(management.getByText("Total: 0", { exact: true })).toBeVisible();
    await expect(management.getByRole("searchbox", { name: "Search recorded courses" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Create Recorded Course" })).toBeVisible();
  });

  test("College Admin can retry a temporary course-list failure", async ({ page }) => {
    await initRole(page, "college-admin");
    await mockBackend(page, { collegeStatus: 503 });
    await page.goto("/college-admin/recorded-courses");

    const management = page.getByRole("region", { name: "Recorded course management" });
    await expect(management.getByRole("alert")).toContainText("Temporary recorded course list failure");
    await expect(management.getByRole("link", { name: "Manage" })).toHaveCount(0);

    // Replace only the failed local API fixture; no real Django requests.
    await page.route(url => url.pathname.endsWith("/api/recorded-courses/college-admin/courses/"), async route => {
      const headers = {
        "Access-Control-Allow-Origin": route.request().headers().origin || "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      };
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers });
        return;
      }
      await route.fulfill({ status: 200, headers, json: { courses: paidCourses } });
    });

    await management.getByRole("button", { name: "Retry loading courses" }).click();
    await expect(management.getByRole("alert")).toHaveCount(0);
    await expect(management.getByText("Showing 2 of 2 recorded courses")).toBeVisible();
    await expect(management.getByRole("link", { name: "Manage" })).toHaveCount(2);
  });

  test("College Admin creates a course through a simulated POST and refreshes the list", async ({ page }) => {
    const paid = [...paidCourses];
    await initRole(page, "college-admin");
    await mockBackend(page, { paid });

    let posted;
    await page.route(url => url.pathname.endsWith("/api/recorded-courses/college-admin/courses/"), async route => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      posted = route.request().postDataJSON();
      paid.push({
        id: 920, title: posted.title, description: posted.description, price: posted.price,
        access_duration_days: posted.access_duration_days, is_active: posted.is_active, lesson_count: 0,
      });
      await route.fulfill({
        status: 201,
        headers: { "Access-Control-Allow-Origin": route.request().headers().origin || "*" },
        json: { id: 920 },
      });
    });

    await page.goto("/college-admin/recorded-courses");
    const create = page.getByRole("region", { name: "Create recorded course" });
    await create.getByRole("textbox", { name: "Course Title" }).fill("QA Newly Created Course");
    await create.getByRole("spinbutton", { name: "Price (₹)" }).fill("49.50");
    await create.getByRole("spinbutton", { name: "Access Duration (Days)" }).fill("60");
    await create.getByRole("textbox", { name: "Description" }).fill("Generated by browser fixture");
    await create.getByRole("checkbox", { name: "Active" }).uncheck();

    await create.getByRole("button", { name: "Create Course" }).click();
    await expect(create.getByRole("status")).toHaveText("Course created successfully.");
    await expect(create.getByRole("textbox", { name: "Course Title" })).toHaveValue("");
    await expect(create.getByRole("spinbutton", { name: "Access Duration (Days)" })).toHaveValue("180");
    expect(posted).toMatchObject({
      title: "QA Newly Created Course", price: "49.50", access_duration_days: 60,
      is_active: false,
    });

    const management = page.getByRole("region", { name: "Recorded course management" });
    await expect(management.getByText("Showing 3 of 3 recorded courses")).toBeVisible();
    const newRow = management.getByRole("row").filter({ hasText: "QA Newly Created Course" });
    await expect(newRow.getByRole("link", { name: "Manage" })).toHaveAttribute(
      "href", "/college-admin/recorded-courses/920",
    );
  });

  test("Teacher sees assigned courses and their management links", async ({ page }) => {
    await initRole(page, "teacher");
    await mockBackend(page);
    await page.goto("/teacher/recorded-courses");
    await expect(page.getByRole("heading", { name: "My Recorded Learning Courses" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "QA Recorded Chemistry" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "QA Recorded Mathematics" })).toBeVisible();
    const links = page.getByRole("link", { name: "Manage course" });
    await expect(links).toHaveCount(2);
    await expect(links.first()).toHaveAttribute("href", "/teacher/recorded-courses/911");
    await expect(links.last()).toHaveAttribute("href", "/teacher/recorded-courses/913");
    await expect(page.getByText("2 modules · 4 lessons")).toBeVisible();
  });

  test("Teacher sees helpful empty state when no courses are assigned", async ({ page }) => {
    await initRole(page, "teacher");
    await mockBackend(page, { assigned: [] });
    await page.goto("/teacher/recorded-courses");
    await expect(page.getByText("No learning courses have been assigned to you yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Manage course" })).toHaveCount(0);
  });

  test("Teacher sees a permission error without showing assigned courses", async ({ page }) => {
    await initRole(page, "teacher");
    await mockBackend(page, { teacherStatus: 403 });
    await page.goto("/teacher/recorded-courses");
    await expect(page.getByText("Recorded Learning unavailable for QA teacher")).toBeVisible();
    await expect(page.getByRole("link", { name: "Manage course" })).toHaveCount(0);
  });

  test("Teacher can search, sort and reset assigned course filters", async ({ page }) => {
    await initRole(page, "teacher");
    await mockBackend(page);
    await page.goto("/teacher/recorded-courses");

    await expect(page.getByText("Showing 2 of 2 assigned courses")).toBeVisible();
    const search = page.getByRole("searchbox", { name: "Search assigned courses" });
    const sort = page.getByRole("combobox", { name: "Sort assigned courses" });

    await search.fill("synthetic course");
    await expect(page.getByText("Showing 1 of 2 assigned courses")).toBeVisible();
    await expect(page.getByRole("heading", { name: "QA Recorded Chemistry" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "QA Recorded Mathematics" })).toHaveCount(0);

    await search.fill("");
    await sort.selectOption("title_desc");
    const courseHeadings = page.locator(".teacher-dashboard-content .card h2");
    await expect(courseHeadings.first()).toHaveText("QA Recorded Mathematics");
    await sort.selectOption("most_lessons");
    await expect(courseHeadings.first()).toHaveText("QA Recorded Chemistry");

    await search.fill("not-a-course");
    await expect(page.getByRole("heading", { name: "No matching courses" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Manage course" })).toHaveCount(0);
    await page.getByRole("button", { name: "Clear course filters" }).click();
    await expect(page.getByText("Showing 2 of 2 assigned courses")).toBeVisible();
    await expect(search).toHaveValue("");
    await expect(sort).toHaveValue("assigned");
    await expect(page.getByRole("link", { name: "Manage course" })).toHaveCount(2);
  });

  test("Teacher can retry a temporary courses API error", async ({ page }) => {
    await initRole(page, "teacher");
    await mockBackend(page, { teacherStatus: 503 });
    await page.goto("/teacher/recorded-courses");

    await expect(page.locator(".teacher-dashboard-content [role='alert']")).toContainText("Recorded Learning unavailable for QA teacher");
    await expect(page.getByRole("link", { name: "Manage course" })).toHaveCount(0);

    // Later route registration takes precedence over the 503 fixture.
    await page.route(url => url.pathname.endsWith("/api/recorded-courses/learning/manage/courses/"), async route => {
      const headers = {
        "Access-Control-Allow-Origin": route.request().headers().origin || "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      };
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers });
        return;
      }
      await route.fulfill({ status: 200, headers, json: { courses: teacherCourses } });
    });

    await page.getByRole("button", { name: "Retry loading courses" }).click();
    await expect(page.locator(".teacher-dashboard-content [role='alert']")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "QA Recorded Chemistry" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Manage course" })).toHaveCount(2);
  });
});
