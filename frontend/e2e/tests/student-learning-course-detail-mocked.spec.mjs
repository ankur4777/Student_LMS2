import { test, expect } from "@playwright/test";

// Student course detail tests: simulated user, simulated course data, simulated video
// response. No real LMS accounts, streaming endpoints, or production writes.
const courseURL = "/api/recorded-courses/learning/student/courses/901/";
const lessonPrefix = "/api/recorded-courses/learning/student/lessons/";
const playable = {
  id: 921, title: "QA First Lecture", description: "Introduction to the topic",
  position: 1, completed: true, completion_method: "signed_session", verified_duration_seconds: 50,
};
const second = {
  id: 922, title: "QA Second Lecture", description: "Review and practice",
  position: 2, completed: false, completion_method: null, verified_duration_seconds: 75,
};
const lockedLesson = {
  id: 990, title: "Locked QA Lecture", description: "Not available yet",
  position: 1, completed: false, completion_method: null, verified_duration_seconds: null,
};
const baseCourse = {
  id: 901, title: "QA Student Science", description: "Recorded learning fixture",
  completed_lessons: 1, total_lessons: 3, final_exam: null,
  modules: [
    {
      id: 11, title: "QA Open Module", description: "Start learning", position: 1,
      locked: false, completed: false, completed_lessons: 1, total_lessons: 2,
      lessons: [playable, second], resources: [], quiz: null, assignment: null,
    },
    {
      // The real API currently removes the lessons from locked modules.
      // Including one here tests the UI's safety if that contract changes.
      id: 12, title: "QA Locked Module", description: "Later course material", position: 2,
      locked: true, completed: false, completed_lessons: 0, total_lessons: 1,
      lessons: [lockedLesson], resources: [], quiz: null, assignment: null,
    },
  ],
};

function cors(route) {
  return {
    "Access-Control-Allow-Origin": route.request().headers().origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
}

async function setupStudent(page, fixture) {
  await page.addInitScript(() => {
    localStorage.setItem("student_access_token", "browser-only-qa-token");
    localStorage.removeItem("student_refresh_token");
    localStorage.setItem("student_user", JSON.stringify({
      id: 900, name: "QA Course Student", organization: "Browser QA Institute",
    }));
  });

  await page.route(url => url.pathname.includes("/api/"), async route => {
    const path = new URL(route.request().url()).pathname;
    const headers = cors(route);
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (path === courseURL) {
      fixture.detailFetches += 1;
      const status = fixture.status;
      await route.fulfill(status === 200
        ? { status: 200, headers, json: { course: fixture.course } }
        : { status, headers, json: { detail: "Student QA course temporarily unavailable" } });
      return;
    }
    if (path.startsWith(lessonPrefix) && path.endsWith("/play/")) {
      const lessonId = Number(path.slice(lessonPrefix.length).split("/")[0]);
      fixture.playRequests.push(lessonId);
      await route.fulfill({
        status: 200, headers, contentType: "video/webm",
        body: "browser-qa-video-not-real-content",
      });
      return;
    }
    if (path.endsWith("/api/accounts/organization-branding/")) {
      await route.fulfill({ status: 200, headers, json: { name: "Browser QA Institute", logo: "" } });
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
    await route.fulfill({ status: 404, headers, json: { detail: "No browser QA fixture" } });
  });
}

function fixtureFor(course = baseCourse, status = 200) {
  return { course, status, detailFetches: 0, playRequests: [] };
}

test.describe("Student course detail UI (simulated backend)", () => {
  test("shows course progress and only auto-plays an unlocked lesson", async ({ page }) => {
    const fixture = fixtureFor();
    await setupStudent(page, fixture);
    await page.goto("/student/learning/901");
    await expect(page.getByRole("heading", { name: "QA Student Science" })).toBeVisible();
    await expect(page.getByText("1/3", { exact: true })).toBeVisible();
    await expect(page.getByText("33%", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "QA First Lecture" })).toBeVisible();
    await expect(page.getByRole("link", { name: "All courses" }))
      .toHaveAttribute("href", "/student/learning");

    const player = page.getByRole("region", { name: "Course lecture player" });
    await expect(player.locator("video")).toBeVisible();
    await expect(player.getByText("Viewed · Session recorded")).toBeVisible();
    expect(fixture.playRequests).toContain(921);
    expect(fixture.playRequests).not.toContain(990);

    const locked = page.locator("details.learning-module").filter({ hasText: "QA Locked Module" });
    await locked.locator("summary").click();
    await expect(locked).toHaveAttribute("open", "");
    await expect(locked.getByText("Locked — complete previous module")).toBeVisible();
    await expect(locked.getByRole("button", { name: "Locked QA Lecture" })).toBeDisabled();
    expect(fixture.playRequests).not.toContain(990);

    await player.getByRole("button", { name: "Next lecture" }).click();
    await expect(player.getByRole("heading", { name: "QA Second Lecture" })).toBeVisible();
    await expect.poll(() => fixture.playRequests.includes(922)).toBe(true);
    await expect(player.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  test("never selects lessons from locked modules when they appear first", async ({ page }) => {
    const course = {
      ...baseCourse,
      modules: [baseCourse.modules[1], baseCourse.modules[0]],
    };
    const fixture = fixtureFor(course);
    await setupStudent(page, fixture);
    await page.goto("/student/learning/901");
    await expect(page.getByRole("heading", { name: "QA First Lecture" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Course lecture player" }).locator("video")).toBeVisible();
    expect(fixture.playRequests).not.toContain(990);
  });

  test("recovers from a temporary course-detail error without losing navigation", async ({ page }) => {
    const fixture = fixtureFor(baseCourse, 503);
    await setupStudent(page, fixture);
    await page.goto("/student/learning/901");

    await expect(page.getByRole("heading", { name: "Course materials unavailable" })).toBeVisible();
    await expect(page.getByText("Student QA course temporarily unavailable")).toBeVisible();
    await expect(page.getByRole("region", { name: "Course lecture player" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "All courses" }))
      .toHaveAttribute("href", "/student/learning");

    fixture.status = 200;
    await page.getByRole("button", { name: "Retry loading course" }).click();
    await expect(page.getByRole("heading", { name: "QA Student Science" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Course lecture player" })).toBeVisible();
    expect(fixture.detailFetches).toBeGreaterThanOrEqual(2);
  });

  test("shows a useful empty module state when a course has no published modules", async ({ page }) => {
    const fixture = fixtureFor({
      ...baseCourse, completed_lessons: 0, total_lessons: 0, modules: [],
    });
    await setupStudent(page, fixture);
    await page.goto("/student/learning/901");

    await expect(page.getByRole("heading", { name: "QA Student Science" })).toBeVisible();
    await expect(page.getByText("No published modules yet. Please check back later.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Choose a lecture" })).toBeVisible();
    expect(fixture.playRequests).toEqual([]);
  });

  test("redirects to the Student Login when course-detail access expires", async ({ page }) => {
    const fixture = fixtureFor(baseCourse, 401);
    await setupStudent(page, fixture);
    await page.goto("/student/learning/901");
    await expect(page).toHaveURL(/\/student\/login(?:[/?#]|$)/);
    await expect(page.getByRole("heading", { name: "Student Login" })).toBeVisible();
  });
});
