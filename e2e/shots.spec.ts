import { test, expect } from "@playwright/test";
import { createRecipeViaUI, DE_CAPTION } from "./helpers";
import fs from "fs";

test("Screenshots: Review + Edit + Shopping gefüllt", async ({ page }) => {
  fs.mkdirSync("e2e/screenshots", { recursive: true });
  for (const w of [390, 768]) {
    await page.setViewportSize({ width: w, height: 844 });
    await page.goto("/import");
    await page.getByRole("button", { name: "Ohne Link fortfahren" }).click();
    await page.getByLabel("Caption einfügen").fill(DE_CAPTION);
    await page.getByRole("button", { name: "Rezept erkennen" }).click();
    await expect(page.getByRole("heading", { name: "Rezept prüfen" })).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/${w}-review.png`, fullPage: true });
    await page.getByRole("button", { name: "Rezept speichern" }).click();
    await expect(page).toHaveURL(/\/recipes\//, { timeout: 15_000 });

    // Einkaufsliste gefüllt
    await page.getByRole("button", { name: "Zur Einkaufsliste" }).click();
    await page.goto("/shopping");
    await page.screenshot({ path: `e2e/screenshots/${w}-shopping-full.png` });

    // Edit-Seite
    await page.goto((await page.url()).replace("/shopping", "/recipes"));
    await page.getByText("Creamy Garlic Chicken").first().click();
    await page.getByRole("link", { name: "Rezept bearbeiten" }).click();
    await page.screenshot({ path: `e2e/screenshots/${w}-edit.png`, fullPage: true });
  }
});
