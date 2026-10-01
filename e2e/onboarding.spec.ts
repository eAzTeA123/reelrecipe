import { expect, test } from "@playwright/test";
import { smallTapTargets } from "./helpers";

/**
 * Die Einführung ist der erste Eindruck – hier wird sie festgenagelt:
 * alle fünf Schritte als Screenshot in hell und dunkel (Dateien unter
 * `e2e/screenshots/design/`) und die Daumenregel im Dialog.
 *
 * Geöffnet wird über den URL-Schalter `?onboarding=1`, den die Komponente
 * selbst kennt – dadurch braucht der Test keinen Klickpfad durch die App.
 */
const STEPS = [1, 2, 3, 4, 5];

test("Einführung: fünf Schritte, hell und dunkel", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });

  const dialog = page.getByRole("dialog");
  const report: string[] = [];

  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/?onboarding=1");
    await expect(dialog).toBeVisible();

    for (const step of STEPS) {
      // Die Zeichnung muss da sein (sie trägt den Schritt).
      await expect(dialog.locator("svg.i-svg")).toBeVisible();
      // Bewegung abwarten: das Bild soll den Ruhezustand zeigen, nicht die
      // halb gelaufene Animation.
      await page.waitForTimeout(1400);
      await page.screenshot({
        path: `e2e/screenshots/design/390-${theme}-onboarding-${step}.png`,
      });

      const offenders = await smallTapTargets(page, '[role="dialog"]');
      if (offenders.length > 0) {
        report.push(`${theme} · Schritt ${step}\n  ${offenders.join("\n  ")}`);
      }

      if (step < STEPS.length) {
        await dialog.getByRole("button", { name: /Weiter/ }).click();
      }
    }
  }

  expect(report.join("\n"), "Zu kleine Bedienziele im Dialog").toEqual("");
});

test("Einführung: Tastatur und reduzierte Bewegung", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?onboarding=1");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Bei reduzierter Bewegung muss die Zeichnung vollständig sichtbar sein:
  // die Bewegung liegt nur in Keyframes, der Ruhezustand ist das Endbild.
  const illustrationOpacity = await dialog
    .locator("svg.i-svg g")
    .first()
    .evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(illustrationOpacity), "Zeichnung bleibt bei reduzierter Bewegung sichtbar").toBeGreaterThan(0.9);

  // Der Fokus startet im Dialog und die Falle hält ihn dort: der erste Tab
  // erreicht den Überspringen-Knopf, nicht ein Element hinter dem Overlay.
  await page.keyboard.press("Tab");
  const skip = dialog.getByRole("button", { name: /Überspringen|Skip/ });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden({ timeout: 5000 });
});
