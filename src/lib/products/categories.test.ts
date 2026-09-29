import { describe, expect, it } from "vitest";
import { loadCorpus } from "@/parser/corpus/loader";
import { parseRecipe } from "@/parser";
import { categoryTagFor, isPantryIngredient } from "./matching";
import { resolveCategory } from "./categories";
import { REFERENCE_PRICES } from "./referencePrices";
import { estimateShopping } from "./estimate";

describe("Kategorie-Auflösung", () => {
  it("bevorzugt den spezifischeren Wortstamm", () => {
    expect(categoryTagFor("Hähnchenbrustfilet")).toBe("en:chicken-breasts");
    expect(categoryTagFor("Hähnchen")).toBe("en:chickens");
    expect(categoryTagFor("Kokosmilch")).toBe("en:coconut-milks");
    expect(categoryTagFor("Milch 1,5 % Fett")).toBe("en:milks");
    expect(categoryTagFor("Salatgurke")).toBe("en:cucumbers");
  });

  it("erkennt verarbeitete Formen und ordnet sie richtig ein", () => {
    // Brühe ist kein Fleisch – sonst würde sie mit 11,90 €/kg berechnet
    expect(categoryTagFor("Hähnchenbrühe")).toBe("en:broths");
    expect(categoryTagFor("Hühnerfond")).toBe("en:broths");
    expect(categoryTagFor("Rinderbrühe")).toBe("en:broths");
    expect(resolveCategory("Hähnchenbrühe")?.group).toBe("bruehe");
    expect(categoryTagFor("Tomatenmark")).toBe("en:tomato-pastes");
    expect(categoryTagFor("Paprikapulver")).toBe("en:paprika-powder");
  });

  it("behandelt kurze Stämme nur als ganzes Wort", () => {
    expect(categoryTagFor("Ei")).toBe("en:eggs");
    expect(categoryTagFor("Eier")).toBe("en:eggs");
    // "ei" darf nicht in "Eiscreme" oder "Reis" treffen
    expect(categoryTagFor("Eiscreme")).not.toBe("en:eggs");
    expect(categoryTagFor("Jasminreis")).not.toBe("en:eggs");
  });

  it("erkennt Vorratszutaten auch mit Zusatzwörtern", () => {
    expect(isPantryIngredient("Salz")).toBe(true);
    expect(isPantryIngredient("kochendes Wasser")).toBe(true);
    expect(isPantryIngredient("etwas Salz")).toBe(true);
    expect(isPantryIngredient("Salzstangen")).toBe(false);
    expect(isPantryIngredient("Zucker")).toBe(false);
  });

  it("kennt für jede Warengruppe einen Richtwert", () => {
    for (const [group, reference] of Object.entries(REFERENCE_PRICES)) {
      expect(reference.price, group).toBeGreaterThan(0);
      expect(reference.label.length, group).toBeGreaterThanOrEqual(2);
      expect(reference.note.length, group).toBeGreaterThan(4);
    }
  });
});

describe("Abdeckung auf echten Rezepten (Corpus)", () => {
  const structureLine = /^(?:für |fur |gewürze|gewuerze|außerdem|ausserdem|topping|sauce|crunch|suppe|burger|salat)/i;

  const ingredients = loadCorpus()
    .flatMap((fixture) => {
      const parsed = parseRecipe(fixture.caption);
      return parsed ? parsed.ingredients.map((ing) => ing.name) : [];
    })
    .filter((name) => !structureLine.test(name.trim()))
    .filter((name, index, all) => all.indexOf(name) === index);

  it("ordnet mindestens 95 % der Zutaten einer Kategorie oder dem Vorrat zu", () => {
    const covered = ingredients.filter((name) => isPantryIngredient(name) || categoryTagFor(name));
    const rate = covered.length / ingredients.length;
    expect(ingredients.length).toBeGreaterThan(80);
    expect(rate, `nur ${covered.length} von ${ingredients.length} Zutaten abgedeckt`).toBeGreaterThanOrEqual(0.95);
  });

  it("lässt keine Zutat ohne Eintrag: Richtwert fängt den Rest auf", async () => {
    const list = ingredients.slice(0, 12).map((name, i) => ({ id: `i${i}`, name, amount: 200, unit: "g" }));
    const estimate = await estimateShopping(list, "all", {
      searchProducts: async () => [],
      fetchPrices: async () => new Map(),
      fetchCategoryPrices: async () => new Map(),
    });

    expect(estimate.items).toHaveLength(list.length);
    for (const item of estimate.items) {
      expect(["priced", "estimated", "pantry"], item.ingredientName).toContain(item.status);
      if (item.status !== "pantry") {
        // Entweder Marktpreis oder klar gekennzeichneter Richtwert – nie leer
        expect(
          item.price !== undefined || item.estimate !== undefined,
          `${item.ingredientName} ohne Preis und ohne Richtwert`,
        ).toBe(true);
      }
      if (item.status === "estimated") {
        expect(item.price).toBeUndefined();
        expect(item.estimate?.source).toContain("Schätzung");
      }
    }
  });
});
