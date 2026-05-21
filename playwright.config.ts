import { defineConfig, devices } from "@playwright/test";

// Tests run against `npm run start:test` on PORT=4321 to avoid colliding
// with other Next.js dev servers commonly running on 3000/3001 on the
// same machine.
const BASE_URL = "http://localhost:4321";

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { height: 800, width: 1280 },
      },
    },
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 14"] },
    },
  ],
  reporter: process.env.CI ? "line" : "html",
  retries: process.env.CI ? 2 : 0,
  testDir: "./tests/e2e",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run start:test",
    reuseExistingServer: !process.env.CI,
    stderr: "pipe",
    stdout: "ignore",
    timeout: 120_000,
    url: BASE_URL,
  },
  workers: process.env.CI ? 1 : undefined,
});
