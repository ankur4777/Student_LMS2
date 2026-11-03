import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const startWebServer = process.env.E2E_START_WEB_SERVER === "1";

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  expect: { timeout: 12_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(startWebServer ? {
    webServer: {
      command: `npm run start -- -p ${new URL(baseURL).port || "3000"}`,
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      url: `${baseURL}/college-admin/login`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  } : {}),
});
