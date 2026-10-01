import { expect, test } from "@playwright/test";
import { createRecipeViaUI, smallTapTargets, DE_CAPTION } from "./helpers";

/**
 * Barrierefreiheits-Wächter für die Daumenregel: **jedes** Bedienziel auf dem
 * Handy ist mindestens 44 × 44 px groß (Prüfung: `smallTapTargets`).
 * Geprüft wird bei 390 px Breite, weil am Desktop eine Maus greift.
 */

test("Bedienziele sind mindestens 44 px groß (hell und dunkel)", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });

  await createRecipeViaUI(page, DE_CAPTION);
  const detailUrl = page.url();

  // Alle Verstöße in einem Lauf sammeln, statt am ersten abzubrechen.
  const report: string[] = [];

  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });

    for (const url of ["/", "/recipes", detailUrl, "/shopping", "/settings"]) {
      await page.goto(url);
      await page.waitForSelector("main");
      await page.waitForTimeout(600);
      const offenders = await smallTapTargets(page);
      if (offenders.length > 0) {
        report.push(`${theme} · ${url}\n  ${offenders.join("\n  ")}`);
      }
    }
  }

  expect(report.join("\n"), "Zu kleine Bedienziele").toEqual("");
});


/**
 * Die untere Navigation ist fixiert. Auf iOS bricht `position: fixed`, sobald
 * ein Vorfahre oder das Element selbst `backdrop-filter`/`transform` bekommt –
 * die Leiste scrollt dann mit. Dieser Test hält das strukturell fest.
 */
test("Untere Navigation bleibt beim Scrollen am unteren Rand", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Detailseite: lang genug zum Scrollen und enthält zusätzlich die klebrige Aktionsleiste.
  await createRecipeViaUI(page, DE_CAPTION);

  const nav = page.locator('nav[aria-label="Hauptnavigation"]:visible');
  const before = await nav.boundingBox();
  expect(before, "Leiste nicht gefunden").not.toBeNull();

  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(400);
  const after = await nav.boundingBox();
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled, "Seite war nicht scrollbar – Test wäre wertlos").toBeGreaterThan(200);

  // Absicherung gegen die beiden iOS-Fallen: eine Verankerung, die auf `auto`
  // zurückfallen kann, und ein Weichzeichner auf der fixierten Leiste.
  const styles = await nav.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bottom: s.bottom, filter: s.backdropFilter || s.filter };
  });
  expect(styles.bottom, "bottom darf nicht auf auto zurückfallen").not.toBe("auto");
  expect(["none", ""], "kein backdrop-filter/filter auf fixierten Leisten").toContain(
    styles.filter,
  );

  // Sitzt unten am Viewport (schwebende Kapsel, deshalb mit Abstand) …
  const distanceToBottom = 844 - (after!.y + after!.height);
  expect(distanceToBottom).toBeGreaterThanOrEqual(0);
  expect(distanceToBottom, "Leiste klebt nicht am unteren Rand").toBeLessThanOrEqual(40);
  // … und bewegt sich beim Scrollen nicht.
  expect(Math.round(after!.y)).toBe(Math.round(before!.y));
});