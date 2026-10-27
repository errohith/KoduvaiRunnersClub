import { defineConfig, devices } from "@playwright/test";

/** E2E runs against a running app (dev or `npm start`) on E2E_BASE_URL using the database in .env. */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: { command: "npm run start", url: "http://localhost:3000/api/v1/health", reuseExistingServer: true, timeout: 120_000 },
});
