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

export interface HorizontalOverflow {
  scrollWidth: number;
  innerWidth: number;
  /** Oberste Elemente, die über den sichtbaren Bereich hinausragen. */
  offenders: string[];
}

/**
 * Sucht waagerechten Überlauf – **auf Elementebene**, nicht nur am Dokument.
 *
 * Warum das nötig ist: Ein zu breiter Inhalt in einem Container mit
 * `overflow-hidden` (z. B. die Hero-Karte der Startseite) lässt
 * `document.documentElement.scrollWidth` **unverändert** – die Seite scrollt
 * nicht, der Text ist nur abgeschnitten. Die frühere Prüfung über `scrollWidth`
 * sah deshalb nichts, während auf Android (360 px) ein Teil der Überschrift
 * fehlte. Diese Funktion vergleicht die Rechtecke aller Elemente mit dem
 * sichtbaren Bereich.
 *
 * Absichtlich scrollende Bereiche (Zutaten-Chips, Tabellen) und Unsichtbares
 * zählen nicht. Gemeldet wird nur das **oberste** Element je Zweig, sonst
 * erzeugt ein zu breiter Container Dutzende Folgemeldungen für seine Kinder.
 */
export async function horizontalOverflow(page: Page): Promise<HorizontalOverflow> {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const doc = document.documentElement;

    const scrollableAncestor = (element: Element): boolean => {
      let node: Element | null = element;
      while (node && node !== doc) {
        const style = getComputedStyle(node);
        if (style.overflowX === "auto" || style.overflowX === "scroll") return true;
        node = node.parentElement;
      }
      return false;
    };

    const overflowing: HTMLElement[] = [];
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (rect.right <= width + 1 && rect.left >= -1) continue;
      if (scrollableAncestor(element)) continue;
      if (element.classList.contains("sr-only") || element.classList.contains("skip-link")) continue;
      overflowing.push(element);
    }

    const roots = overflowing.filter(
      (element) => !overflowing.some((other) => other !== element && other.contains(element)),
    );

    const describe = (element: HTMLElement): string => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const classes = (element.className || "").toString().split(/\s+/).filter(Boolean).slice(0, 5).join(".");
      return (
        `<${element.tagName.toLowerCase()}${classes ? ` class="${classes}"` : ""}> ` +
        `${Math.round(rect.left)}…${Math.round(rect.right)} (Breite ${Math.round(rect.width)}, ` +
        `padding ${style.paddingLeft}/${style.paddingRight}) „${(element.textContent || "").trim().slice(0, 30)}"`
      );
    };

    return {
      scrollWidth: doc.scrollWidth,
      innerWidth: width,
      offenders: roots.slice(0, 6).map(describe),
    };
  });
}

/** Kurzform für Specs: Überlauf prüfen und mit lesbarer Meldung fehlschlagen. */
export async function expectNoHorizontalOverflow(page: Page, context: string): Promise<void> {
  const report = await horizontalOverflow(page);
  const problems: string[] = [];
  if (report.scrollWidth > report.innerWidth + 1) {
    problems.push(`Seite scrollt waagerecht (${report.scrollWidth} > ${report.innerWidth})`);
  }
  problems.push(...report.offenders);
  expect(problems, `${context}: waagerechter Überlauf\n${problems.join("\n")}`).toEqual([]);
}
