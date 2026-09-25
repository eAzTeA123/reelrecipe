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
  await page.goto("/import");
  await page.getByRole("button", { name: "Ohne Link fortfahren" }).click();
  await page.getByLabel("Caption einfügen").fill(caption);
  await page.getByRole("button", { name: "Rezept erkennen" }).click();
  await expect(page.getByRole("heading", { name: "Rezept prüfen" })).toBeVisible();
  await page.getByRole("button", { name: "Rezept speichern" }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}/, { timeout: 15_000 });
}

export async function clearStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("rezept");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
        sessionStorage.clear();
      }),
  );
  await page.reload();
}
