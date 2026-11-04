import { test, expect } from "@playwright/test";

// This test intentionally uses only a fabricated browser session and an
// inline logo. It never authenticates against a real LMS organization.
const organization = "Hydration QA Campus";
const adminName = "Hydration QA Admin";
const logo = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#fff1ec"/><text x="24" y="29" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#b85c4b">QA</text></svg>'
);

function mockHeaders(route) {
  return {
    "Access-Control-Allow-Origin": route.request().headers().origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
}

test.describe("College Admin branding hydration", () => {
  test("restores a saved institution logo without a server/client mismatch", async ({ page }) => {
    const hydrationErrors = [];
    const recordIfHydrationError = (message) => {
      if (/hydration|server rendered html didn't match|text content does not match|react error #(?:418|423|425)/i.test(message)) {
        hydrationErrors.push(message.slice(0, 500));
      }
    };
    page.on("console", message => {
      if (message.type() === "error") recordIfHydrationError(message.text());
    });
    page.on("pageerror", error => recordIfHydrationError(error.message));

    // Mock only the API requests. Next.js renders the page normally, so its
    // server HTML and the first client render can genuinely be compared.
    await page.route(url => url.pathname.includes("/api/"), async route => {
      const headers = mockHeaders(route);
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers });
        return;
      }
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/api/accounts/college-admin/institution-settings/")) {
        await route.fulfill({ status: 200, headers, json: { name: organization, logo } });
      } else if (path.endsWith("/api/accounts/college-admin/teachers/")) {
        await route.fulfill({ status: 200, headers, json: { teachers: [] } });
      } else if (path.endsWith("/api/notifications/unread-count/")) {
        await route.fulfill({ status: 200, headers, json: { unread_count: 0 } });
      } else if (path.endsWith("/api/notifications/")) {
        await route.fulfill({ status: 200, headers, json: { notifications: [] } });
      } else {
        await route.fulfill({ status: 404, headers, json: { detail: "QA fixture endpoint not configured" } });
      }
    });

    // Inject a saved logo BEFORE client hydration. The old lazy initializer
    // rendered MySLS on the server but a logo immediately in the browser.
    await page.addInitScript(({ organization, adminName, logo }) => {
      localStorage.setItem("college_admin_access_token", "local-browser-qa-only");
      localStorage.removeItem("college_admin_refresh_token");
      localStorage.setItem("college_admin_user", JSON.stringify({
        id: "browser-qa-admin",
        name: adminName,
        username: "browser-qa-admin",
        organization,
        organization_logo: logo,
      }));
    }, { organization, adminName, logo });

    await page.goto("/college-admin/teachers");
    await expect(page.getByRole("heading", { name: "Teachers", exact: true })).toBeVisible();
    await expect(page.locator(".college-admin-brand-name")).toHaveText(organization);
    await expect(page.locator(".college-admin-brand-logo")).toHaveAttribute("src", logo);
    await expect(page.locator(".college-admin-brand-fallback")).toHaveCount(0);
    await expect(page.locator(".teacher-topbar").getByText(adminName, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Faculty Directory" })).toBeVisible();

    expect(hydrationErrors, hydrationErrors.join("\n")).toEqual([]);
  });
});
