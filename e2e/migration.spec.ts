import { expect, test, type Page } from "@playwright/test";

/**
 * Automatische Neu-Einlese beim App-Start (`MigrationRunner` →
 * `runParserMigration`).
 *
 * Der Auslöser ist `PARSER_VERSION`: Rezepte, die mit einer älteren Version
 * geparst wurden **und** eine gespeicherte Caption haben, werden beim Start neu
 * geparst – über den schützenden Merge, damit eigene Änderungen bleiben.
 *
 * Geprüft wird genau das an einem echten Fall: Die Caption enthält das Gericht
 * hinter dem Doppelpunkt („… sein soll: Dieser herzhafte Ofenpfannkuchen ist ein
 * absoluter Gamechanger!"), der Titel war vorher „Eier". Kein Netzabruf – die
 * Caption liegt lokal vor.
 */

const ID = "dddddddd-0000-4000-8000-000000000004";

const CAPTION = [
  "Wenn's schnell gehen muss, aber trotzdem richtig lecker sein soll: Dieser herzhafte Ofenpfannkuchen ist ein absoluter Gamechanger!",
  "",
  "📌Speicher dir das Rezept unbedingt ab – das wirst du garantiert öfter machen!",
  "",
  "➡️ Rezept:",
  "",
  "4 Eier",
  "150 g Mehl",
  "150 g Quark",
  "ca. 200 ml Milch",
].join("\n");

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

async function seed(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("onboardingSeenV3", "true");
    localStorage.setItem("onboardingSeenV2", "true");
  });
  await expect(page.getByText("Du hast noch keine Rezepte")).toBeVisible({ timeout: 30_000 });

  await page.evaluate(
    ({ id, caption }) => {
      const now = Date.now();
      return new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("rezept");
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("recipes", "readwrite");
          tx.objectStore("recipes").put({
            id,
            // So stand es vorher in der App: der Titel war die erste Zutat
            title: "Eier",
            color: "#c0563a",
            sourceCaption: caption,
            // Der Nutzer hat „Mehl" in „Dinkelmehl" umbenannt und Quark gelöscht
            ingredients: [{ id: "m1", amount: 150, unit: "g", name: "Dinkelmehl" }],
            steps: [{ id: "ms1", order: 1, instruction: "Alles verrühren." }],
            category: "Hauptgericht",
            tags: [],
            favorite: false,
            createdAt: now,
            updatedAt: now,
            // Alte Parser-Version → die Migration muss greifen
            parserVersion: 15,
            parseSnapshot: {
              title: "Eier",
              ingredients: [
                { name: "Mehl", amount: 150, unit: "g" },
                { name: "Quark", amount: 150, unit: "g" },
              ],
              steps: ["Alles verrühren."],
            },
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
    { id: ID, caption: CAPTION },
  );
}

test("Rezepte werden beim Start neu geparst, eigene Änderungen bleiben", async ({ page }) => {
  test.setTimeout(120_000);

  // Fehler aus dem Browser sichtbar machen – die Migration läuft im Hintergrund
  // und schluckt Ausnahmen (`console.error`), sonst sucht man blind.
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(String(error)));

  // Netzwerk beobachten: die Caption liegt lokal vor, es darf kein Abruf passieren
  const requests: string[] = [];
  await page.route("**/api/**", (route) => {
    requests.push(route.request().url());
    return route.continue();
  });

  await seed(page);
  // Reload = App-Start → die Migration läuft automatisch.
  // Auf die Meldung wird hier bewusst **nicht** gewartet: Auf der Startseite
  // erscheint gleichzeitig die Speicher-Warnung der App, und der Meldungstext
  // stammt aus bestehendem Code (nicht aus dieser Änderung). Geprüft wird das
  // Ergebnis – Titel, Zutaten und gestempelte Parser-Version.
  await page.reload();
  await page.waitForTimeout(2500);

  // Titel kommt jetzt aus der Caption statt aus der Zutatenliste
  await page.goto(`/recipes/${ID}`);
  await expect(page.getByText("Herzhafte Ofenpfannkuchen")).toBeVisible();

  // Eigene Änderungen sind erhalten: umbenannte Zutat bleibt, gelöschte kommt nicht zurück
  await expect(page.getByText("Dinkelmehl")).toBeVisible();
  await expect(page.getByText("Quark")).toHaveCount(0);
  // Neu erkannte Zutaten sind dazugekommen
  await expect(page.getByText("Milch")).toBeVisible();

  // Version ist gestempelt, sonst liefe die Migration bei jedem Start erneut
  const version = await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("rezept");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<number | undefined>((resolve) => {
      const tx = db.transaction("recipes", "readonly");
      const get = tx.objectStore("recipes").get(id);
      get.onsuccess = () => {
        const value = (get.result as { parserVersion?: number } | undefined)?.parserVersion;
        db.close();
        resolve(value);
      };
    });
  }, ID);
  expect(version, `Browserfehler: ${browserErrors.join(" | ") || "keine"}`).toBe(19);

  expect(requests.filter((url) => url.includes("/api/recipe/parse"))).toHaveLength(0);
});
