import { expect, test } from "@playwright/test";

/**
 * Lastmessung mit einer realistisch großen Bibliothek.
 *
 * Anlass: Rückmeldung vom Gerät – mit vielen Rezepten wird das Laden zäh, der
 * Tab-Wechsel stockt und Karten öffnen sich manchmal erst nach mehrfachem
 * Tippen. Diese Spec erzeugt 120 Rezepte direkt in IndexedDB (gleiche
 * Struktur, die die App liest) und misst drei Dinge:
 *
 * 1. `list`   – Navigation bis die erste Karte sichtbar ist
 * 2. `all`    – Navigation bis alle Karten im DOM stehen
 * 3. `detail` – Tippen auf eine Karte bis die Detailseite steht
 *
 * Die Schwellen sind bewusst großzügig (langsame CI), aber sie fangen
 * Regressionen: vorher waren es hier mehrere Sekunden.
 */
const COUNT = 120;
const BUDGET_MS = { list: 2500, all: 5000, detail: 2000, jankTotal: 500, tab: 2500 };

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

/** Legt `count` Rezepte roh in den Object-Store (identisch zur App-Struktur). */
async function seedRecipes(page: import("@playwright/test").Page, count: number) {
  // Erst die App laden, damit Dexie das Schema anlegt.
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("onboardingSeenV3", "true");
    localStorage.setItem("onboardingSeenV2", "true");
  });

  // Erst warten, bis die App ihre Bibliothek wirklich gelesen hat: der leere
  // Zustand erscheint nur, wenn Dexie offen ist und der Store existiert.
  // (Eigene `indexedDB.open`-Aufrufe sind hier tabu – eine offene Verbindung
  // blockiert Dexies Schema-Upgrade.)
  await expect(page.getByText("Du hast noch keine Rezepte")).toBeVisible({ timeout: 30_000 });

  await page.evaluate(async (n) => {
    const now = Date.now();
    const colors = ["#c0563a", "#4f7a52", "#b9803a", "#7a5a8c"];
    const categories = ["Hauptgericht", "Vegetarisch", "Pasta", "Backen"];

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("rezept");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("recipes", "readwrite");
      const store = tx.objectStore("recipes");
      for (let i = 0; i < n; i++) {
        store.put({
          id: `seed-${String(i).padStart(4, "0")}-0000-4000-8000-000000000000`,
          title: `Rezept Nummer ${i}`,
          description: "Für die Lastmessung erzeugt.",
          color: colors[i % colors.length],
          // Jede dritte Karte hat ein (nicht erreichbares) Bild: das übt den
          // Pfad „Bild vorhanden" ohne Netzzugriff.
          image: i % 3 === 0 ? `https://example.invalid/${i}.jpg` : undefined,
          servings: 2 + (i % 4),
          prepTime: 10,
          cookTime: 20,
          ingredients: [
            { id: `i${i}-1`, amount: 500, unit: "g", name: "Hähnchenbrust" },
            { id: `i${i}-2`, amount: 2, unit: "Stück", name: "Eier" },
            { id: `i${i}-3`, amount: 200, unit: "ml", name: "Sahne" },
          ],
          steps: [
            { id: `s${i}-1`, order: 1, instruction: "Alles anbraten." },
            { id: `s${i}-2`, order: 2, instruction: "Zehn Minuten köcheln lassen." },
          ],
          category: categories[i % categories.length],
          tags: [],
          favorite: i % 7 === 0,
          createdAt: now - i * 1000,
          updatedAt: now - i * 1000,
          parserVersion: 15,
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    db.close();
  }, count);

  await page.reload();
}

test("Last mit 120 Rezepten: Liste, Scrollen, Detail öffnen", async ({ page }) => {
  test.setTimeout(180_000);
  await seedRecipes(page, COUNT);

  // 1 + 2: Liste
  const t0 = Date.now();
  await page.goto("/recipes");
  await expect(page.getByRole("link", { name: "Rezept Nummer 0" })).toBeVisible({
    timeout: 20_000,
  });
  const listMs = Date.now() - t0;

  await expect(page.locator("article")).toHaveCount(COUNT, { timeout: 30_000 });
  const allMs = Date.now() - t0;

  // Scrollen durch die ganze Liste. Gemessen wird **nicht** die Dauer des
  // Scrollens (das wäre nur die Dauer der Weich-Scroll-Animation), sondern die
  // Rechenlast auf dem Hauptthread: langlaufende Aufgaben über 50 ms.
  const jank = await page.evaluate(async () => {
    const tasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) tasks.push(Math.round(entry.duration));
    });
    observer.observe({ entryTypes: ["longtask"] });

    document.documentElement.style.scrollBehavior = "auto";
    const step = 600;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    observer.disconnect();

    return {
      count: tasks.length,
      total: tasks.reduce((a, b) => a + b, 0),
      worst: tasks.length ? Math.max(...tasks) : 0,
    };
  });

  // 3: Detail öffnen – der Fall aus der Rückmeldung.
  await page.evaluate(() => window.scrollTo(0, 0));
  const card = page.getByRole("link", { name: `Rezept Nummer ${Math.floor(COUNT / 2)}` });
  await card.scrollIntoViewIfNeeded();
  const t2 = Date.now();
  await card.tap();
  await expect(
    page.getByRole("heading", { name: `Rezept Nummer ${Math.floor(COUNT / 2)}` }),
  ).toBeVisible({ timeout: 15_000 });
  const detailMs = Date.now() - t2;

  console.log(
    `PERF · ${COUNT} Rezepte — erste Karte ${listMs} ms · alle Karten ${allMs} ms · ` +
      `Scroll-Last ${jank.count} Aufgaben / ${jank.total} ms (schlimmste ${jank.worst} ms) · ` +
      `Tippen→Detail ${detailMs} ms`,
  );

  expect(listMs, "erste Karte sichtbar").toBeLessThan(BUDGET_MS.list);
  expect(allMs, "alle Karten im DOM").toBeLessThan(BUDGET_MS.all);
  expect(detailMs, "Tippen bis Detailseite steht").toBeLessThan(BUDGET_MS.detail);
  expect(jank.total, "langlaufende Aufgaben beim Scrollen").toBeLessThan(BUDGET_MS.jankTotal);
});

test("Tab-Wechsel bleibt schnell", async ({ page }) => {
  test.setTimeout(120_000);
  await seedRecipes(page, COUNT);

  const times: string[] = [];
  const durations: number[] = [];

  for (const [label, path] of [
    ["Rezepte", "/recipes"],
    ["Start", "/"],
    ["Favoriten", "/favorites"],
    ["Einkaufsliste", "/shopping"],
  ] as const) {
    // Über `href` statt über den zugänglichen Namen: eindeutig und immun gegen
    // Symbol-Accessibility. Der Klick wird programmatisch ausgelöst, damit die
    // Messung die Navigation misst und nicht die Treffererkennung der Maus.
    const link = page.locator(`nav a[href="${path}"]:visible`).first();
    const start = Date.now();
    await link.evaluate((el: HTMLElement) => el.click());
    await expect(page).toHaveURL(new RegExp(path === "/" ? "/$" : `${path}$`), {
      timeout: 15_000,
    });
    await page.waitForSelector("main");
    const elapsed = Date.now() - start;
    durations.push(elapsed);
    times.push(`${label} ${elapsed} ms`);
  }

  console.log(`PERF · Tab-Wechsel — ${times.join(" · ")}`);

  const worst = Math.max(...durations);
  expect(worst, "langsamster Tab-Wechsel").toBeLessThan(BUDGET_MS.tab);
});
