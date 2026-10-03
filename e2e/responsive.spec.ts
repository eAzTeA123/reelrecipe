import { expect, test, type Page } from "@playwright/test";
import { createRecipeViaUI, DE_CAPTION, expectNoHorizontalOverflow } from "./helpers";
import fs from "fs";

const VIEWPORTS = [
  { width: 320, height: 568, name: "320" },
  { width: 375, height: 667, name: "375" },
  { width: 390, height: 844, name: "390" },
  { width: 430, height: 932, name: "430" },
  { width: 768, height: 1024, name: "768" },
  { width: 1024, height: 768, name: "1024" },
  { width: 1280, height: 800, name: "1280" },
  { width: 1440, height: 900, name: "1440" },
  { width: 1920, height: 1080, name: "1920" },
];

const PAGES = ["/", "/recipes", "/collections", "/shopping", "/favorites", "/settings", "/import"];

async function noHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));
  expect(result.scroll, "horizontaler Overflow").toBeLessThanOrEqual(result.inner);
}

/**
 * Frühere Prüfung – bleibt als schnelle Vorprüfung erhalten, greift aber zu kurz:
 * Ein zu breiter Inhalt in einem `overflow-hidden`-Container scrollt die Seite
 * nicht, sondern wird abgeschnitten. Deshalb zusätzlich die Prüfung auf
 * Elementebene aus `helpers.ts`.
 */
async function assertNoOverflow(page: Page, context: string) {
  await noHorizontalOverflow(page);
  await expectNoHorizontalOverflow(page, context);
}

for (const vp of VIEWPORTS) {
  test.describe(`Viewport ${vp.name}px`, () => {
    test(`kein Overflow auf allen Seiten`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      for (const p of PAGES) {
        await page.goto(p);
        await page.waitForLoadState("networkidle");
        await assertNoOverflow(page, `Viewport ${vp.name} – ${p}`);
        fs.mkdirSync("e2e/screenshots", { recursive: true });
        await page.screenshot({
          path: `e2e/screenshots/${vp.name}-${p === "/" ? "home" : p.slice(1)}.png`,
        });
      }
    });
  });
}

test.describe("gefüllte App – 390px & 1440px", () => {
  for (const vp of [
    { width: 390, height: 844, name: "390-full" },
    { width: 1440, height: 900, name: "1440-full" },
  ]) {
    test(`Detail/Review/Modal bei ${vp.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await createRecipeViaUI(page, DE_CAPTION);
      fs.mkdirSync("e2e/screenshots", { recursive: true });
      await page.screenshot({ path: `e2e/screenshots/${vp.name}-detail.png`, fullPage: true });
      await assertNoOverflow(page, `${vp.name} – Detail`);

      await page.goto(`/recipes`);
      await page.screenshot({ path: `e2e/screenshots/${vp.name}-list.png` });
      await assertNoOverflow(page, `${vp.name} – Liste`);

      // Lösch-Dialog
      await page.goto("/");
      await page.getByText("Creamy Garlic Chicken").first().click();
      await page.getByRole("button", { name: "Rezept löschen" }).click();
      await page.screenshot({ path: `e2e/screenshots/${vp.name}-dialog.png` });
      await assertNoOverflow(page, `${vp.name} – Dialog`);
      await page.getByRole("button", { name: "Abbrechen" }).click();
    });
  }
});
