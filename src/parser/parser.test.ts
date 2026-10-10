import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("erkennt Aufzählungszeichen (*, •, +) vor der Menge", () => {
    expect(parseIngredientLine("* 200 g Jasminreis")).toMatchObject({
      amount: 200, unit: "g", name: "Jasminreis",
    });
    expect(parseIngredientLine("• 1 EL Pesto Rosso")).toMatchObject({
      amount: 1, unit: "EL", name: "Pesto Rosso",
    });
    expect(parseIngredientLine("+ 400 ml Hühnerbrühe")).toMatchObject({
      amount: 400, unit: "ml", name: "Hühnerbrühe",
    });
    expect(parseIngredientLine("* 1 1/2 TL Knoblauch")).toMatchObject({
      amount: 1.5, unit: "TL", name: "Knoblauch",
    });
  });

  it("verwirft Nährwert- und Portionszeilen", () => {
    expect(parseIngredientLine("* 464 kcal")).toBeNull();
    expect(parseIngredientLine("46 g Protein")).toBeNull();
    expect(parseIngredientLine("Pro Portion (4 Portionen):")).toBeNull();
    expect(parseIngredientLine("Nährwerte")).toBeNull();
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

/**
 * Gemeldeter Fall (Instagram-Reel DdgIhNnA3RI, @gentianas_foodhouse):
 * „250 g gewürfelten Speck" und „Halben Bund Lauch oder 1 Stange Porree" wurden
 * zu EINER Zutat verschmolzen. Ursache: Die Fortsetzungsprüfung verlangte eine
 * **Ziffer** vor der Einheit – „Halben Bund" hat keine.
 */
describe("Zutatenzeilen mit Wort-Menge oder Einheit am Anfang", () => {
  const reel = [
    "Flammkuchen Laugenbrezel 🥨🥨🥨 der Renner wie jedes Jahr",
    "",
    "Ihr braucht:",
    "10 Laugenbrezel",
    "1 Becher Creme Fraiche",
    "1 Becher Körnigerfrischkäse",
    "3 Eier",
    "250 g gewürfelten Speck",
    "Halben Bund Lauch oder 1 Stange Porree",
    "2 volle Hände geriebenen Käse",
    "2 volle Hände geröstete Zwiebeln",
    "Etwas Salz, Pfeffer, Knoblauchpulver, Papirka edelsüß",
    "",
    "Gefrorene Brezel auf ein Backblech legen. Alle Zutaten in eine Schüssel geben.",
  ].join("\n");

  it("hält Speck und Lauch getrennt", () => {
    const parsed = parseRecipe(reel)!;
    const names = parsed.ingredients.map((ingredient) => ingredient.name);
    expect(names.some((name) => /speck/i.test(name))).toBe(true);
    expect(names.some((name) => /lauch/i.test(name))).toBe(true);
    // Keine Zutat darf beide Wörter enthalten – das war der gemeldete Fehler
    expect(names.filter((name) => /speck/i.test(name) && /lauch/i.test(name))).toEqual([]);
  });

  it("liest Halben Bund Lauch als halbe Einheit Bund", () => {
    const parsed = parseRecipe(reel)!;
    const lauch = parsed.ingredients.find((ingredient) => /^lauch/i.test(ingredient.name));
    expect(lauch?.amount).toBe(0.5);
    expect(lauch?.unit).toBe("Bund");
  });

  it("nimmt eine Zeile mit Einheit am Anfang als eigene Zutat", () => {
    const parsed = parseRecipe("Zutaten\n200 g Mehl\nBund Petersilie\n3 Eier")!;
    const names = parsed.ingredients.map((ingredient) => ingredient.name);
    expect(names).toContain("Petersilie");
  });
});

/**
 * Zutatengruppen: Abschnitts-Überschriften („Teig", „FÜLLUNG", „Guss:") sind
 * **keine** Zutaten mehr, sondern ein eigenes Feld. Vorher landeten sie in der
 * Zutatenliste und klebten an Namen (gemessen: „Salz FÜLLUNG").
 */
describe("Zutatengruppen", () => {
  it("macht aus Überschriften Gruppen statt Zutaten", () => {
    const parsed = parseRecipe(
      "Zimt-Zupfbrot\nZutaten\n200 g Mehl\nFÜLLUNG\n100 g Butter\nGuss:\n50 g Puderzucker",
    )!;
    expect(parsed.ingredients.map((ingredient) => ingredient.name)).toEqual([
      "Mehl",
      "Butter",
      "Puderzucker",
    ]);
    expect(parsed.ingredients.map((ingredient) => ingredient.group)).toEqual([
      undefined,
      "FÜLLUNG",
      "Guss",
    ]);
  });

  it("behält dieselbe Zutat in verschiedenen Gruppen dreimal", () => {
    const parsed = parseRecipe(
      "Zutaten\nTeig:\n100 g Butter\nFüllung:\n100 g Butter\nGuss:\n100 g Butter",
    )!;
    expect(parsed.ingredients.filter((ingredient) => ingredient.name === "Butter")).toHaveLength(3);
  });

  it("fasst wörtlich gleiche Zeilen derselben Gruppe zusammen", () => {
    /*
     * Bewusst NICHT im Parser: Er bleibt faithful, damit die Korpus-Messung nicht
     * Recall verliert (gemessen: F1 0,982 → 0,976). Zusammengefasst wird beim
     * Speichern gruppenbewusst im Merge – siehe `parseMerge.test.ts`.
     */
    const parsed = parseRecipe("Zutaten\nTeig:\n100 g Butter\n100 g Butter")!;
    expect(parsed.ingredients.filter((ingredient) => ingredient.name === "Butter")).toHaveLength(2);
  });

  it("entfernt das einleitende Für-die-Wendung aus dem Gruppennamen", () => {
    const parsed = parseRecipe("Zutaten\n200 g Mehl\nFür die Soße:\n100 ml Sahne")!;
    const sauce = parsed.ingredients.find((ingredient) => ingredient.name === "Sahne");
    expect(sauce?.group).toBe("Soße");
  });

  /*
   * Regression mit einem **echten** Fall aus der eigenen Bibliothek
   * (fixtures-user/lib-dcgdvyls97b.json, Zimt-Zupfbrot): Dort stand gespeichert
   * „Salz FÜLLUNG", weil der Parser die Überschrift an den Zutatennamen klebte.
   */
  it("klebt die Überschrift FÜLLUNG nicht mehr an den Zutatennamen", () => {
    const fixture = JSON.parse(
      readFileSync(join(process.cwd(), "src/parser/corpus/fixtures-user/lib-dcgdvyls97b.json"), "utf8"),
    ) as { caption: string };
    const parsed = parseRecipe(fixture.caption)!;

    expect(parsed.ingredients.some((ingredient) => /füllung/i.test(ingredient.name))).toBe(false);
    expect(parsed.ingredients.some((ingredient) => /füllung/i.test(ingredient.group ?? ""))).toBe(true);
  });
});

/**
 * Gemeldete Fälle aus den Sicherungen 3 und 4: Zutaten wurden verschmolzen,
 * Fremdzeilen landeten in der Liste. Jeder Fall ist ein echter Caption-Ausschnitt.
 */
describe("Zutaten-Qualität: nichts verschmelzen, nichts Fremdes aufnehmen", () => {
  it("verschmilzt aufeinanderfolgende Zutaten ohne Menge nicht", () => {
    const parsed = parseRecipe("Zutaten\n1 TL italienische Kräuter\nSalz & Pfeffer\nfrische Petersilie")!;
    expect(parsed.ingredients.map((ingredient) => ingredient.name)).toEqual([
      "italienische Kräuter",
      "Salz & Pfeffer",
      "frische Petersilie",
    ]);
  });

  it("hängt eine echte Fortsetzung weiterhin an", () => {
    // Mit Anleitung, damit derselbe Weg wie in echten Captions läuft
    const parsed = parseRecipe("Zutaten\n1 Zwiebel\nfein gehackt\nZubereitung\nZwiebel anbraten.")!;
    const onion = parsed.ingredients.find((ingredient) => ingredient.name.startsWith("Zwiebel"));
    expect(onion?.name).toContain("fein gehackt");
    expect(parsed.ingredients).toHaveLength(1);
  });

  it("macht aus einer Alternativ-Angabe keine eigene Zutat", () => {
    const parsed = parseRecipe("Zutaten\n150 g geriebener Käse, z. B. Gouda oder Emmentaler")!;
    expect(parsed.ingredients).toHaveLength(1);
    expect(parsed.ingredients[0].name).toContain("geriebener Käse");
  });

  it("nimmt kurze Etiketten nicht als Zutaten, sondern als Gruppe", () => {
    const parsed = parseRecipe("Zutaten\nChicken:\n500 g Hähnchen\nOther:\n2 EL Öl")!;
    expect(parsed.ingredients.map((ingredient) => ingredient.name)).toEqual(["Hähnchen", "Öl"]);
    expect(parsed.ingredients[0].group).toBe("Chicken");
  });

  it("hält Backofenangaben aus den Zutaten", () => {
    const parsed = parseRecipe("Zutaten\nOfen:\n180 °C Ober-/Unterhitze\n500 g Mehl")!;
    expect(parsed.ingredients.map((ingredient) => ingredient.name)).toEqual(["Mehl"]);
  });

  it("zieht einen ganzen Kochsatz aus den Zutaten in die Schritte", () => {
    const parsed = parseRecipe("Zutaten\n200 g Joghurt\n1️⃣ Die Tacos heiß mit dem Joghurt servieren")!;
    expect(parsed.ingredients.map((ingredient) => ingredient.name)).toEqual(["Joghurt"]);
    expect(parsed.steps.some((step) => /servieren/.test(step.instruction))).toBe(true);
  });

  it("teilt eine reine Aufzählung ohne Mengen", () => {
    const parsed = parseRecipe("Zutaten\nSalz Pfeffer, Knoblauchpulver, Paprika edelsüß")!;
    expect(parsed.ingredients.map((ingredient) => ingredient.name)).toEqual([
      "Salz Pfeffer",
      "Knoblauchpulver",
      "Paprika edelsüß",
    ]);
  });

  it("lässt eine Zutat mit Menge und Würzliste zusammen", () => {
    const parsed = parseRecipe("Zutaten\n1 TL Salz, Pfeffer, Paprika edelsüß")!;
    expect(parsed.ingredients).toHaveLength(1);
  });

  it("nimmt Nährwertzeilen im Meal-Prep-Stil nicht als Zutaten", () => {
    const parsed = parseRecipe("Zutaten\nChicken:\n1.5 kg Hähnchen\n481 Calories\n43g Protein")!;
    expect(parsed.ingredients.map((ingredient) => ingredient.name)).toEqual(["Hähnchen"]);
  });

  it("erkennt ein Etikett trotz Klammerzahl", () => {
    const parsed = parseRecipe("Zutaten\nThe Best Buff Chicken Subs (makes 12):\n4 Baguettes")!;
    expect(parsed.ingredients.map((ingredient) => ingredient.name)).toEqual(["Baguettes"]);
  });

  it("erkennt eine englische Abschnittsangabe ohne Doppelpunkt", () => {
    const parsed = parseRecipe("Zutaten\nTo serve\n200 g Joghurt")!;
    expect(parsed.ingredients.map((ingredient) => ingredient.name)).toEqual(["Joghurt"]);
  });

  it("macht aus einer nachgestellten Notiz keinen Namensbestandteil", () => {
    const parsed = parseRecipe("Zutaten\n50-100 ml Mandeldrink\noptional:")!;
    expect(parsed.ingredients[0].name).toBe("Mandeldrink");
    expect(parsed.ingredients[0].notes).toContain("optional");
  });

  it("nimmt deutsche Makro-Labels nicht als Zutaten", () => {
    const parsed = parseRecipe(
      "Zutaten\n500 g Magerquark\n* Eiweiß: ca. 11 g\n* Fett: ca. 3 g\n* Kalorien: ca. 95 kcal",
    )!;
    expect(parsed.ingredients.map((ingredient) => ingredient.name)).toEqual(["Magerquark"]);
  });

  /*
   * Fälle aus der redaktionellen Prüfung (tmp/review.md): Caption selbst gelesen
   * und mit dem Parser-Ergebnis verglichen.
   */
  it("erfindet aus Anleitungssätzen keine Zutaten-Fragmente", () => {
    const parsed = parseRecipe(
      "Zutaten\n240 g Mehl\nZubereitung\nAdd 1 tbsp sugar to a bowl and mix. Mix 1 cup sugar with cinnamon.",
    )!;
    const names = parsed.ingredients.map((ingredient) => ingredient.name);
    expect(names).toContain("Mehl");
    expect(names.every((name) => !/\bto a\b|\bwith\b/i.test(name))).toBe(true);
  });

  it("nimmt Kommentar-Boilerplate und Schlussfloskeln nicht als Schritt", () => {
    const parsed = parseRecipe(
      "Zutaten\n200 g Mehl\nZubereitung\nMehl sieben. Alle 64 Kommentare ansehen\nLasst es euch schmecken",
    )!;
    expect(parsed.steps.map((step) => step.instruction)).toEqual(["Mehl sieben."]);
  });

  it("nimmt eine Backofenangabe mit Handlungsverb als Schritt", () => {
    const parsed = parseRecipe("Zutaten\n200 g Mehl\nPreheat oven to 180C / 360F")!;
    expect(parsed.steps.some((step) => /Preheat/.test(step.instruction))).toBe(true);
  });

  it("nimmt Gefäßgrößen nicht als Zutat", () => {
    const parsed = parseRecipe("Zutaten\n45 g Wrap\n24 oz Bowl size - 720ml / 24oz")!;
    expect(parsed.ingredients.map((ingredient) => ingredient.name)).toEqual(["Wrap"]);
  });

  /*
   * Befunde der sechs Lektoren über alle 45 Rezepte (tmp/review.md).
   */
  it("entfernt Instagram-Resttext aus Schritten", () => {
    const parsed = parseRecipe("Zutaten\n200 g Mehl\nZubereitung\nMehl sieben. Alle 21Kommentare ansehen")!;
    expect(parsed.steps.map((step) => step.instruction)).toEqual(["Mehl sieben."]);
  });

  it("nimmt nackte Überschriftenwörter nicht als Schritt", () => {
    const parsed = parseRecipe("Zutaten\n200 g Mehl\nZubereitung\nBacken\nTeig kneten.")!;
    expect(parsed.steps.map((step) => step.instruction)).toEqual(["Teig kneten."]);
  });

  it("erkennt Abschnittsangaben mit englischem oder besitzanzeigendem Artikel", () => {
    const parsed = parseRecipe(
      "Zutaten\nFor the tikka masala sauce\n200 g Joghurt\nFür mein Notella\n50 g Haselnüsse",
    )!;
    expect(parsed.ingredients.map((ingredient) => ingredient.name)).toEqual(["Joghurt", "Haselnüsse"]);
  });

  it("erfindet keine Zutaten aus Handlungswörtern der Anleitung", () => {
    const parsed = parseRecipe(
      "Zutaten\n400 g Tomaten\nZubereitung\n100 ml Wasser ausspülen. 87.5 g formen. Von den Zwiebeln etwas abnehmen.",
    )!;
    const names = parsed.ingredients.map((ingredient) => ingredient.name);
    expect(names).toContain("Tomaten");
    expect(names.every((name) => !/(?:formen|ausspülen|abnehmen|von den)/i.test(name))).toBe(true);
  });
});

