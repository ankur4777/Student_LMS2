// Run isolated browser tests against the production Next.js build, not
// next dev. This avoids HMR WebSocket failures seen in local Playwright traces.
// This command never runs Django or contacts the production LMS.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const e2eDir = fileURLToPath(new URL(".", import.meta.url));
const frontendDir = fileURLToPath(new URL("..", import.meta.url));

function runNpm(args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", args, {
      cwd,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.once("error", reject);
    child.once("close", code => resolve(code ?? 1));
  });
}

const baseURL = "http://127.0.0.1:3100";
console.log("[MySLS QA] Building the frontend for isolated browser testing.");
console.log("[MySLS QA] Close any running Next.js dev server before this command to avoid .next build conflicts.");

const built = await runNpm(["run", "build"], frontendDir, process.env);
if (built !== 0) {
  console.error("[MySLS QA] Frontend build failed; browser tests were not started.");
  process.exitCode = built;
} else {
  const env = {
    ...process.env,
    E2E_BASE_URL: baseURL,
    E2E_START_WEB_SERVER: "1",
  };
  console.log("[MySLS QA] Running Chromium tests against production Next.js on " + baseURL);
  const result = await runNpm([
    "run", "test", "--",
    "--grep", "Student Learning Center UI|College Admin branding hydration|Student and Teacher branding hydration|Recorded Learning management UI|College Admin course detail UI|Student course detail UI|Student final exam submission and certificate UI|Student module quiz and assignment UI|Teacher module assignment grading UI",
    "--workers=1",
  ], e2eDir, env);
  process.exitCode = result;
}
