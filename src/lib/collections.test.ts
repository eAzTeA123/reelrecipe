import { describe, expect, it } from "vitest";
import { resolveCollectionRecipes } from "./collections";
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
