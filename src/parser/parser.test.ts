import { describe, expect, it } from "vitest";
import { parseRecipe, parseAmountString, parseIngredientLine } from "./index";

describe("parseAmountString", () => {
  it("parsed Ganzzahlen, Dezimalzahlen und Brüche", () => {
    expect(parseAmountString("1")).toBe(1);
    expect(parseAmountString("10")).toBe(10);
    expect(parseAmountString("0.5")).toBe(0.5);
    expect(parseAmountString("1,5")).toBe(1.5);
    expect(parseAmountString("2,5")).toBe(2.5);
    expect(parseAmountString("1/2")).toBe(0.5);
    expect(parseAmountString("1/4")).toBe(0.25);
    expect(parseAmountString("3/4")).toBe(0.75);
    expect(parseAmountString("1 1/2")).toBe(1.5);
    expect(parseAmountString("2-3")).toBe(2.5);
    expect(parseAmountString("2–3")).toBe(2.5);
    expect(parseAmountString("2 bis 3")).toBe(2.5);
    expect(parseAmountString("abc")).toBeUndefined();
    expect(parseAmountString("1/0")).toBeUndefined();
  });
});

describe("parseIngredientLine", () => {
  it("parsed Menge + Einheit + Name", () => {
    expect(parseIngredientLine("500 g Hähnchenbrust")).toMatchObject({
      amount: 500, unit: "g", name: "Hähnchenbrust",
    });
    expect(parseIngredientLine("200 ml Sahne")).toMatchObject({
      amount: 200, unit: "ml", name: "Sahne",
    });
    expect(parseIngredientLine("2 EL Olivenöl")).toMatchObject({
      amount: 2, unit: "EL", name: "Olivenöl",
    });
    expect(parseIngredientLine("1/2 TL Salz")).toMatchObject({
      amount: 0.5, unit: "TL", name: "Salz",
    });
    expect(parseIngredientLine("1 1/2 cups flour")).toMatchObject({
      amount: 1.5, unit: "cup", name: "flour",
    });
    expect(parseIngredientLine("2 Stück Eier")).toMatchObject({
      amount: 2, unit: "Stück", name: "Eier",
    });
  });

  it("parsed ohne Einheit und ohne Menge", () => {
    expect(parseIngredientLine("2 Eier")).toMatchObject({ amount: 2, name: "Eier" });
    const noAmount = parseIngredientLine("Salz und Pfeffer");
    expect(noAmount).toMatchObject({ name: "Salz und Pfeffer", uncertain: true });
  });

  it("parsed Wortzahlen nur vor Einheiten", () => {
    expect(parseIngredientLine("eine Prise Salz")).toMatchObject({
      amount: 1, unit: "Prise", name: "Salz",
    });
    expect(parseIngredientLine("One Pot Pasta")).toMatchObject({
      name: "One Pot Pasta", uncertain: true,
    });
  });

  it("extrahiert Notizen aus Klammern und nach Komma", () => {
    expect(parseIngredientLine("50 g Parmesan, frisch gerieben")).toMatchObject({
      amount: 50, unit: "g", name: "Parmesan", notes: "frisch gerieben",
    });
    expect(parseIngredientLine("1 Bund Petersilie (optional)")).toMatchObject({
      amount: 1, unit: "Bund", name: "Petersilie", notes: "optional",
    });
  });

  it("lehnt Fließtext-Schritte ab", () => {
    expect(parseIngredientLine("Den Ofen auf 200 Grad vorheizen und die Form einfetten")).toBeNull();
  });

  it("behält Dezimalkommas und gemischte Unicode-Brüche", () => {
    expect(parseIngredientLine("2,5 EL Olivenöl")).toMatchObject({
      amount: 2.5, unit: "EL", name: "Olivenöl",
    });
    const r = parseRecipe("Zutaten\n1½ EL Olivenöl\n2⅓ TL Salz\nZubereitung\nMischen.")!;
    expect(r.ingredients[0]).toMatchObject({ amount: 1.5, unit: "EL" });
    expect(r.ingredients[1]).toMatchObject({ amount: 2 + 1 / 3, unit: "TL" });
  });

  it("erkennt kompakte Einheiten wie 500g Mehl", () => {
    expect(parseIngredientLine("500g Mehl")).toMatchObject({
      amount: 500,
      unit: "g",
      name: "Mehl",
    });
  });

  it("erhält Zeilen wie 10 Minuten köcheln lassen ohne Schritt-Kürzung", () => {
    const r = parseRecipe("Zutaten:\n1 Apfel\nZubereitung:\n10 Minuten köcheln lassen.")!;
    expect(r.steps[0].instruction).toBe("10 Minuten köcheln lassen.");
  });

  it("macht aus 2 Hähnchenbrüste keine 120 Minuten Garzeit", () => {
    const r = parseRecipe("Hähnchengericht\nZutaten:\n2 Hähnchenbrüste\nZubereitung:\nAnbraten.")!;
    expect(r.cookTime).toBeUndefined();
  });

  it("erkennt Zutaten auch wenn nur Instructions-Überschrift da ist", () => {
    const r = parseRecipe("Pasta\n200 g Nudeln\nInstructions\nCook pasta.")!;
    expect(r.ingredients.length).toBeGreaterThan(0);
    expect(r.ingredients[0].name).toBe("Nudeln");
  });

  it("splittet Komma-Listen ohne Dezimalkommas zu zerstören", () => {
    const r = parseRecipe("Zutaten\n2,5 EL Olivenöl, 1 TL Salz, 3 Eier\nZubereitung\nMischen.")!;
    expect(r.ingredients.map((i) => [i.amount, i.unit, i.name])).toEqual([
      [2.5, "EL", "Olivenöl"],
      [1, "TL", "Salz"],
      [3, undefined, "Eier"],
    ]);
  });
});

describe("parseRecipe – Deutsch", () => {
  const caption = `Creamy Garlic Chicken
für 2 Portionen | 25 Minuten

Zutaten:
500 g Hähnchenbrust
2 Eier
200 ml Sahne
50 g Parmesan
1/2 TL Salz
eine Prise Pfeffer

Zubereitung:
1. Hähnchen schneiden und anbraten.
2. Sahne und Parmesan dazugeben.
3. 10 Minuten köcheln lassen.

#rezept #kochen @freund`;

  it("erkennt Titel, Portionen, Zeit", () => {
    const r = parseRecipe(caption)!;
    expect(r.title).toBe("Creamy Garlic Chicken");
    expect(r.servings).toBe(2);
    expect(r.cookTime).toBe(25);
  });

  it("erkennt alle Zutaten mit Mengen", () => {
    const r = parseRecipe(caption)!;
    expect(r.ingredients).toHaveLength(6);
    expect(r.ingredients[0]).toMatchObject({ amount: 500, unit: "g", name: "Hähnchenbrust" });
    expect(r.ingredients[4]).toMatchObject({ amount: 0.5, unit: "TL" });
    expect(r.ingredients[5]).toMatchObject({ amount: 1, unit: "Prise" });
  });

  it("erkennt Schritte ohne Hashtag-Müll", () => {
    const r = parseRecipe(caption)!;
    expect(r.steps).toHaveLength(3);
    expect(r.steps[0].instruction).toContain("Hähnchen");
    expect(r.steps.map((s) => s.order)).toEqual([1, 2, 3]);
  });
});

describe("parseRecipe – Englisch", () => {
  const caption = `Easy Pasta Bake
Serves 4
Prep time: 15 minutes
Cook time: 30 minutes

Ingredients
400 g pasta
2 cups mozzarella
1 tbsp olive oil
1/2 tsp salt

Instructions
1. Cook the pasta according to the package.
2. Mix everything and bake for 30 minutes.`;

  it("erkennt englische Überschriften, servings, Zeiten", () => {
    const r = parseRecipe(caption)!;
    expect(r.title).toBe("Easy Pasta Bake");
    expect(r.servings).toBe(4);
    expect(r.prepTime).toBe(15);
    expect(r.cookTime).toBe(30);
    expect(r.ingredients).toHaveLength(4);
    expect(r.ingredients[1]).toMatchObject({ amount: 2, unit: "cup" });
    expect(r.ingredients[2]).toMatchObject({ amount: 1, unit: "EL" });
    expect(r.steps).toHaveLength(2);
  });
});

describe("parseRecipe – ohne Überschriften", () => {
  it("klassifiziert Zeilen per Scoring", () => {
    const caption = `Tomaten-Mozzarella-Salat
250 g Tomaten
125 g Mozzarella
2 EL Olivenöl
Alles schneiden und auf einem Teller anrichten. Mit Basilikum servieren.`;
    const r = parseRecipe(caption)!;
    expect(r.title).toBe("Tomaten-Mozzarella-Salat");
    expect(r.ingredients.length).toBe(3);
    expect(r.steps.length).toBeGreaterThanOrEqual(1);
  });
});

describe("parseRecipe – Grenzfälle", () => {
  it("gibt null für leeren/Müll-Input zurück", () => {
    expect(parseRecipe("")).toBeNull();
    expect(parseRecipe("   \n\n  ")).toBeNull();
    expect(parseRecipe("#food #love #insta")).toBeNull();
    expect(parseRecipe("Hallo Welt")).toBeNull();
  });

  it("erfundene Werte werden nicht erzeugt", () => {
    const r = parseRecipe("Zutaten\nEtwas Salz\nMehl")!;
    expect(r.ingredients[0].amount).toBeUndefined();
    expect(r.ingredients[0].uncertain).toBe(true);
  });
});

import { pickTitle } from "./meta";

describe("Titel-Extraktion", () => {
  it("entfernt 'Hier steht das Rezept' Intro", () => {
    expect(pickTitle(["Hier steht das Rezept 👇 noch mehr bei IG: User"], () => false))
      .toBe(undefined); // Komplett Intro, kein Titel
  });

  it("entfernt 'Zum Rezept' Intro und extrahiert echten Titel", () => {
    expect(pickTitle([
      "Zum Rezept ⬇️ Mehr Rezepte bei IG: User",
      "Cremige Tomatensuppe"
    ], () => false)).toBe("Cremige Tomatensuppe");
  });

  it("bewahrt echte Titel mit Emoji", () => {
    expect(pickTitle(["Cheeseburger Tacos 🧀🍔"], () => false))
      .toBe("Cheeseburger Tacos");
  });
});

