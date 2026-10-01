import { expect, test } from "@playwright/test";

/**
 * Wächter für die Bildmarke.
 *
 * Anlass: Ein Icon kann mit HTTP 200 ausgeliefert werden und vom Browser
 * trotzdem nicht gerendert werden. Genau das passierte, als ein Kommentar in
 * `icon.svg` zwei Bindestriche enthielt – in XML verboten, die Datei damit
 * ungültig, im Navigationsleisten-Screenshot stand nur der Alt-Text. Ein reiner
 * Statuscheck hätte das nie bemerkt.
 */
const ICON_ROUTES = [
  "/icon.svg",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/icon-1024.png",
  "/apple-icon.png",
  "/favicon.ico",
];

test("Die Bildmarke lädt wirklich", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const logo = page.locator('img[alt="Scroll2Cook Logo"]');
  await expect(logo).toBeVisible();

  // `naturalWidth` ist der entscheidende Wert: > 0 heißt, der Browser hat das
  // Bild tatsächlich dekodiert. Ein 200-er Status allein genügt nicht.
  const decoded = await logo.evaluate(
    (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
  );
  expect(decoded, "icon.svg wird vom Browser nicht gerendert").toBe(true);
});

test("icon.svg ist gültiges SVG und alle Icon-Routen antworten", async ({ page }) => {
  await page.goto("/");

  const parseError = await page.evaluate(async () => {
    const res = await fetch("/icon.svg");
    if (!res.ok) return `Status ${res.status}`;
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    return doc.querySelector("parsererror")?.textContent ?? null;
  });
  expect(parseError, "icon.svg ist kein gültiges SVG").toBeNull();

  for (const route of ICON_ROUTES) {
    const status = await page.evaluate(async (path) => {
      const res = await fetch(path);
      return res.ok ? res.status : `${res.status}`;
    }, route);
    expect(status, `${route} nicht erreichbar`).toBe(200);
  }
});
