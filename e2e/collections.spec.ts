import { expect, test } from "@playwright/test";
import { createRecipeViaUI, DE_CAPTION } from "./helpers";

/**
 * Sammlungen: eigene Filter statt Tags, plus Rezepte von Hand.
 *
 * Der Test hängt bewusst nicht an geparsten Kategorien oder Zeiten – er prüft,
 * dass Filtern und manuelle Mitgliedschaft zusammen die Vereinigung ergeben und
 * dass beides einen Reload übersteht.
 */
test("Sammlung anlegen, Rezept hinzufügen, Filter setzen, entfernen", async ({ page }) => {
  await createRecipeViaUI(page, DE_CAPTION);

  await page.goto("/collections");
  await page.getByLabel("Neue Sammlung").fill("Test-Sammlung");
  await page.getByRole("button", { name: "Sammlung anlegen" }).click();

  // Frisch angelegte Sammlung ist ausgewählt und leer.
  await expect(page.getByText("Diese Sammlung ist noch leer")).toBeVisible();

  // Rezept von Hand aufnehmen …
  await page.getByRole("button", { name: "Rezepte hinzufügen" }).click();
  const picker = page.getByRole("dialog", { name: "Rezepte hinzufügen" });
  await picker.getByLabel("Rezept suchen").fill("Creamy");
  await picker.getByRole("button", { name: /Creamy Garlic Chicken/ }).click();
  await picker.getByRole("button", { name: "Fertig" }).click();

  await expect(page.getByRole("link", { name: "Creamy Garlic Chicken" })).toBeVisible();
  await expect(page.getByText("1 Rezept", { exact: true })).toBeVisible();

  // … und bleibt nach einem Reload erhalten.
  await page.reload();
  await expect(page.getByRole("link", { name: "Creamy Garlic Chicken" })).toBeVisible();

  // Filter setzen: „Nur Favoriten“ trifft nichts, das Rezept bleibt über die
  // manuelle Mitgliedschaft sichtbar (Vereinigung).
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page.getByRole("button", { name: "Nur Favoriten" }).click();
  await page.getByRole("button", { name: "Fertig" }).click();

  await expect(page.getByText("Nur Favoriten")).toBeVisible();
  await expect(page.getByRole("link", { name: "Creamy Garlic Chicken" })).toBeVisible();

  // Von Hand wieder herausnehmen: jetzt greift nur noch der Filter (leer).
  await page.getByRole("button", { name: /aus der Sammlung entfernen/ }).click();
  await expect(page.getByText("Diese Sammlung ist noch leer")).toBeVisible();

  // Filter zurücksetzen bringt das Rezept nicht zurück – es war nur manuell drin.
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page.getByRole("button", { name: "Filter zurücksetzen" }).click();
  await page.getByRole("button", { name: "Fertig" }).click();
  await expect(page.getByText("Kein Filter gesetzt")).toBeVisible();
});
