import { expect, test, type Page } from "@playwright/test";
import { loadWholeList } from "./helpers";

/**
 * Skalierungsmessung: Wie wächst die Ladezeit mit der Bibliotheksgröße?
 *
 * `perf.spec.ts` prüft 120 Rezepte und hält Schwellen ein. Diese Spec ist eine
 * **Messung ohne enge Schwellen**: Sie nimmt die Kurve bei 120 / 400 / 800
 * Rezepten auf und protokolliert zusätzlich DOM-Knoten und JS-Heap, damit
 * sichtbar wird, wo die Kosten entstehen (Rendern aller Karten? Laden aller
 * Rezepte aus IndexedDB? Bilder?).
 *
 * Bewusst gegen den Produktions-Build (siehe AGENTS.md).
 */
test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

const COUNTS = [120, 400, 800];

async function seedRecipes(page: Page, count: number): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("onboardingSeenV3", "true");
    localStorage.setItem("onboardingSeenV2", "true");
  });
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
          parserVersion: 19,
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

/** Heap und DOM-Größe der aktuellen Seite. */
async function pageCost(page: Page) {
  return page.evaluate(() => {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return {
      domNodes: document.querySelectorAll("*").length,
      heapMb: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : -1,
    };
  });
}

test("Skalierung: Liste, Detail, Tab-Wechsel bei 120/400/800 Rezepten", async ({ page }) => {
  test.setTimeout(600_000);
  const rows: string[] = [];

  for (const count of COUNTS) {
    // Zwischen den Durchläufen die Bibliothek leeren, damit jeder Wert für sich steht.
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("onboardingSeenV3", "true");
      localStorage.setItem("onboardingSeenV2", "true");
    });
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("rezept");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("recipes", "readwrite");
        tx.objectStore("recipes").clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
    await seedRecipes(page, count);

    /*
     * Aufteilung der Kosten – die entscheidende Frage: Ist die **Datenlesung**
     * teuer oder das **Rendern der Karten**? Dafür wird dieselbe Bibliothek
     * einmal auf der Startseite (nur Anzahl, keine Karten) und einmal auf der
     * Rezeptliste (alle Karten) geöffnet.
     */
    const rawRead = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("rezept");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const start = performance.now();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("recipes", "readonly");
        const req = tx.objectStore("recipes").getAll();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      const duration = performance.now() - start;
      db.close();
      return Math.round(duration);
    });

    const dataOnlyStart = Date.now();
    await page.goto("/settings");
    await expect(page.getByText(new RegExp(`^${count} Rezepte`))).toBeVisible({ timeout: 60_000 });
    const dataOnly = Date.now() - dataOnlyStart;

    // Liste: bis zur ersten Karte; danach das Anfangsfenster messen und die
    // ganze Liste durchscrollen (sie rendert portionsweise, siehe
    // `useProgressiveList`).
    const t0 = Date.now();
    await page.goto("/recipes");
    await expect(page.getByRole("link", { name: "Rezept Nummer 0" })).toBeVisible({ timeout: 60_000 });
    const firstCard = Date.now() - t0;
    const windowCost = await pageCost(page);

    const whole = await loadWholeList(page, count);
    const allCards = Date.now() - t0;
    const listCost = await pageCost(page);

    // Detail öffnen
    const card = page.getByRole("link", { name: `Rezept Nummer ${Math.floor(count / 2)}` });
    await card.scrollIntoViewIfNeeded();
    const t1 = Date.now();
    await card.tap();
    await expect(page.getByRole("heading", { name: `Rezept Nummer ${Math.floor(count / 2)}` })).toBeVisible({
      timeout: 60_000,
    });
    const detail = Date.now() - t1;

    // Tab-Wechsel (Startseite als schwerste Seite: sie zählt die Rezepte und
    // rendert den Hero)
    const tabTimes: number[] = [];
    for (const path of ["/", "/recipes", "/shopping"] as const) {
      const link = page.locator(`nav a[href="${path}"]:visible`).first();
      const start = Date.now();
      await link.evaluate((el: HTMLElement) => el.click());
      await expect(page).toHaveURL(new RegExp(path === "/" ? "/$" : `${path}$`), { timeout: 60_000 });
      await page.waitForSelector("main");
      tabTimes.push(Date.now() - start);
    }

    // Scroll-Last: langlaufende Aufgaben auf dem Hauptthread. Die Schrittweite ist
    // groß, damit die Messung nicht selbst zur Last wird (bei 800 Karten wäre ein
    // 600-px-Raster ein Stückweit eine eigene Arbeitslast).
    await page.goto("/recipes");
    await expect(page.getByRole("link", { name: "Rezept Nummer 0" })).toBeVisible({ timeout: 60_000 });
    await loadWholeList(page, count);
    const jank = await page.evaluate(async () => {
      const tasks: number[] = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) tasks.push(Math.round(entry.duration));
      });
      observer.observe({ entryTypes: ["longtask"] });
      document.documentElement.style.scrollBehavior = "auto";
      let steps = 0;
      for (let y = 0; y < document.body.scrollHeight && steps < 80; y += 2000) {
        window.scrollTo(0, y);
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        steps++;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      observer.disconnect();
      return { count: tasks.length, total: tasks.reduce((a, b) => a + b, 0), steps };
    });

    rows.push(
      `${String(count).padStart(4)} Rezepte · IndexedDB ${String(rawRead).padStart(4)} ms · ` +
        `Daten ohne Karten ${String(dataOnly).padStart(5)} ms · erste Karte ${String(firstCard).padStart(5)} ms · ` +
        `ganze Liste durchgescrollt ${String(allCards).padStart(6)} ms · Detail ${String(detail).padStart(5)} ms · ` +
        `Tabs ${tabTimes.map((t) => `${t} ms`).join("/")} · ` +
        `Scroll-Last ${jank.count} Aufgaben/${jank.total} ms (${jank.steps} Schritte) · ` +
        `DOM beim Aufbau ${windowCost.domNodes} Knoten (nach ${whole.cards} Karten: ${listCost.domNodes})`,
    );
  }

  console.log(`PERF-SKALIERUNG\n${rows.map((row) => `  ${row}`).join("\n")}`);

  // Korrektheit: Nach dem Durchscrollen ist die Liste vollständig.
  const last = COUNTS[COUNTS.length - 1];
  await page.goto("/recipes");
  await expect(page.getByRole("link", { name: "Rezept Nummer 0" })).toBeVisible({ timeout: 60_000 });
  const whole = await loadWholeList(page, last);
  expect(whole.cards, "ganze Liste nach dem Durchscrollen").toBe(last);
});

/**
 * Der Wochenplan bietet je Tag eine Rezeptauswahl an. Bei einer großen
 * Bibliothek entstehen dadurch sehr viele `<option>`-Einträge – das ist eine
 * eigene Lastquelle, die nicht in der Listenmessung auftaucht.
 */
test("Wochenplan mit 800 Rezepten", async ({ page }) => {
  test.setTimeout(300_000);
  await seedRecipes(page, 800);

  const domBefore = await page.evaluate(() => document.querySelectorAll("*").length);
  const start = Date.now();
  await page.goto("/planner");
  await page.waitForSelector("select");
  const firstSelect = Date.now() - start;
  await page.waitForTimeout(500);
  const settled = Date.now() - start;

  const options = await page.locator("select option").count();
  const domAfter = await page.evaluate(() => document.querySelectorAll("*").length);

  console.log(
    `PERF-PLANNER · 800 Rezepte — erstes Auswahlfeld ${firstSelect} ms · mit allen Optionen ${settled} ms · ` +
      `${options} Optionen · DOM ${domBefore} → ${domAfter} Knoten`,
  );

  expect(options, "Optionen vorhanden").toBeGreaterThan(800);
});
