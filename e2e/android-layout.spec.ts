import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow } from "./helpers";

/**
 * Layout-Prüfung für **Android**.
 *
 * Auf dem iPhone war die App in Ordnung, auf Android wurde Text abgeschnitten.
 * Die Unterschiede liegen nicht im Design, sondern in der Plattform:
 * - **Breite**: Viele Android-Handys sind nur 320–360 px breit – schmaler als
 *   jedes iPhone (375/390/430). Genau dort platzte die Startseite.
 * - **Schriftgröße**: Android hat eine System-Schriftgröße („Groß"); die App
 *   nutzt rem-basierte Tokens, also wächst die Typografie mit, feste Höhen nicht.
 * - **Klassische Scrollbar**: Samsung Internet und Firefox auf Android kosten
 *   Breite; Chrome nutzt wie iOS eine Overlay-Scrollbar.
 * - **Font-Boosting**: Chrome auf Android bläht Text in breiten Blöcken auf –
 *   dagegen hilft nur `text-size-adjust: 100%` (ohne Präfix).
 *
 * Der Test prüft deshalb mehrere Android-Profile mit langen Titeln, langen
 * Zutaten und einem nicht trennbaren Link – und vergleicht die Rechtecke der
 * Elemente mit dem sichtbaren Bereich (`horizontalOverflow` aus `helpers.ts`),
 * weil ein Überlauf in einem `overflow-hidden`-Container die Seite nicht
 * scrollen lässt und über `scrollWidth` unsichtbar bleibt.
 */

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";

test.use({
  userAgent: ANDROID_UA,
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
});

const LONG_TITLE = "Harissa Linsen Feta Tacos mit Hummus und Zitronen-Minz-Joghurt";
const LONG_INGREDIENT = "Geriebener Parmigiano Reggiano aus der Kühltheke (ggf. etwas mehr)";
/** Ein einziger, nicht trennbarer Token – typische Ursache für Überläufe. */
const LONG_TOKEN = "https://www.rezeptwelt.de/backen-herzhaft-rezepte/flammkuchen-knusprig/9exnygje-e2d56-724631-cfcd2-6ylvtrr7";

const RECIPE_ID = "eeeeeeee-0000-4000-8000-000000000005";

/**
 * Android-Profile. 360 px ist die häufigste Android-Breite und **schmaler als
 * jedes iPhone** (375/390/430) – genau dort fiel das Layout auf. `fontScale`
 * bildet Androids System-Schriftgröße nach (Einstellung „Groß"): Die App nutzt
 * rem-basierte Tokens, ein größerer Wurzel-Font vergrößert also die gesamte
 * Typografie, während feste Höhen gleich bleiben – so entstehen Überläufe.
 */
const PROFILES = [
  { name: "Pixel 7 (412 px)", width: 412, height: 915, fontScale: 1 },
  { name: "Android üblich (360 px)", width: 360, height: 800, fontScale: 1 },
  { name: "Android 360 px + Schrift groß", width: 360, height: 800, fontScale: 1.25 },
  // Samsung Internet und Firefox auf Android zeigen eine **klassische**
  // Scrollbar, die Breite kostet – iOS und Chrome nutzen eine Overlay-Scrollbar.
  { name: "Android 360 px + klassische Scrollbar (345 px)", width: 345, height: 800, fontScale: 1 },
  { name: "Kleines Android (320 px)", width: 320, height: 568, fontScale: 1 },
];

/** Rezept und Einkaufsliste mit absichtlich langen Texten anlegen. */
async function seedLongContent(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("onboardingSeenV3", "true");
    localStorage.setItem("onboardingSeenV2", "true");
  });
  await expect(page.getByText("Du hast noch keine Rezepte")).toBeVisible({ timeout: 30_000 });

  await page.evaluate(
    ({ id, title, ingredient, token }) => {
      const now = Date.now();
      return new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("rezept");
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(["recipes", "shopping"], "readwrite");
          tx.objectStore("recipes").put({
            id,
            title,
            description: `Ein sehr langer Beschreibungstext mit vielen Wörtern, damit Karte und Detailseite gefordert werden. Quelle: ${token}`,
            color: "#c0563a",
            sourceUrl: token,
            ingredients: [
              { id: "i1", amount: 500, unit: "g", name: ingredient },
              { id: "i2", amount: 2, unit: "EL", name: "Sriracha-Mayonnaise mit Knoblauch und Kräutern" },
              { id: "i3", amount: 1, unit: "Prise", name: "Salz" },
            ],
            steps: [
              {
                id: "s1",
                order: 1,
                instruction:
                  "Alle Zutaten in einer großen Schüssel gründlich vermengen und mindestens dreißig Minuten kalt stellen, damit die Aromen sich verbinden können.",
              },
            ],
            category: "Hauptgericht",
            tags: [],
            favorite: true,
            createdAt: now,
            updatedAt: now,
            parserVersion: 23,
          });
          tx.objectStore("shopping").put({
            id: "sh1",
            name: ingredient,
            amount: 500,
            unit: "g",
            checked: false,
            createdAt: now,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      });
    },
    { id: RECIPE_ID, title: LONG_TITLE, ingredient: LONG_INGREDIENT, token: LONG_TOKEN },
  );

  await page.reload();
}

/**
 * Waagerechter Überlauf: Der Detektor liegt in `helpers.ts`, weil ihn auch
 * `responsive.spec.ts` nutzt – dort hatte die frühere Prüfung nur
 * `document.scrollWidth` betrachtet und den abgeschnittenen Hero-Text nicht
 * gesehen.
 */

test("Android: keine waagerechten Überläufe auf allen Seiten", async ({ page }) => {
  test.setTimeout(180_000);
  await seedLongContent(page);

  const routes = [
    "/",
    "/recipes",
    `/recipes/${RECIPE_ID}`,
    `/recipes/${RECIPE_ID}/cook`,
    "/import",
    "/shopping",
    "/planner",
    "/collections",
    "/settings",
  ];

  const problems: string[] = [];

  for (const profile of PROFILES) {
    await page.setViewportSize({ width: profile.width, height: profile.height });
    // Androids System-Schriftgröße nachbilden (rem-basierte Tokens skalieren mit)
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = `${16 * scale}px`;
    }, profile.fontScale);

    for (const route of routes) {
      await page.goto(route);
      await page.waitForSelector("main");
      await page.evaluate((scale) => {
        document.documentElement.style.fontSize = `${16 * scale}px`;
      }, profile.fontScale);
      await page.waitForTimeout(250);
      const report = await horizontalOverflow(page);
      if (report.scrollWidth > report.innerWidth + 1 || report.offenders.length > 0) {
        problems.push(
          `[${profile.name}] ${route}: scrollWidth ${report.scrollWidth} > ${report.innerWidth}\n  ${report.offenders.join("\n  ") || "(keine Elemente benannt)"}`,
        );
      }
    }
  }

  expect(problems.join("\n"), `Waagerechter Überlauf auf Android:\n${problems.join("\n")}`).toBe("");

  // Font-Boosting: Android Chrome wertet nur die **unpräfixte** Eigenschaft sicher aus.
  await page.goto("/");
  const textSizeAdjust = await page.evaluate(() => getComputedStyle(document.documentElement).textSizeAdjust);
  expect(textSizeAdjust, "text-size-adjust fehlt (Android bläht Text auf)").toBe("100%");

  // Das iPhone-Layout darf sich **nicht** verändert haben: Die Anpassung greift
  // nur bis 380 px, das iPhone ist 390 px breit.
  const displaySize = async (width: number) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.waitForSelector("#import-heading");
    return page.evaluate(() => getComputedStyle(document.querySelector("#import-heading") as HTMLElement).fontSize);
  };
  expect(await displaySize(390), "iPhone 390 px: Display-Schrift muss 44px bleiben").toBe("44px");
  expect(await displaySize(360), "Android 360 px: Display-Schrift muss mitschrumpfen").toBe("39.6px");
});
