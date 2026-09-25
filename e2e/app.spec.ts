import { expect, test, type Page } from "@playwright/test";
import { createRecipeViaUI, DE_CAPTION, EN_CAPTION } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Frische IndexedDB pro Test
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("rezept");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
        sessionStorage.clear();
      }),
  );
  await page.reload();
});

test("leere App: Startseite mit Empty State", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Meine Rezepte" })).toBeVisible();
  await expect(page.getByText("Du hast noch keine Rezepte")).toBeVisible();
  await expect(page.getByRole("link", { name: "Rezept importieren" })).toBeVisible();
});

test("ungültiger Instagram-Link zeigt Fehler", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel(/Instagram/).fill("https://example.com/foo");
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(page.getByText("Bitte gib einen gültigen Instagram- oder TikTok-Link ein.")).toBeVisible();
});

test("deutsches Rezept: Caption → Review → Speichern → Detail", async ({ page }) => {
  await page.goto("/import");
  await page.getByRole("button", { name: "Ohne Link fortfahren" }).click();
  await page.getByLabel("Caption einfügen").fill(DE_CAPTION);
  await page.getByRole("button", { name: "Rezept erkennen" }).click();

  // Review: geparste Werte prüfen
  await expect(page.getByLabel("Titel")).toHaveValue("Creamy Garlic Chicken");
  await expect(page.getByLabel("Portionen")).toHaveValue("2");
  const zutatInputs = page.locator("input[placeholder='Zutat']");
  await expect(zutatInputs).toHaveCount(4);
  await expect(page.locator("input[placeholder='Menge']").first()).toHaveValue("500");
  await expect(page.locator("input[placeholder='Einheit']").first()).toHaveValue("g");

  // Zutat bearbeiten: Menge ändern
  await page.locator("input[placeholder='Menge']").first().fill("600");
  // Zutat löschen (letzte)
  await page.getByRole("button", { name: "Zutat 4 löschen" }).click();
  await expect(zutatInputs).toHaveCount(3);
  // Zutat hinzufügen
  await page.getByRole("button", { name: "Zutat hinzufügen" }).click();
  await page.locator("input[placeholder='Zutat']").last().fill("Butter");
  await page.locator("input[placeholder='Menge']").last().fill("20");

  // Schritt bearbeiten
  await page.locator("textarea[placeholder='Schritt beschreiben']").first().fill("Hähnchen würfeln.");

  await page.getByRole("button", { name: "Rezept speichern" }).click();
  await expect(page.getByText("Rezept gespeichert")).toBeVisible();
  await expect(page).toHaveURL(/\/recipes\//, { timeout: 15_000 });

  // Detailseite
  await expect(page.getByRole("heading", { name: "Creamy Garlic Chicken" })).toBeVisible();
  await expect(page.getByText("600")).toBeVisible();
  await expect(page.getByText("Butter")).toBeVisible();
  await expect(page.getByText("Hähnchen würfeln.")).toBeVisible();
});

test("englisches Rezept mit Brüchen", async ({ page }) => {
  await page.goto("/import");
  await page.getByRole("button", { name: "Ohne Link fortfahren" }).click();
  await page.getByLabel("Caption einfügen").fill(EN_CAPTION);
  await page.getByRole("button", { name: "Rezept erkennen" }).click();
  await expect(page.getByLabel("Titel")).toHaveValue("Easy Pasta Bake");
  const mengen = page.locator("input[placeholder='Menge']");
  await expect(mengen.nth(0)).toHaveValue("400");
  await expect(mengen.nth(1)).toHaveValue("2");
  await expect(mengen.nth(2)).toHaveValue("0,5");
  await page.getByRole("button", { name: "Rezept speichern" }).click();
  await expect(page).toHaveURL(/\/recipes\//, { timeout: 15_000 });
});

test("Detail: Favorit, Portionen skalieren, Einkaufsliste", async ({ page }) => {
  await createRecipeViaUI(page, DE_CAPTION);

  // Favorit setzen
  await page.getByRole("button", { name: "Zu Favoriten hinzufügen" }).click();
  await expect(page.getByRole("button", { name: "Aus Favoriten entfernen" })).toBeVisible();

  // Portionen 2 → 4: 500 g → 1 kg, 2 Stück → 4
  await page.getByRole("button", { name: "Portionen erhöhen" }).click();
  await page.getByRole("button", { name: "Portionen erhöhen" }).click();
  await expect(page.getByText("1 kg")).toBeVisible();
  await expect(page.getByText("4 Stück")).toBeVisible();

  // Zur Einkaufsliste
  await page.getByRole("button", { name: "Zur Einkaufsliste" }).click();
  await expect(page.getByText("Zur Einkaufsliste hinzugefügt")).toBeVisible();

  // Einkaufsliste prüfen
  await page.getByRole("link", { name: "Einkaufsliste" }).first().click();
  await expect(page.getByRole("heading", { name: "Einkaufsliste" })).toBeVisible();
  await expect(page.getByText("Hähnchenbrust")).toBeVisible();
  await expect(page.getByText("1 kg")).toBeVisible();

  // Abhaken (über das Label, die Checkbox ist visuell versteckt)
  await page.locator("label", { hasText: "Hähnchenbrust" }).click();
  await expect(page.getByText("Erledigte entfernen")).toBeVisible();
});

test("Einkaufsliste: Merge gleicher Zutaten aus zwei Rezepten", async ({ page }) => {
  await createRecipeViaUI(page, DE_CAPTION);
  await page.getByRole("button", { name: "Zur Einkaufsliste" }).click();
  await expect(page.getByText("Zur Einkaufsliste hinzugefügt")).toBeVisible();
  await page.goto("/import");
  await page.getByRole("button", { name: "Ohne Link fortfahren" }).click();
  await page.getByLabel("Caption einfügen").fill(
    `Zweites Gericht\n\nZutaten:\n250 g Hähnchenbrust\n100 ml Sahne\n\nZubereitung:\n1. Kochen.`,
  );
  await page.getByRole("button", { name: "Rezept erkennen" }).click();
  await page.getByRole("button", { name: "Rezept speichern" }).click();
  await expect(page).toHaveURL(/\/recipes\//, { timeout: 15_000 });
  await page.getByRole("button", { name: "Zur Einkaufsliste" }).click();
  await expect(page.getByText("Zur Einkaufsliste hinzugefügt")).toBeVisible();

  await page.goto("/shopping");
  // 500g + 250g Hähnchenbrust → 750 g zusammengeführt
  await expect(page.getByText("750 g")).toBeVisible();
  // 200ml + 100ml Sahne → 300 ml
  await expect(page.getByText("300 ml")).toBeVisible();
  const items = page.locator("ul li");
  await expect(items).toHaveCount(4); // Hähnchen, Eier, Sahne, Parmesan
});

test("Übersicht: Suche, Kategorien, Favoriten", async ({ page }) => {
  await createRecipeViaUI(page, DE_CAPTION);
  await page.goto("/recipes");
  await expect(page.getByText("Creamy Garlic Chicken")).toBeVisible();

  // Suche nach Zutat
  await page.getByRole("searchbox").fill("Parmesan");
  await expect(page.getByText("Creamy Garlic Chicken")).toBeVisible();
  await page.getByRole("searchbox").fill("Brokkoli");
  await expect(page.getByText("Keine Rezepte gefunden")).toBeVisible();
  await page.getByRole("searchbox").fill("");

  // Favorit über Detail
  await page.getByText("Creamy Garlic Chicken").click();
  await page.getByRole("button", { name: "Zu Favoriten hinzufügen" }).click();
  await page.goto("/favorites");
  await expect(page.getByText("Creamy Garlic Chicken")).toBeVisible();
});

test("Rezept bearbeiten und löschen", async ({ page }) => {
  await createRecipeViaUI(page, DE_CAPTION);
  await page.getByRole("link", { name: "Rezept bearbeiten" }).click();
  await page.getByLabel("Titel").fill("Knoblauch-Hähnchen Deluxe");
  await page.getByRole("button", { name: "Änderungen speichern" }).click();
  await expect(page).toHaveURL(/\/recipes\//, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Knoblauch-Hähnchen Deluxe" })).toBeVisible();

  // Löschen
  await page.getByRole("button", { name: "Rezept löschen" }).click();
  await page.getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByText("Du hast noch keine Rezepte")).toBeVisible();
});

test("Persistenz: Daten überleben Reload", async ({ page }) => {
  await createRecipeViaUI(page, DE_CAPTION);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Creamy Garlic Chicken" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Creamy Garlic Chicken")).toBeVisible();
});

test("manuell anlegen und Kochmodus", async ({ page }) => {
  await page.goto("/recipes/new");
  await page.getByLabel("Titel").fill("Manuelles Testgericht");
  await page.locator("input[placeholder='Menge']").first().fill("2");
  await page.locator("input[placeholder='Zutat']").first().fill("Eier");
  await page.locator("textarea[placeholder='Schritt beschreiben']").first().fill("Eier verquirlen.");
  await page.getByRole("button", { name: "Schritt hinzufügen" }).click();
  await page.locator("textarea[placeholder='Schritt beschreiben']").last().fill("Anbraten.");
  await page.getByRole("button", { name: "Rezept speichern" }).click();
  await expect(page).toHaveURL(/\/recipes\//, { timeout: 15_000 });

  await page.getByRole("link", { name: "Kochmodus" }).click();
  await expect(page.getByText("Schritt 1 von 2")).toBeVisible();
  await expect(page.getByText("Eier verquirlen.")).toBeVisible();
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText("Schritt 2 von 2")).toBeVisible();
  await expect(page.getByText("Anbraten.")).toBeVisible();
});

test("Einkaufsliste: manuell hinzufügen und bearbeiten", async ({ page }) => {
  await page.goto("/shopping");
  await page.getByLabel("Zutat zur Einkaufsliste hinzufügen").fill("Basilikum");
  await page.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(page.getByText("Basilikum")).toBeVisible();
  await page.getByRole("button", { name: "Basilikum bearbeiten" }).click();
  await page.getByLabel("Menge").fill("1");
  await page.getByLabel("Einheit").fill("Bund");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("1 Bund")).toBeVisible();
});

async function exportBackup(page: Page): Promise<string> {
  await page.goto("/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Rezepte exportieren" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const fs = await import("fs");
  return fs.readFileSync(path!, "utf-8");
}

test("Export und Import des Backups", async ({ page }) => {
  await createRecipeViaUI(page, DE_CAPTION);
  const json = await exportBackup(page);
  const backup = JSON.parse(json);
  expect(backup.app).toBe("rezept");
  expect(backup.recipes).toHaveLength(1);
  expect(backup.recipes[0].title).toBe("Creamy Garlic Chicken");

  // DB leeren, dann importieren
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("rezept");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
  await page.goto("/recipes");
  await expect(page.getByText("Du hast noch keine Rezepte")).toBeVisible();

  await page.goto("/settings");
  const fs = await import("fs");
  const tmp = `${process.cwd()}/test-results/tmp-backup.json`;
  fs.mkdirSync(`${process.cwd()}/test-results`, { recursive: true });
  fs.writeFileSync(tmp, json);
  await page.locator("input[type=file]").setInputFiles(tmp);
  await expect(page.getByText("Backup importieren", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Vorhandene überspringen" }).click();
  await expect(page.getByText(/Backup importiert:/)).toBeVisible();

  await page.goto("/recipes");
  await expect(page.getByText("Creamy Garlic Chicken")).toBeVisible();
});

test("ungültige Backup-Datei wird abgelehnt", async ({ page }) => {
  await page.goto("/settings");
  const fs = await import("fs");
  const tmp = `${process.cwd()}/test-results/bad.json`;
  fs.mkdirSync(`${process.cwd()}/test-results`, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify({ hello: "world" }));
  await page.locator("input[type=file]").setInputFiles(tmp);
  await expect(page.getByText("Das ist keine gültige Rezept-Backup-Datei.")).toBeVisible();
});
