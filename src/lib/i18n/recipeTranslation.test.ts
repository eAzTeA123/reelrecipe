import { describe, expect, it } from "vitest";
import type { ParsedRecipe } from "@/domain/types";
import { translateParsedRecipe } from "./recipeTranslation";

/**
 * Regression zum gemeldeten Fall: Wortweise Übersetzung erzeugte Mischformen wie
 * „Large Eier" (Large unbekannt, Eggs bekannt). Ein Name wird jetzt **ganz oder
 * gar nicht** übersetzt.
 */
function englishRecipe(names: string[]): ParsedRecipe {
  return {
    title: "Protein Cheesecake",
    ingredients: names.map((name, index) => ({
      id: `i${index}`,
      amount: 100,
      unit: "g",
      name,
    })),
    steps: [{ id: "s1", order: 1, instruction: "Mix everything and bake it." }],
  } as ParsedRecipe;
}

describe("translateParsedRecipe – keine gemischten Sprachen in einem Namen", () => {
  it("lässt einen Namen unverändert, wenn ein Wort unbekannt ist", () => {
    const translated = translateParsedRecipe(englishRecipe(["Large Eggs"]), "de");
    expect(translated.ingredients[0].name).toBe("Large Eggs");
  });

  it("übersetzt vollständig bekannte Namen", () => {
    const translated = translateParsedRecipe(englishRecipe(["Eggs", "cream cheese"]), "de");
    expect(translated.ingredients[0].name).toBe("Eier");
    // Phrasen-Eintrag im Wörterbuch schlägt die Wort-für-Wort-Übersetzung
    expect(translated.ingredients[1].name).toBe("Frischkäse");
  });

  it("mischt nicht bei mehrwortigen Namen mit unbekanntem Teil", () => {
    const translated = translateParsedRecipe(englishRecipe(["Vanilla Extract", "Greek Yogurt"]), "de");
    expect(translated.ingredients[0].name).toBe("Vanilla Extract");
    expect(translated.ingredients[1].name).toBe("Greek Yogurt");
  });

  it("lässt deutsche Namen in Ruhe, wenn ein Wort unbekannt ist", () => {
    const recipe = englishRecipe(["große Eier"]);
    const translated = translateParsedRecipe(recipe, "de");
    expect(translated.ingredients[0].name).toBe("große Eier");
  });
});
