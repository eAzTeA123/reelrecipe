import { test } from "@playwright/test";
import fs from "fs";

/**
 * Design-Review: füllt die Bibliothek mit realistischen Rezepten (inkl. eines
 * Rezepts ohne Bild für den Cover-Fallback) und fotografiert die wichtigsten
 * Ansichten in Handy- und Desktopbreite nach e2e/screenshots/design/.
 *
 * Bewusst kein Assertion-Test, sondern ein Werkzeug für Designrunden:
 *   npx playwright test e2e/design-audit.spec.ts
 */
const RECIPES = [
  { title: "Cremiges Knoblauch-Hähnchen", category: "Hauptgericht", color: "#c2410c", prep: 10, cook: 20 },
  { title: "Ofengemüse mit Feta", category: "Vegetarisch", color: "#4f6b4a", prep: 15, cook: 30 },
  { title: "Pasta alla Vodka", category: "Pasta", color: "#a8452c", prep: 10, cook: 25 },
  { title: "Bananenbrot", category: "Backen", color: "#9a6f1f", prep: 15, cook: 45 },
  { title: "Linsen-Dal mit Kokosmilch", category: "Vegan", color: "#7c3aed", prep: 10, cook: 30 },
  // Ohne Bild: prüft den Cover-Fallback
  { title: "Brotzeit mit Radieschen", category: "Beilage", color: "", prep: 5, cook: 0, noImage: true },
];

test("Design-Audit: Home, Liste, Sammlung, Detail", async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync("e2e/screenshots/design", { recursive: true });

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("onboardingSeenV3", "true");
    localStorage.setItem("onboardingSeenV2", "true");
    localStorage.setItem("scroll2cook-storage-hint", "dismissed");
  });
  await page.goto("/recipes");
  await page.waitForTimeout(1500);

  await page.evaluate(
    async (
      recipes: {
        title: string;
        category: string;
        color: string;
        prep: number;
        cook: number;
        noImage?: boolean;
      }[],
    ) => {
      const open = () =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open("rezept");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      let db = await open();
      for (let attempt = 0; attempt < 40 && !db.objectStoreNames.contains("recipes"); attempt++) {
        db.close();
        await new Promise((r) => setTimeout(r, 250));
        db = await open();
      }

      async function blobFor(color: string): Promise<Blob> {
        const canvas = document.createElement("canvas");
        canvas.width = 900;
        canvas.height = 1100;
        const ctx = canvas.getContext("2d")!;
        const grad = ctx.createLinearGradient(0, 0, 900, 1100);
        grad.addColorStop(0, color);
        grad.addColorStop(1, "#f0e3d3");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 900, 1100);
        // Grobe "Teller"-Form, damit die Bilder nicht wie Farbverläufe wirken
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(450, 560, 300, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(450, 560, 210, 0, Math.PI * 2);
        ctx.fill();
        return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85));
      }

      const write = (store: string, rows: unknown[]) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(store, "readwrite");
          rows.forEach((row) => tx.objectStore(store).put(row));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

      const now = Date.now();
      const rows = [];
      for (let i = 0; i < recipes.length; i++) {
        const spec = recipes[i];
        let image: string | undefined;
        if (!spec.noImage) {
          const imageId = `img-${i}`;
          await write("images", [
            { id: imageId, blob: await blobFor(spec.color), mime: "image/jpeg", createdAt: now },
          ]);
          image = `local-image:${imageId}`;
        }
        rows.push({
          id: `22222222-2222-4222-8222-00000000000${i}`,
          title: spec.title,
          image,
          color: spec.color || undefined,
          servings: 2 + i,
          prepTime: spec.prep,
          cookTime: spec.cook,
          category: spec.category,
          ingredients: [
            { id: `i${i}a`, amount: 500, unit: "g", name: "Hähnchenbrust" },
            { id: `i${i}b`, amount: 200, unit: "ml", name: "Sahne" },
          ],
          steps: [
            { id: `s${i}a`, order: 1, instruction: "Alles anbraten und köcheln lassen." },
            { id: `s${i}b`, order: 2, instruction: "Mit Salz und Pfeffer abschmecken." },
          ],
          favorite: i === 1,
          createdAt: now - i * 86_400_000,
          updatedAt: now - i * 86_400_000,
        });
      }
      await write("recipes", rows);
      await write("collections", [
        { id: "c1", name: "Schnelle Küche", order: 0, filter: { maxTotalTime: 30 }, createdAt: now, updatedAt: now },
        { id: "c2", name: "Meal Prep", order: 1, recipeIds: [rows[0].id, rows[4].id], createdAt: now, updatedAt: now },
      ]);
    },
    RECIPES,
  );

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });

    for (const [name, url] of [
      ["home", "/"],
      ["recipes", "/recipes"],
      ["collections", "/collections"],
      ["detail", "/recipes/22222222-2222-4222-8222-000000000000"],
      ["shopping", "/shopping"],
    ] as const) {
      await page.goto(url);
      await page.waitForTimeout(1400);
      await page.screenshot({ path: `e2e/screenshots/design/${width}-${name}.png` });
    }
    await page.goto("/recipes");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `e2e/screenshots/design/${width}-recipes-full.png`, fullPage: true });
  }
});
