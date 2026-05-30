import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright walkthrough (§1.8). Builds + serves the production bundle, then drives
 * the key flows and captures screenshots into /screenshots. No real daemon is
 * required: UI flows (lock/unlock, import, switch, asset list, receive, send,
 * multi-send, merge preview) are exercised against the offline app; RPC calls are
 * stubbed at the network layer inside the spec.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    viewport: { width: 420, height: 860 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
