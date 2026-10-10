import { describe, expect, it } from "vitest";
import type { Ingredient, ParseSnapshot, RecipeStep } from "@/domain/types";
import { createParseSnapshot, entrySimilarity, mergeParsedRecipe, normalizeEntry } from "./parseMerge";

function ing(name: string, amount?: number, unit?: string): Ingredient {
  return { id: `id-${name}`, name, amount, unit };
}

/**
 * Dubletten-Regel in der Praxis (gemessen: 3× „weiche Butter" wurde zu 2×):
 * Dieselbe Zutat in **verschiedenen Gruppen** bleibt erhalten, identische Zeilen
 * derselben Gruppe werden zusammengefasst.
 */
describe("parseMerge: Dubletten-Regel mit Zutatengruppen", () => {
  it("behält dieselbe Zutat in verschiedenen Gruppen dreimal", () => {
    const three: Ingredient[] = ["Teig", "Füllung", "Guss"].map((group, index) => ({
      ...ing(`Butter-${index}`, 100, "g"),
      name: "Butter",
      group,
    }));
    const result = mergeParsedRecipe(
      { title: "Parser-Titel", ingredients: three, steps: [], parseSnapshot: snapshot(three) },
      { title: "Parser-Titel", ingredients: three, steps: [] },
    );
    expect(result.ingredients.filter((entry) => entry.name === "Butter")).toHaveLength(3);
  });

  it("fasst identische Zeilen derselben Gruppe zusammen", () => {
    const two: Ingredient[] = [
      { ...ing("Butter-a", 100, "g"), name: "Butter", group: "Teig" },
      { ...ing("Butter-b", 100, "g"), name: "Butter", group: "Teig" },
    ];
    const result = mergeParsedRecipe(
      { title: "Parser-Titel", ingredients: two, steps: [], parseSnapshot: snapshot(two) },
      { title: "Parser-Titel", ingredients: two, steps: [] },
    );
    expect(result.ingredients.filter((entry) => entry.name === "Butter")).toHaveLength(1);
  });

  /*
   * Gemessen: Wechselt eine Zutat durch eine Parser-Verbesserung die Gruppe
   * („Olivenöl [Suppe]" → „Olivenöl [Zum Servieren]"), stand sie im Bestand
   * zweimal – einmal aus dem Merge, einmal aus dem alten Stand.
   */
  it("legt eine Zutat nach Gruppenwechsel nicht doppelt an", () => {
    const oldEntry: Ingredient = { ...ing("Olivenöl"), name: "Olivenöl", group: "Suppe" };
    const newEntry: Ingredient = { ...ing("Olivenöl"), name: "Olivenöl", group: "Zum Servieren" };
    const result = mergeParsedRecipe(
      // Leerer Snapshot → der Bestand zählt als „vom Nutzer", nicht als Parser-Eintrag
      { title: "Parser-Titel", ingredients: [oldEntry], steps: [], parseSnapshot: snapshot([]) },
      { title: "Parser-Titel", ingredients: [newEntry], steps: [] },
    );
    expect(result.ingredients).toHaveLength(1);
    expect(result.ingredients[0].group).toBe("Zum Servieren");
  });
});

function step(order: number, instruction: string): RecipeStep {
  return { id: `s-${order}`, order, instruction };
}

function snapshot(ingredients: Ingredient[], steps: string[] = [], title = "Parser-Titel"): ParseSnapshot {
  return createParseSnapshot({ title, ingredients, steps: steps.map((instruction) => ({ instruction })) });
}

describe("parseMerge: Nutzeränderungen überleben den Re-Parse", () => {
  it("löscht gelöschte Zutaten nicht wieder herbei", () => {
    const snap = snapshot([ing("Mehl", 500, "g"), ing("Zucker", 100, "g"), ing("Butter", 200, "g")]);
    const result = mergeParsedRecipe(
      { title: "Parser-Titel", ingredients: [ing("Mehl", 500, "g"), ing("Butter", 200, "g")], steps: [], parseSnapshot: snap },
      { title: "Parser-Titel", ingredients: [ing("Mehl", 500, "g"), ing("Zucker", 100, "g"), ing("Butter", 200, "g")], steps: [] },
    );

    expect(result.ingredients.map((i) => i.name)).toEqual(["Mehl", "Butter"]);
    expect(result.respectedRemovals).toBe(1);
  });

  it("legt umbenannte Zutaten nicht doppelt an", () => {
    const snap = snapshot([ing("Zwiebel", 1), ing("Mehl", 500, "g")]);
    const result = mergeParsedRecipe(
      { title: "Parser-Titel", ingredients: [ing("rote Zwiebel", 1), ing("Mehl", 500, "g")], steps: [], parseSnapshot: snap },
      { title: "Parser-Titel", ingredients: [ing("Zwiebel", 1), ing("Mehl", 500, "g")], steps: [] },
    );

    expect(result.ingredients.map((i) => i.name)).toEqual(["rote Zwiebel", "Mehl"]);
    expect(result.respectedEdits).toBe(1);
  });

  it("behält die vom Nutzer gesetzte Menge, übernimmt aber Parser-Verbesserungen", () => {
    const snap = snapshot([ing("Zwiebel", 1), ing("Mehl", 400, "g")]);
    const result = mergeParsedRecipe(
      {
        title: "Parser-Titel",
        ingredients: [ing("Zwiebel", 3), ing("Mehl", 400, "g")],
        steps: [],
        parseSnapshot: snap,
      },
      { title: "Parser-Titel", ingredients: [ing("Zwiebel", 2), ing("Mehl", 500, "g")], steps: [] },
    );

    const zwiebel = result.ingredients.find((i) => i.name === "Zwiebel")!;
    const mehl = result.ingredients.find((i) => i.name === "Mehl")!;
    expect(zwiebel.amount).toBe(3); // Nutzerfassung gewinnt
    expect(mehl.amount).toBe(500); // unverändert → neuer Parser-Wert
    expect(mehl.id).toBe("id-Mehl"); // ID bleibt stabil
  });

  it("ergänzt neu erkannte Zutaten und behält selbst hinzugefügte", () => {
    const snap = snapshot([ing("Mehl", 500, "g")]);
    const result = mergeParsedRecipe(
      {
        title: "Parser-Titel",
        ingredients: [ing("Mehl", 500, "g"), ing("Vanillezucker", 1, "Pck")],
        steps: [],
        parseSnapshot: snap,
      },
      { title: "Parser-Titel", ingredients: [ing("Mehl", 500, "g"), ing("Salz", 1, "Prise")], steps: [] },
    );

    const names = result.ingredients.map((i) => i.name);
    expect(names).toContain("Salz"); // neu erkannt
    expect(names).toContain("Vanillezucker"); // selbst ergänzt
    expect(names.filter((n) => n === "Mehl")).toHaveLength(1);
  });

  it("überschreibt einen selbst gesetzten Titel nicht", () => {
    const snap = snapshot([ing("Mehl", 500, "g")], [], "Ofensuppe");
    const edited = mergeParsedRecipe(
      { title: "Meine Suppe", ingredients: [ing("Mehl", 500, "g")], steps: [], parseSnapshot: snap },
      { title: "Ofensuppe", ingredients: [ing("Mehl", 500, "g")], steps: [] },
    );
    expect(edited.title).toBe("Meine Suppe");

    const untouched = mergeParsedRecipe(
      { title: "Ofensuppe", ingredients: [ing("Mehl", 500, "g")], steps: [], parseSnapshot: snap },
      { title: "Ofensuppe neu", ingredients: [ing("Mehl", 500, "g")], steps: [] },
    );
    expect(untouched.title).toBe("Ofensuppe neu");
  });

  it("behandelt Schritte genauso (gelöscht bleibt gelöscht, bearbeitet bleibt bearbeitet)", () => {
    const snap = snapshot([ing("Mehl", 500, "g")], ["Teig kneten.", "Backen.", "Servieren."]);
    const result = mergeParsedRecipe(
      {
        title: "Parser-Titel",
        ingredients: [ing("Mehl", 500, "g")],
        steps: [step(1, "Teig sehr gut kneten."), step(2, "Backen.")],
        parseSnapshot: snap,
      },
      {
        title: "Parser-Titel",
        ingredients: [ing("Mehl", 500, "g")],
        steps: [step(1, "Teig kneten."), step(2, "Backen."), step(3, "Servieren.")],
      },
    );

    const texts = result.steps.map((s) => s.instruction);
    expect(texts).toContain("Teig sehr gut kneten."); // Nutzerfassung
    expect(texts).not.toContain("Servieren."); // gelöscht
    expect(texts.some((t) => t === "Backen.")).toBe(true);
  });

  it("aktualisiert Rezepte ohne Snapshot nur, wenn sie unverändert sind (Legacy)", () => {
    const unchanged = mergeParsedRecipe(
      { title: "Alt", ingredients: [ing("Mehl", 400, "g"), ing("Zucker", 100, "g")], steps: [] },
      { title: "Neu", ingredients: [ing("Mehl", 500, "g"), ing("Zucker", 100, "g")], steps: [] },
    );
    expect(unchanged.legacyMerge).toBe(true);
    expect(unchanged.ingredients.find((i) => i.name === "Mehl")!.amount).toBe(500);
    expect(unchanged.ingredients[0].id).toBe("id-Mehl");

    const edited = mergeParsedRecipe(
      { title: "Alt", ingredients: [ing("Mehl", 400, "g")], steps: [step(1, "Alles verrühren.")] },
      { title: "Neu", ingredients: [ing("Mehl", 500, "g"), ing("Salz", 1, "Prise")], steps: [step(1, "Alles verrühren.")] },
    );
    expect(edited.userEdited).toBe(true);
    expect(edited.title).toBe("Alt"); // Nutzerfassung bleibt
    expect(edited.ingredients.map((i) => i.name)).toEqual(["Mehl", "Salz"]);
  });

  it("vergleicht Einträge tolerant (Füllwörter, Klammern, Umbenennungen)", () => {
    expect(entrySimilarity("Zwiebel(n)", "Zwiebeln")).toBe(1);
    expect(entrySimilarity("Ei (Größe M)", "Ei")).toBe(1);
    expect(entrySimilarity("rote Zwiebel", "Zwiebel")).toBe(1);
    expect(entrySimilarity("Mehl", "Zucker")).toBe(0);
    expect(normalizeEntry("„Eat Lean“ Käse (Pro)")).toBe("eat lean käse");
  });
});
