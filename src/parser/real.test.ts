import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseRecipe } from "./index";

// Echte Caption eines Instagram-Reels (über die Meta-Tag-Route abgerufen)
const caption = readFileSync(join(__dirname, "fixtures", "real-caption.txt"), "utf-8");

const compactGermanCaption = `ZUM REZEPT ⬇️
Mengenangaben:
- 180g „Eat lean“ Käse | Alternativ Gouda, leicht
- 150g magere Schinkenwürfel
- 100g Magerquark
- 50g Mais
- 1/2 rote Zwiebel
- 1 Knoblauch Zehe
- 1 TL Oregano
- 8x Kaiserbrötchen ausgehöhlt
( die ausgehöhlte Masse kann man gut mit in ein Porridge geben )
- 8TL Tomatenmark
- (( die fertige Masse ))
- BACKOFEN: 200 Grad O/U-Hitze ~ 20min`;

describe("echte Instagram-Caption (Chipotle Beef Tacos)", () => {
  it("erkennt Titel", () => {
    const r = parseRecipe(caption)!;
    expect(r.title).toBe("Crispy Chipotle Beef Tacos");
  });

  it("erkennt Zutaten aus Unterabschnitten (For the Beef, Sauce, ...)", () => {
    const r = parseRecipe(caption)!;
    expect(r.ingredients.length).toBeGreaterThanOrEqual(20);
    expect(r.ingredients).toContainEqual(
      expect.objectContaining({ amount: 1, unit: "lb", name: "ground beef" }),
    );
    expect(r.ingredients).toContainEqual(
      expect.objectContaining({ amount: 0.5, unit: "cup", name: "beef stock" }),
    );
    // "Juice of 1/2 lime" → Menge erkannt
    expect(r.ingredients).toContainEqual(
      expect.objectContaining({ amount: 0.5, name: "Juice of lime" }),
    );
  });

  it("teilt kommagetrennte Gewürzlisten auf", () => {
    const r = parseRecipe(caption)!;
    expect(r.ingredients).toContainEqual(
      expect.objectContaining({ amount: 1, unit: "EL", name: "cumin" }),
    );
    expect(r.ingredients).toContainEqual(
      expect.objectContaining({ amount: 2, unit: "TL", name: "paprika" }),
    );
  });

  it("erkennt Schritte", () => {
    const r = parseRecipe(caption)!;
    expect(r.steps.length).toBe(5);
    expect(r.steps[0].instruction).toContain("avocado oil");
  });
});

describe("kompakte deutsche Instagram-Caption ohne Zubereitungsüberschrift", () => {
  it("trennt Zutaten von Backofen-Hinweis und Hilfstext", () => {
    const r = parseRecipe(compactGermanCaption)!;
    expect(r.ingredients.map((ingredient) => ingredient.name)).toEqual(expect.arrayContaining([
      "„Eat lean“ Käse | Alternativ Gouda",
      "magere Schinkenwürfel",
      "Magerquark",
      "Mais",
      "rote Zwiebel",
      "Knoblauch",
      "Oregano",
      "Kaiserbrötchen ausgehöhlt",
      "Tomatenmark",
    ]));
    // Einheit hinter dem Namen wird als Einheit erkannt ("1 Knoblauch Zehe")
    expect(r.ingredients).toContainEqual(
      expect.objectContaining({ amount: 1, unit: "Zehe", name: "Knoblauch" }),
    );
    expect(r.ingredients).toHaveLength(9);
    expect(r.ingredients.some((ingredient) => /fertige masse|backofen/i.test(ingredient.name))).toBe(false);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].instruction).toContain("BACKOFEN: 200 Grad O/U-Hitze ~ 20min");
  });

  it("parst gefüllte Laugenstangen mit Prozentangaben, Zwischennotizen und Backanweisung sauber", () => {
    const captionLaugen = `ZUM REZEPT ⬇️
.
.
❤️🧡💛
Wenn euch meine Rezepte gefallen und ihr mich unterstützen wollt, 
dann könnt ihr gerne bei PROZIS den 
Rabattcode: ❗️👉🏼NOEL👈🏼❗️
benutzen um immer Rabatte und Gratis Produkte zu erhalten 
❤️🧡💛
*ANZElGE
.
.
.
🥗🍳🥑
Nährwerte (alle 10 Hälften zsm) 
1818kcal, 222g K, 145g E, 37g F
🥗🍳🥑
.
.
.
⚖️🔢⏳⏲️
Mengenangaben:
.
- 5x Laugenstangen -> jeweils 100g
Entweder aus der Backabteilung oder Tiefgekühlt, diese allerdings vorher im Backofen so lange backen, bis sie gerade so durch sind 
.
- 1 Packung (200g) Frischkäse 0,2% Fett
- 2 rohe Eier 
- 150g Schinkenwürfel, mager 
- 120g „Eat Lean“ Käse - erhältlich bei Kaufland 
 ( alternativ Gouda, leicht )
- 1/2 rote Zwiebel 
- 1 Frühlingszwiebel
.
- BACKOFEN: 200 Grad Umluft ~ 15-20min
.
⚖️🔢⏳⏲️
.
#highprotein #lecker #eiweiß #protein leckerschmecker essen mealprep eiweiss rezept`;

    const r = parseRecipe(captionLaugen)!;
    expect(r).toBeTruthy();
    expect(r.title).toBe("Laugenstangen");
    expect(r.ingredients).toHaveLength(7);
    expect(r.ingredients.map((i) => i.name)).toEqual(
      expect.arrayContaining([
        "Laugenstangen",
        "Frischkäse 0,2% Fett",
        "rohe Eier",
        "Schinkenwürfel",
        "„Eat Lean“ Käse - erhältlich bei Kaufland",
        "rote Zwiebel",
        "Frühlingszwiebel",
      ]),
    );

    const frischkaese = r.ingredients.find((i) => i.name.includes("Frischkäse"))!;
    expect(frischkaese.amount).toBe(1);
    expect(frischkaese.unit).toBe("Packung");
    expect(frischkaese.notes).toContain("200g");

    const laugenstangen = r.ingredients.find((i) => i.name === "Laugenstangen")!;
    expect(laugenstangen.amount).toBe(5);
    expect(laugenstangen.notes).toContain("jeweils 100g");

    expect(r.steps).toHaveLength(2);
    expect(r.steps[0].instruction).toContain("Backabteilung oder Tiefgekühlt");
    expect(r.steps[1].instruction).toContain("BACKOFEN: 200 Grad Umluft ~ 15-20min");
    expect(r.cookTime).toBe(20);
  });
});

describe("Instagram-Caption mit *-Bullets, Nährwertblock und Hautton-Emoji", () => {
  const captionOnePot = `🍅 Pesto Rosso Hähnchen Reis One Pot

30 Tage – 30 Rezepte | Abnehmen leichter gemacht 

👉 Folge mir für täglich einfache High Protein Rezepte zum Abnehmen & schicke es an jemanden der keine Lust hat zu kochen 😬

🛒 Zutaten

* 200 g Jasminreis
* 500 g Hähnchenbrustfilet
* 1 EL Pesto Rosso
* 400 ml Hühnerbrühe
* 200 g TK-Brokkoli
* 150 g Light Streukäse
* 300 g Cherrytomaten
* 1½ TL Knoblauch
* 1½ TL Tomatengewürz
* 1 TL geräuchertes Paprikapulver

📊 Nährwerte

Pro Portion (4 Portionen):

* 464 kcal
* 46 g Protein
* 47 g Kohlenhydrate
*  8,5 g Fett

👨🏻‍🍳 Zubereitung

Hähnchen und Brokkoli kleinschneiden.

Alle Zutaten bis auf den Käse zusammen in eine Auflaufform geben und gut miteinander vermengen.

Anschließend mit dem Light-Käse toppen und die Auflaufform mit Alufolie abdecken.

🔥 45 Minuten bei 190 °C in den vorgeheizten Ofen geben.

Danach die Alufolie entfernen und nochmal ca. 5 Minuten backen, bis der Käse schön goldbraun ist. 🧀🔥

Fertig! Einfache Zutaten, wenig Aufwand und richtig viel Protein. 💪🏻

#highprotein #abnehmen #rezept #diät 
#onepot muskelaufbau Fitness`;

  it("liest Zutaten trotz '* '-Bullets vollständig aus", () => {
    const r = parseRecipe(captionOnePot)!;
    expect(r.title).toBe("Pesto Rosso Hähnchen Reis One Pot");
    expect(r.servings).toBe(4);
    expect(r.ingredients).toHaveLength(10);
    expect(r.ingredients).toContainEqual(
      expect.objectContaining({ amount: 200, unit: "g", name: "Jasminreis" }),
    );
    expect(r.ingredients).toContainEqual(
      expect.objectContaining({ amount: 1, unit: "EL", name: "Pesto Rosso" }),
    );
    expect(r.ingredients).toContainEqual(
      expect.objectContaining({ amount: 1.5, unit: "TL", name: "Knoblauch" }),
    );
    // Nährwerte/Portionen dürfen nicht als Zutat enden
    expect(
      r.ingredients.some((i) => /kcal|protein|kohlenhydrate|fett|portion/i.test(i.name)),
    ).toBe(false);
  });

  it("erkennt die Zubereitung trotz Hautton-Emoji (👨🏻‍🍳)", () => {
    const r = parseRecipe(captionOnePot)!;
    expect(r.steps).toHaveLength(5);
    expect(r.steps[0].instruction).toBe("Hähnchen und Brokkoli kleinschneiden.");
    expect(r.steps[4].instruction).toContain("Alufolie entfernen");
    expect(r.steps.some((s) => /^fertig/i.test(s.instruction))).toBe(false);
  });
});

