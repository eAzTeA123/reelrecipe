import { describe, expect, it } from "vitest";
import { classifyCase, summarizeClasses } from "./classMetrics";
import type { ActualRecipe, CorpusFixture } from "./types";

function fixture(over: Partial<CorpusFixture> = {}): CorpusFixture {
  return {
    id: "test-1",
    source: "test",
    caption: "Zutaten:\n1 Ei",
    expected: {
      title: "Testrezept",
      servings: 2,
      ingredients: [
        { amount: 1, unit: "Stück", name: "Ei" },
        { amount: 200, unit: "g", name: "Mehl" },
      ],
      stepsCount: 3,
    },
    ...over,
  };
}

function actual(over: Partial<ActualRecipe> = {}): ActualRecipe {
  return {
    title: "Testrezept",
    servings: 2,
    ingredients: [{ amount: 1, unit: "Stück", name: "Ei" }],
    steps: ["Alles verrühren.", "Backen.", "Servieren."],
    ...over,
  };
}

describe("classMetrics", () => {
  it("erkennt eine Überschrift als Titel", () => {
    expect(classifyCase(fixture(), actual({ title: "Zutaten" })).headingAsTitle).toBe(true);
    expect(classifyCase(fixture(), actual({ title: "Für den Teig" })).headingAsTitle).toBe(true);
    expect(classifyCase(fixture(), actual()).headingAsTitle).toBe(false);
  });

  it("erkennt einen Marketingsatz als Titel", () => {
    const long = "Ich teste jetzt jede Woche solche High Protein Rezepte für dich";
    expect(classifyCase(fixture(), actual({ title: long })).headlineTitle).toBe(true);
    // Kurzer Titel mit Ansprache bleibt erlaubt
    expect(classifyCase(fixture(), actual({ title: "Duftende Zimtschnecken" })).headlineTitle).toBe(false);
  });

  it("zählt Werbezeilen in Zutaten und Schritten", () => {
    const parsed = actual({
      ingredients: [
        { amount: 1, unit: "Stück", name: "Ei" },
        { amount: 0, unit: "", name: "✨ Mit dem Code JJ könnt ihr sparen ✨" },
      ],
      steps: ["Alles verrühren.", "Folgt uns gerne für mehr!"],
    });
    expect(classifyCase(fixture(), parsed).promoLeaks).toBe(2);
  });

  it("erkennt Zutatenzeilen in den Schritten", () => {
    const parsed = actual({ steps: ["200 g Mehl", "Alles verrühren.", "1 EL Öl"] });
    expect(classifyCase(fixture(), parsed).ingredientLeaks).toBe(2);
  });

  it("erkennt fehlende und überzählige Schritte", () => {
    expect(classifyCase(fixture(), actual({ steps: [] })).zeroSteps).toBe(true);
    const many = Array.from({ length: 14 }, (_, i) => `Schritt ${i + 1}`);
    expect(classifyCase(fixture(), actual({ steps: many })).overSplit).toBe(true);
    expect(classifyCase(fixture(), actual()).overSplit).toBe(false);
  });

  it("summiert die Klassen", () => {
    const cases = [
      classifyCase(fixture(), actual({ title: "Zutaten" })),
      classifyCase(fixture(), actual({ steps: [] })),
    ];
    const summary = summarizeClasses(cases);
    expect(summary.cases).toBe(2);
    expect(summary.headingAsTitle).toBe(1);
    expect(summary.zeroStepCases).toBe(1);
    expect(summary.promoLeaks).toBe(0);
  });
});
