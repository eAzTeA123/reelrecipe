import { expect, type Page } from "@playwright/test";

export const DE_CAPTION = `Creamy Garlic Chicken
für 2 Portionen | 25 Minuten

Zutaten:
500 g Hähnchenbrust
2 Stück Eier
200 ml Sahne
50 g Parmesan

Zubereitung:
1. Hähnchen schneiden und anbraten.
2. Sahne und Parmesan dazugeben.
3. 10 Minuten köcheln lassen.`;

export const EN_CAPTION = `Easy Pasta Bake
Serves 4
Prep time: 15 minutes

Ingredients
400 g pasta
2 cups mozzarella
1/2 tsp salt

Instructions
1. Cook the pasta.
2. Mix everything and bake.`;

/** Legt ein Rezept über den echten Import-Flow an und landet auf der Detailseite. */
export async function createRecipeViaUI(page: Page, caption: string): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("onboardingSeenV3", "true");
    localStorage.setItem("onboardingSeenV2", "true");
  });
  await page.goto("/import");
  await page.getByRole("button", { name: "Rezepttext direkt einfügen" }).click();
  await page.getByLabel("Rezepttext einfügen").fill(caption);
  await page.getByRole("button", { name: "Rezept erkennen" }).click();
  await expect(page.getByRole("heading", { name: "Rezept prüfen" })).toBeVisible();
  await page.getByRole("button", { name: "Rezept speichern" }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}/, { timeout: 15_000 });
}

/** Von der Daumenregel: jedes Bedienziel mindestens 44 × 44 px. */
export const MIN_TAP = 44;

/**
 * Sammelt Bedienziele, die kleiner als 44 × 44 px sind – optional auf einen
 * Teilbaum begrenzt (z. B. `[role="dialog"]`).
 *
 * Bewusste Ausnahmen: Links im Fließtext (`display: inline innerhalb eines
 * Absatzes`) sind keine Daumenziele, Unsichtbares zählt nicht, und der
 * Skip-Link wird übergangen.
 */
export async function smallTapTargets(page: Page, rootSelector?: string): Promise<string[]> {
  return page.evaluate(
    ({ min, selector }) => {
      const targets =
        'a[href], button, [role="radio"], select, summary, label:has(input[type="checkbox"])';
      const root = selector ? document.querySelector(selector) : document;
      if (!root) return [`Wurzel ${selector} nicht gefunden`];

      const offenders: string[] = [];
      for (const el of Array.from(root.querySelectorAll<HTMLElement>(targets))) {
        if (el.classList.contains("skip-link")) continue;
        if (el.closest(".sr-only")) continue;

        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        if (el.tagName === "A" && style.display === "inline") continue;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.height >= min && rect.width >= min) continue;

        const label = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40);
        offenders.push(
          `<${el.tagName.toLowerCase()}> "${label}" ${Math.round(rect.width)}×${Math.round(rect.height)}`,
        );
      }
      return offenders;
    },
    { min: MIN_TAP, selector: rootSelector },
  );
}

/*
 * Hinweis: Hier lag früher ein `clearStorage`, das bei laufender App die
 * IndexedDB löschte. Das ist eine Race Condition – Dexie hält die Verbindung,
 * der Löschversuch löst in `db.ts` ein `versionchange`-Reload aus und reißt dem
 * Test den Auswertungskontext weg. Es wurde von keiner Spec genutzt; Playwright
 * gibt jedem Test ohnehin einen frischen Kontext mit leerer Bibliothek.
 */
