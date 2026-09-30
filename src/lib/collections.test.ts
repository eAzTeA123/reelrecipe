import { describe, expect, it } from "vitest";
import { isCollectionFilterEmpty, resolveCollectionRecipes } from "./collections";
import type { Recipe } from "@/domain/types";

function recipe(over: Partial<Recipe> & { id: string }): Recipe {
  return {
    title: over.id,
    ingredients: [],
    steps: [],
    favorite: false,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  } as Recipe;
}

const alle = [
  recipe({ id: "a", title: "Pasta", tags: ["one-pot"], category: "Hauptgericht" }),
  recipe({ id: "b", title: "Salat", tags: ["schnell"], category: "Beilage" }),
  recipe({ id: "c", title: "Pasta-Auflauf", category: "Hauptgericht" }),
];

describe("resolveCollectionRecipes", () => {
  it("liefert ohne Filter und ohne Mitglieder nichts", () => {
    expect(resolveCollectionRecipes({}, alle)).toEqual([]);
  });

  it("filtert dynamisch nach Tags (UND)", () => {
    const result = resolveCollectionRecipes({ filter: { tags: ["one-pot"] } }, alle);
    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("filtert dynamisch nach Kategorie", () => {
    const result = resolveCollectionRecipes({ filter: { category: "Hauptgericht" } }, alle);
    expect(result.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("filtert dynamisch nach Suchbegriff", () => {
    const result = resolveCollectionRecipes({ filter: { query: "pasta" } }, alle);
    expect(result.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("kombiniert Kategorie und Suchbegriff", () => {
    const result = resolveCollectionRecipes(
      { filter: { category: "Hauptgericht", query: "auflauf" } },
      alle,
    );
    expect(result.map((r) => r.id)).toEqual(["c"]);
  });

  it("nimmt manuelle Mitglieder dazu, ohne Duplikate", () => {
    const result = resolveCollectionRecipes(
      { filter: { tags: ["one-pot"] }, recipeIds: ["a", "b"] },
      alle,
    );
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("ignoriert Mitglieder, die es nicht mehr gibt", () => {
    const result = resolveCollectionRecipes({ recipeIds: ["geloescht", "b"] }, alle);
    expect(result.map((r) => r.id)).toEqual(["b"]);
  });
});

describe("matchesCollectionFilter – eigene Filter ohne Tags", () => {
  const kochbuch = [
    recipe({ id: "schnell", title: "Omelette", category: "Frühstück", prepTime: 5, cookTime: 10 }),
    recipe({ id: "mittel", title: "Ofengemüse", category: "Vegetarisch", prepTime: 15, cookTime: 30 }),
    recipe({ id: "lang", title: "Ragù", category: "Hauptgericht", prepTime: 20, cookTime: 120 }),
    recipe({ id: "ohne-zeit", title: "Brotzeit", category: "Beilage" }),
    recipe({
      id: "favorit",
      title: "Hähnchen-Curry",
      category: "Hauptgericht",
      prepTime: 10,
      cookTime: 20,
      favorite: true,
      ingredients: [{ id: "i1", name: "Hähnchenbrust", amount: 500, unit: "g" }],
    }),
  ];

  it("mehrere Kategorien sind ODER-verknüpft", () => {
    const result = resolveCollectionRecipes(
      { filter: { categories: ["Frühstück", "Vegetarisch"] } },
      kochbuch,
    );
    expect(result.map((r) => r.id)).toEqual(["schnell", "mittel"]);
  });

  it("liest die alte einzelne Kategorie weiter", () => {
    const result = resolveCollectionRecipes({ filter: { category: "Beilage" } }, kochbuch);
    expect(result.map((r) => r.id)).toEqual(["ohne-zeit"]);
  });

  it("filtert nach maximaler Gesamtzeit und wirft Rezepte ohne Zeitangabe raus", () => {
    expect(
      resolveCollectionRecipes({ filter: { maxTotalTime: 30 } }, kochbuch).map((r) => r.id),
    ).toEqual(["schnell", "favorit"]);
    expect(
      resolveCollectionRecipes({ filter: { maxTotalTime: 50 } }, kochbuch).map((r) => r.id),
    ).toEqual(["schnell", "mittel", "favorit"]);
  });

  it("filtert nach Favoriten", () => {
    const result = resolveCollectionRecipes({ filter: { favoritesOnly: true } }, kochbuch);
    expect(result.map((r) => r.id)).toEqual(["favorit"]);
  });

  it("sucht im Titel", () => {
    const result = resolveCollectionRecipes({ filter: { titleContains: "gemüse" } }, kochbuch);
    expect(result.map((r) => r.id)).toEqual(["mittel"]);
  });

  it("sucht in den Zutaten", () => {
    const result = resolveCollectionRecipes(
      { filter: { ingredientContains: "hähnchen" } },
      kochbuch,
    );
    expect(result.map((r) => r.id)).toEqual(["favorit"]);
  });

  it("kombiniert Regeln als UND", () => {
    const result = resolveCollectionRecipes(
      { filter: { categories: ["Hauptgericht"], maxTotalTime: 30 } },
      kochbuch,
    );
    expect(result.map((r) => r.id)).toEqual(["favorit"]);
  });

  it("leere Textfelder filtern nicht", () => {
    const result = resolveCollectionRecipes(
      { filter: { titleContains: "   ", ingredientContains: "" } },
      kochbuch,
    );
    expect(result).toEqual([]);
  });

  it("isCollectionFilterEmpty erkennt gesetzte Regeln", () => {
    expect(isCollectionFilterEmpty({})).toBe(true);
    expect(isCollectionFilterEmpty(undefined)).toBe(true);
    expect(isCollectionFilterEmpty({ titleContains: " " })).toBe(true);
    expect(isCollectionFilterEmpty({ favoritesOnly: true })).toBe(false);
    expect(isCollectionFilterEmpty({ maxTotalTime: 0 })).toBe(false);
    expect(isCollectionFilterEmpty({ categories: ["Beilage"] })).toBe(false);
  });
});
