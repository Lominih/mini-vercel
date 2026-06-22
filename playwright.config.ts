import { defineConfig, devices } from "@playwright/test";

const API_URL = process.env.API_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "e2e-report", open: "never" }],
    ["list"],
  ],
  use: {
    baseURL: API_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: API_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
