import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";

/** Minimale gültige Rezeptzeile, wie sie in einem Backup steht. */
function recipeRow(extra: Record<string, unknown> = {}) {
  return {
    id: "r1",
    title: "Pesto Rosso Hähnchen Reis One Pot",
    ingredients: [{ id: "i1", name: "Jasminreis", amount: 200, unit: "g" }],
    steps: [{ id: "s1", order: 1, instruction: "Alles in eine Auflaufform geben." }],
    favorite: false,
    createdAt: 1,
    updatedAt: 2,
    ...extra,
  };
}

function backupFile(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    app: "rezept",
    version: 2,
    exportedAt: 3,
    recipes: [recipeRow()],
    images: [],
    shopping: [],
    ...overrides,
  });
}

describe("parseBackup: kein stiller Feldverlust mehr", () => {
  it("behält Rezept-Metadaten (tags, color, parserVersion, parseSnapshot)", () => {
    const snapshot = {
      title: "Pesto Rosso",
      ingredients: [{ name: "Jasminreis", amount: 200, unit: "g" }],
      steps: ["Alles verrühren."],
    };
    const parsed = parseBackup(
      backupFile({
        recipes: [
          recipeRow({
            tags: ["one-pot", "high-protein"],
            color: "#f97316",
            parserVersion: 14,
            parseSnapshot: snapshot,
          }),
        ],
      }),
    );

    const recipe = parsed.recipes[0];
    expect(recipe.tags).toEqual(["one-pot", "high-protein"]);
    expect(recipe.color).toBe("#f97316");
    expect(recipe.parserVersion).toBe(14);
    // Ohne Snapshot fällt die Parser-Migration auf den konservativen Weg zurück
    expect(recipe.parseSnapshot?.ingredients[0].name).toBe("Jasminreis");
    expect(recipe.parseSnapshot?.steps).toEqual(["Alles verrühren."]);
  });

  it("liest Wochenplan, Korrekturen und Aisle-Reihenfolge", () => {
    const parsed = parseBackup(
      backupFile({
        mealPlan: [
          { id: "m1", dayOfWeek: "mo", recipeId: "r1", servings: 2 },
          { id: "m2", dayOfWeek: "quatsch", recipeId: "r1", servings: 1 },
        ],
        corrections: [
          {
            id: "c1",
            createdAt: 5,
            sourceCaption: "Zutaten: Reis",
            parsed: { title: "Reis", ingredients: [{ name: "Reis" }], steps: [] },
            corrected: { title: "Reisgericht", ingredients: [{ name: "Reis", amount: 200 }], steps: [] },
          },
        ],
        aisleOrder: [{ id: "a1", aisle: "Obst & Gemüse", position: 0, timestamp: 9 }],
      }),
    );

    expect(parsed.mealPlan).toHaveLength(1);
    expect(parsed.mealPlan[0].dayOfWeek).toBe("mo");
    expect(parsed.corrections[0].corrected.title).toBe("Reisgericht");
    expect(parsed.aisleOrder[0].aisle).toBe("Obst & Gemüse");
    // Unvollständige Einträge werden gemeldet, nicht verschluckt
    expect(parsed.warnings.join(" ")).toContain("Wochenplan");
  });

  it("liest Version-1-Backups weiter (ohne Plan/Korrekturen)", () => {
    const parsed = parseBackup(
      JSON.stringify({ app: "rezept", version: 1, exportedAt: 1, recipes: [recipeRow()], images: [], shopping: [] }),
    );
    expect(parsed.recipes).toHaveLength(1);
    expect(parsed.mealPlan).toEqual([]);
    expect(parsed.corrections).toEqual([]);
    expect(parsed.warnings).toEqual([]);
  });

  it("meldet fehlende Bilder, statt still kaputte Rezepte anzulegen", () => {
    const parsed = parseBackup(backupFile({ recipes: [recipeRow({ image: "local-image:fehlt" })] }));
    expect(parsed.recipes).toHaveLength(1);
    expect(parsed.warnings.join(" ")).toContain("fehlt das Bild");
  });

  it("verwirft einen unbrauchbaren Parse-Snapshot, behält aber das Rezept", () => {
    const parsed = parseBackup(backupFile({ recipes: [recipeRow({ parseSnapshot: { kaputt: true } })] }));
    expect(parsed.recipes[0].parseSnapshot).toBeUndefined();
    expect(parsed.recipes[0].title).toContain("Pesto");
  });

  it("lehnt fremde Dateien und unbekannte Versionen ab", () => {
    expect(() => parseBackup("{}")).toThrow();
    expect(() => parseBackup("kein json")).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ app: "rezept", version: 99, recipes: [], images: [], shopping: [] })),
    ).toThrow();
  });
});
