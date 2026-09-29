import { describe, expect, it } from "vitest";
import { extractRecipeLinkFromText, parseRecipeLink } from "./socialSource";
import { statusFromFetchError, toWebRecipeResponse } from "@/parser/universal/toWebRecipe";
import { parse_recipe } from "@/parser/universal";
import fs from "node:fs";
import path from "node:path";

describe("Rezept-Links erkennen", () => {
  it("behandelt Instagram und TikTok weiter als Social-Link", () => {
    expect(parseRecipeLink("https://www.instagram.com/reel/DdGA-TCuHAZ/")?.kind).toBe("social");
    expect(parseRecipeLink("https://vm.tiktok.com/ZMabc123/")?.kind).toBe("social");
  });

  it("akzeptiert beliebige Rezeptseiten", () => {
    const link = parseRecipeLink("https://www.chefkoch.de/rezepte/1234/Spaghetti-Carbonara.html#comments");
    expect(link).toEqual({
      kind: "web",
      normalized: "https://www.chefkoch.de/rezepte/1234/Spaghetti-Carbonara.html",
      host: "chefkoch.de",
    });
    expect(parseRecipeLink("chefkoch.de/rezepte/1")?.kind).toBe("web");
  });

  it("lehnt Unsinn und interne Ziele ab", () => {
    expect(parseRecipeLink("Hallo Welt")).toBeNull();
    expect(parseRecipeLink("http://localhost:3000/x")).toBeNull();
    expect(parseRecipeLink("http://192.168.0.10/rezept")).toBeNull();
    expect(parseRecipeLink("ftp://example.com/x")).toBeNull();
    expect(parseRecipeLink("https://www.instagram.com/someprofile/")).toBeNull();
  });

  it("findet Links in geteiltem Text; Social-Links haben Vorrang", () => {
    expect(extractRecipeLinkFromText("Schau mal: https://www.lecker.de/kuerbissuppe-123.html lecker!")?.normalized).toBe(
      "https://www.lecker.de/kuerbissuppe-123.html",
    );
    expect(
      extractRecipeLinkFromText("https://example.com/blog https://www.instagram.com/reel/DdGA-TCuHAZ/")?.kind,
    ).toBe("social");
    expect(extractRecipeLinkFromText("nur Text ohne Link")).toBeNull();
  });
});

describe("Webimport-Antwort", () => {
  it("übersetzt HTTP-Fehler in verständliche Status", () => {
    expect(statusFromFetchError("HTTP-Fehler 403 (Forbidden) beim Abrufen von x")).toBe("blocked");
    expect(statusFromFetchError("HTTP-Fehler 404 (Not Found) beim Abrufen von x")).toBe("not_a_recipe");
    expect(statusFromFetchError("Timeout beim Abrufen der URL")).toBe("fetch_error");
  });

  it("bildet ein JSON-LD-Rezept (Fixture) auf das Import-Format ab", async () => {
    const html = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/recipes/lecker/recipe.html"), "utf-8");
    const res = toWebRecipeResponse(await parse_recipe(html), "https://www.lecker.de/kuerbissuppe");
    expect(res.status).toBe("success");
    expect(res.recipe?.title).toBe("Cremige Kürbissuppe mit Kokosmilch");
    // Das Fixture listet "Salz und Pfeffer" als einen Eintrag; der Parser trennt
    // Aufzählungen bewusst in zwei Zutaten (besser für die Einkaufsliste).
    expect(res.recipe?.ingredients.length).toBe(9);
    expect(res.recipe?.ingredients.map((i) => i.name)).toEqual(
      expect.arrayContaining(["Salz", "Pfeffer"]),
    );
    expect(res.recipe?.steps.length).toBe(6);
    expect(res.recipe?.servings).toBe(4);
    expect(res.recipe?.prepTime).toBe(20);
    expect(res.recipe?.cookTime).toBe(25);
    expect(res.recipe?.image).toBe("https://images.lecker.de/kuerbissuppe.jpg");
    expect(res.recipe?.highConfidence).toBe(true);
    expect(res.recipe?.fieldSources.zutaten.source).toBe("schema");
  });

  it("Regression (live Chefkoch): löst Bild-@id im @graph auf und entfernt den Autor aus dem Titel", async () => {
    const html = `<!DOCTYPE html><html><head>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
        {"@type":"Recipe","name":"Toast Hawaii von acigrand","image":{"@id":"https://www.chefkoch.de/r/1#primaryimage"},
         "recipeIngredient":["8 Scheiben Toastbrot","4 TL Margarine","8 Scheiben Ananas"],
         "recipeInstructions":[{"@type":"HowToStep","text":"Toast mit Margarine bestreichen."},{"@type":"HowToStep","text":"Belegen und überbacken."}]},
        {"@type":"ImageObject","@id":"https://www.chefkoch.de/r/1#primaryimage","url":"https://img.chefkoch-cdn.de/toast.jpg"}
      ]}</script></head><body><h1>Toast Hawaii</h1><p>Beschreibung</p></body></html>`;
    const res = toWebRecipeResponse(await parse_recipe(html, "https://www.chefkoch.de/rezepte/1/Toast-Hawaii.html"), "x");
    expect(res.recipe?.title).toBe("Toast Hawaii");
    expect(res.recipe?.image).toBe("https://img.chefkoch-cdn.de/toast.jpg");
  });

  it("nutzt og:image als letzte Bildquelle", async () => {
    const html = `<!DOCTYPE html><html><head><meta property="og:image" content="/img/suppe.jpg">
      <script type="application/ld+json">{"@type":"Recipe","name":"Suppe","recipeIngredient":["1 l Brühe","2 Karotten"],
      "recipeInstructions":["Alles kochen.","Pürieren."]}</script></head><body><h1>Suppe</h1></body></html>`;
    const res = toWebRecipeResponse(await parse_recipe(html, "https://blog.example.org/suppe"), "x");
    expect(res.recipe?.image).toBe("https://blog.example.org/img/suppe.jpg");
    expect(res.recipe?.fieldSources.bild.source).toBe("heuristik");
  });

  it("Regression (live Chefkoch): Pluralschreibweise und SEO-Beschreibung", async () => {
    const { parseIngredientLine } = await import("@/parser");
    expect(parseIngredientLine("8 Scheibe/n Toastbrot")).toMatchObject({ amount: 8, name: "Toastbrot" });
    expect(parseIngredientLine("2 Zehe/n Knoblauch")?.name).toBe("Knoblauch");
    const { isSeoBoilerplate } = await import("@/parser/universal/toWebRecipe");
    expect(isSeoBoilerplate("Toast Hawaii. Über 56 Bewertungen und für lecker befunden. Mit ► Portionsrechner")).toBe(true);
    expect(isSeoBoilerplate("Ein cremiger Klassiker aus Rom, ganz ohne Sahne.")).toBe(false);
  });

  it("Regression (live Allrecipes): HTTP 402 gilt als blockiert", () => {
    expect(statusFromFetchError("HTTP-Fehler 402 (Payment Required) beim Abrufen von x")).toBe("blocked");
  });

  it("gibt Login-/Blockseiten als Status weiter", async () => {
    const html = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/recipes/cookidoo/recipe.html"), "utf-8");
    expect(toWebRecipeResponse(await parse_recipe(html), "https://cookidoo.de/x").status).toBe("login_required");
  });
});
