import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  /*
   * Großzügigere Wartezeit für Erwartungsprüfungen: Auf einem ausgelasteten
   * Rechner brauchte die Rezeptliste gelegentlich länger als die 5 s
   * Voreinstellung, und der Lauf wurde rot, obwohl die App in Ordnung war. Ein
   * echtes Problem verdeckt das nicht – ein fehlendes Element wird auch nach
   * 10 s nicht sichtbar.
   */
  expect: { timeout: 10_000 },
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
