import { defineConfig, devices } from "@playwright/test";

// Tests run against `npm run start:test` on PORT=4321 to avoid colliding
// with other Next.js dev servers commonly running on 3000/3001 on the
// same machine.
const BASE_URL = "http://localhost:4321";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 14"] },
    },
  ],
  webServer: {
    command: "npm run start:test",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
