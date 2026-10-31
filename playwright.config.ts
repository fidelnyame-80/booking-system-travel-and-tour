import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_OUTPUT_DIR: ".next-qa",
      BOOKING_DATA_DIR: path.join(process.cwd(), ".test-data", `browser-${process.pid}-${Date.now()}`),
      DATABASE_URL: "",
    },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "iphone-webkit", use: { ...devices["iPhone 13"], defaultBrowserType: "webkit" } },
    { name: "small-mobile-chromium", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 } } },
  ],
});
