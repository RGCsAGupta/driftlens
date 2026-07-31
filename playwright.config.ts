import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  retries: 0,
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: "npm run start",
    reuseExistingServer: false,
    timeout: 60_000,
    url: "http://127.0.0.1:3000",
  },
  workers: 1,
});
