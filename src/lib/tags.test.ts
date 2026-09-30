import { describe, expect, it } from "vitest";
import { collectTags, matchesTags } from "./tags";

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
