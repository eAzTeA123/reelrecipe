import { expect, test, type Page } from "@playwright/test";

/**
 * „Rezepte aktualisieren": gespeicherte rezeptwelt.de-Rezepte noch einmal durch
 * den Parser schicken.
 *
 * Warum mit abgefangener Route: Der Test darf nicht von einer fremden Webseite
 * abhängen (Netz, Ausfälle, Änderungen dort). `page.route` beantwortet
 * `/api/recipe/parse` deshalb mit einer festen Antwort – geprüft wird die
 * **Logik der App**, nicht die fremde Seite. Dass der echte Abruf funktioniert,
 * ist separat gegen die echte Seite gemessen.
 *
 * Drei Fälle sind bewusst gewählt:
 * A) rezeptwelt ohne Beschreibung  → Tipps und Zutaten kommen dazu
 * B) rezeptwelt, vom Nutzer bearbeitet → eigener Text und umbenannte Zutat bleiben
 * C) anderer Anbieter → wird gar nicht erst angefragt
 */

const REZEPTWELT_URL =
  "https://www.rezeptwelt.de/hauptgerichte-mit-gemuese-rezepte/spinat-risotto/899ild5b-c6243-476130-cfcd2-he8bv9kb";
const CHEFKOCH_URL = "https://www.chefkoch.de/rezepte/123/Toast-Hawaii.html";

const ID_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ID_B = "bbbbbbbb-0000-4000-8000-000000000002";
const ID_C = "cccccccc-0000-4000-8000-000000000003";

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

/** Legt die drei Ausgangsrezepte roh in den Object-Store (wie die App liest). */
async function seed(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("onboardingSeenV3", "true");
    localStorage.setItem("onboardingSeenV2", "true");
  });
  await expect(page.getByText("Du hast noch keine Rezepte")).toBeVisible({ timeout: 30_000 });

  await page.evaluate(
    ({ idA, idB, idC, rezeptweltUrl, chefkochUrl }) => {
      const now = Date.now();
      return new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("rezept");
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("recipes", "readwrite");
          const store = tx.objectStore("recipes");

          // A) rezeptwelt, noch ohne Beschreibung
          store.put({
            id: idA,
            title: "Spinat Risotto",
            color: "#c0563a",
            sourceUrl: rezeptweltUrl,
            ingredients: [{ id: "a1", amount: 1, unit: "Stück", name: "Zwiebel" }],
            steps: [{ id: "as1", order: 1, instruction: "Zwiebel zerkleinern." }],
            category: "Hauptgericht",
            tags: [],
            favorite: false,
            createdAt: now,
            updatedAt: now,
            parserVersion: 15,
            parseSnapshot: {
              title: "Spinat Risotto",
              ingredients: [{ name: "Zwiebel", amount: 1, unit: "Stück" }],
              steps: ["Zwiebel zerkleinern."],
            },
          });

          // B) rezeptwelt, vom Nutzer bearbeitet: Zutat umbenannt, Butter gelöscht,
          //    eigener Beschreibungstext
          store.put({
            id: idB,
            title: "Mein Risotto",
            description: "Mein eigener Hinweis.",
            color: "#4f7a52",
            sourceUrl: rezeptweltUrl,
            ingredients: [{ id: "b1", amount: 1, unit: "Stück", name: "rote Zwiebel" }],
            steps: [{ id: "bs1", order: 1, instruction: "Zwiebel zerkleinern." }],
            category: "Hauptgericht",
            tags: [],
            favorite: false,
            createdAt: now - 1000,
            updatedAt: now - 1000,
            parserVersion: 15,
            parseSnapshot: {
              title: "Spinat Risotto",
              ingredients: [
                { name: "Zwiebel", amount: 1, unit: "Stück" },
                { name: "Butter", amount: 20, unit: "g" },
              ],
              steps: ["Zwiebel zerkleinern."],
            },
          });

          // C) anderer Anbieter – darf nicht angefasst werden
          store.put({
            id: idC,
            title: "Toast Hawaii",
            color: "#b9803a",
            sourceUrl: chefkochUrl,
            ingredients: [{ id: "c1", amount: 8, unit: "Scheiben", name: "Toastbrot" }],
            steps: [{ id: "cs1", order: 1, instruction: "Toast belegen." }],
            category: "Hauptgericht",
            tags: [],
            favorite: false,
            createdAt: now - 2000,
            updatedAt: now - 2000,
            parserVersion: 15,
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
    { idA: ID_A, idB: ID_B, idC: ID_C, rezeptweltUrl: REZEPTWELT_URL, chefkochUrl: CHEFKOCH_URL },
  );

  await page.reload();
}

test("Rezeptwelt-Rezepte neu einlesen, eigene Änderungen bleiben erhalten", async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page);

  const requested: string[] = [];
  await page.route("**/api/recipe/parse", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as { url?: string };
    const url = String(body.url ?? "");
    requested.push(url);

    if (!url.includes("rezeptwelt.de")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "not_a_recipe" }),
      });
      return;
    }

    // Antwort wie beim echten rezeptwelt-Import: Zutaten, Schritte, Tipps
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "success",
        recipe: {
          title: "Spinat Risotto",
          ingredients: [
            { id: "n1", amount: 150, unit: "g", name: "Parmesan" },
            { id: "n2", amount: 250, unit: "g", name: "Risottoreis" },
            { id: "n3", amount: 1, unit: "Stück", name: "Zwiebel" },
          ],
          steps: [
            { id: "ns1", order: 1, instruction: "Parmesan zerkleinern." },
            { id: "ns2", order: 2, instruction: "Reis dünsten." },
          ],
          servings: 4,
          prepTime: 15,
          cookTime: 22,
          image: "https://example.invalid/risotto.jpg",
          description: "Tipps: • Gemüsebrühe statt Weißwein.",
          sourceUrl: url,
          confidence: 0.95,
          highConfidence: true,
          fieldSources: {},
        },
      }),
    });
  });

  await page.goto("/settings");

  // Nur die beiden rezeptwelt-Rezepte werden angeboten
  const button = page.getByRole("button", { name: /neu einlesen/ });
  await expect(button).toContainText("2 Rezepte neu einlesen");
  await button.click();

  // Zusammenfassung
  await expect(page.getByText(/2 aktualisiert · 0 unverändert · 0 fehlgeschlagen/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Tipps ergänzt: 1/)).toBeVisible();
  await expect(page.getByText(/Eigene Änderungen geschützt:/)).toBeVisible();

  // Der andere Anbieter wurde nicht angefragt
  expect(requested.filter((url) => url.includes("chefkoch"))).toHaveLength(0);
  expect(requested).toHaveLength(2);

  // A: Tipps und neue Zutaten sind da
  await page.goto(`/recipes/${ID_A}`);
  await expect(page.getByText("Tipps: • Gemüsebrühe statt Weißwein.")).toBeVisible();
  await expect(page.getByText("Risottoreis")).toBeVisible();

  // B: eigener Text und umbenannte Zutat blieben stehen, gelöschte Butter kam nicht zurück
  await page.goto(`/recipes/${ID_B}`);
  await expect(page.getByText("Mein eigener Hinweis.")).toBeVisible();
  await expect(page.getByText("rote Zwiebel")).toBeVisible();
  await expect(page.getByText("Parmesan")).toBeVisible();
  await expect(page.getByText("Butter")).toHaveCount(0);
  await expect(page.getByText("Tipps: • Gemüsebrühe statt Weißwein.")).toHaveCount(0);

  // C: unangetastet
  await page.goto(`/recipes/${ID_C}`);
  await expect(page.getByText("Toastbrot")).toBeVisible();
});
