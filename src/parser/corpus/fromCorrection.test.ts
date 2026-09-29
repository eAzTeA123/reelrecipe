import { describe, expect, it } from "vitest";
import type { ParsedRecipe } from "@/domain/types";
import {
  correctionToFixture,
  correctionsToFixtureJson,
  hasMeaningfulCorrection,
  isRecordableCorrection,
  type CorrectionRecord,
} from "./fromCorrection";

function recipe(overrides: Partial<ParsedRecipe> = {}): ParsedRecipe {
  return {
    title: "One Pot",
    servings: 4,
    ingredients: [
      { id: "a", amount: 200, unit: "g", name: "Jasminreis" },
      { id: "b", amount: 1, unit: "EL", name: "Pesto Rosso" },
    ],
    steps: [
      { id: "s1", order: 1, instruction: "Alles in eine Form geben." },
      { id: "s2", order: 2, instruction: "45 Minuten backen." },
    ],
    ...overrides,
  };
}

const caption = "🍅 One Pot\n\n* 200 g Jasminreis\n* 1 EL Pesto Rosso\n\nAlles in eine Form geben.\n45 Minuten backen.";

describe("Korrektur-Log", () => {
  it("erkennt nur echte Abweichungen als sinnvolle Korrektur", () => {
    const parsed = recipe();
    expect(hasMeaningfulCorrection(parsed, recipe())).toBe(false);
    expect(hasMeaningfulCorrection(parsed, recipe({ title: "Anderer Titel" }))).toBe(true);
    expect(hasMeaningfulCorrection(parsed, recipe({ servings: 2 }))).toBe(true);
    expect(
      hasMeaningfulCorrection(
        parsed,
        recipe({ ingredients: [{ id: "a", amount: 200, unit: "g", name: "Reis" }] }),
      ),
    ).toBe(true);
    expect(
      hasMeaningfulCorrection(
        parsed,
        recipe({
          ingredients: [
            { id: "a", amount: 200, unit: "g", name: "Jasminreis" },
            { id: "b", amount: 1, unit: "EL", name: "Pesto Rosso" },
          ],
          steps: [{ id: "s1", order: 1, instruction: "Alles in eine Form geben." }],
        }),
      ),
    ).toBe(true);
  });

  it("ignoriert Korrekturen, die als Testfall wertlos sind", () => {
    const parsed = recipe();
    expect(isRecordableCorrection(parsed, recipe(), caption)).toBe(false); // keine Änderung
    expect(isRecordableCorrection(parsed, recipe({ title: "Neu" }), "zu kurz")).toBe(false);
    expect(
      isRecordableCorrection(parsed, recipe({ title: "Neu", ingredients: [] }), caption),
    ).toBe(false); // keine Zutaten mehr
    expect(isRecordableCorrection(parsed, recipe({ title: "Neu" }), caption)).toBe(true);
  });

  it("baut aus einer Korrektur ein Corpus-Fixture mit Nutzerfassung als Ground Truth", () => {
    const record: CorrectionRecord = {
      id: "3f9a1c22-0d5e-4a7b-9c11-8b2f4e6d0a33",
      createdAt: Date.UTC(2026, 9, 2),
      sourceUrl: "https://www.instagram.com/reel/Dc0eafRIVrF/",
      sourceCaption: caption,
      parsed: recipe({ title: "🍅 One Pot", ingredients: [{ id: "a", amount: 1, name: "Reis" }] }),
      corrected: recipe({ title: "One Pot" }),
    };

    const fixture = correctionToFixture(record);
    expect(fixture.id).toBe("app-dc0eafrivrf");
    expect(fixture.source).toBe("https://www.instagram.com/reel/Dc0eafRIVrF/");
    expect(fixture.caption).toBe(caption);
    expect(fixture.expected.title).toBe("One Pot");
    expect(fixture.expected.servings).toBe(4);
    expect(fixture.expected.stepsCount).toBe(2);
    expect(fixture.expected.ingredients).toEqual([
      { amount: 200, unit: "g", name: "Jasminreis" },
      { amount: 1, unit: "EL", name: "Pesto Rosso" },
    ]);
    expect(fixture.notes).toContain("Parser: 1 Zutaten / 2 Schritte → 2 Zutaten / 2 Schritte");
  });

  it("exportiert alle Korrekturen als JSON-Array für den Fixture-Ordner", () => {
    const record: CorrectionRecord = {
      id: "abcdef1234567890",
      createdAt: Date.UTC(2026, 9, 2),
      sourceCaption: caption,
      parsed: recipe({ title: "alt" }),
      corrected: recipe(),
    };
    const json = correctionsToFixtureJson([record]);
    const parsedJson = JSON.parse(json) as { id: string; expected: { ingredients: unknown[] } }[];
    expect(Array.isArray(parsedJson)).toBe(true);
    expect(parsedJson).toHaveLength(1);
    expect(parsedJson[0].id).toBe("app-abcdef12");
    expect(parsedJson[0].expected.ingredients).toHaveLength(2);
  });
});
