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
      "Knoblauch Zehe",
      "Oregano",
      "Kaiserbrötchen ausgehöhlt",
      "Tomatenmark",
    ]));
    expect(r.ingredients).toHaveLength(9);
    expect(r.ingredients.some((ingredient) => /fertige masse|backofen/i.test(ingredient.name))).toBe(false);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].instruction).toContain("BACKOFEN: 200 Grad O/U-Hitze ~ 20min");
  });
});
