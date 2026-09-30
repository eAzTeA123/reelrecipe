import { describe, expect, it } from "vitest";
import {
  MAX_TAGS_PER_RECIPE,
  collectTags,
  matchesTags,
  parseTagInput,
  removeTag,
} from "./tags";

describe("parseTagInput", () => {
  it("trennt an Komma und Semikolon und trimmt", () => {
    expect(parseTagInput("one-pot, high-protein; schnell")).toEqual([
      "one-pot",
      "high-protein",
      "schnell",
    ]);
  });

  it("wirft Duplikate case-insensitiv weg", () => {
    expect(parseTagInput("Pasta, pasta, PASTA")).toEqual(["Pasta"]);
  });

  it("wirft zu kurze Einträge weg und kürzt lange", () => {
    expect(parseTagInput("a, b, vegetarisch-mit-sehr-langem-namen")).toEqual([
      "vegetarisch-mit-sehr-lan",
    ]);
  });

  it("behält vorhandene Tags und hängt neue an", () => {
    expect(parseTagInput("neu", ["alt"])).toEqual(["alt", "neu"]);
  });

  it("begrenzt die Anzahl je Rezept", () => {
    const many = Array.from({ length: 20 }, (_, i) => `tag${i}`).join(", ");
    expect(parseTagInput(many)).toHaveLength(MAX_TAGS_PER_RECIPE);
  });
});

describe("removeTag", () => {
  it("entfernt case-insensitiv", () => {
    expect(removeTag(["Pasta", "schnell"], "pasta")).toEqual(["schnell"]);
  });
});

describe("collectTags", () => {
  it("sortiert nach Häufigkeit, dann alphabetisch", () => {
    const recipes = [
      { tags: ["schnell", "pasta"] },
      { tags: ["pasta"] },
      { tags: ["Abendessen", "schnell"] },
      { tags: ["pasta"] },
    ];
    expect(collectTags(recipes)).toEqual(["pasta", "schnell", "Abendessen"]);
  });

  it("kommt ohne Tags aus", () => {
    expect(collectTags([{}, { tags: [] }])).toEqual([]);
  });
});

describe("matchesTags", () => {
  it("passt ohne Auswahl immer", () => {
    expect(matchesTags({ tags: [] }, [])).toBe(true);
  });

  it("verlangt alle gewählten Tags (UND), case-insensitiv", () => {
    const recipe = { tags: ["High-Protein", "one-pot"] };
    expect(matchesTags(recipe, ["high-protein"])).toBe(true);
    expect(matchesTags(recipe, ["high-protein", "one-pot"])).toBe(true);
    expect(matchesTags(recipe, ["high-protein", "vegan"])).toBe(false);
  });

  it("behandelt Rezepte ohne Tags korrekt", () => {
    expect(matchesTags({}, ["pasta"])).toBe(false);
  });
});
