import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    locale: "de-DE",
  },
  webServer: {
    command: "npx next start -p 3100",
    port: 3100,
    timeout: 60_000,
    reuseExistingServer: true,
  },
});
