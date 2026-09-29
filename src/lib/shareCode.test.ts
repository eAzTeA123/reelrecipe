import { describe, expect, it } from "vitest";
import type { Recipe, ShoppingItem } from "@/domain/types";
import {
  MAX_SHARE_CODE_LENGTH,
  decodeShareCode,
  encodeShareCode,
  extractShareCode,
  looksLikeShareCode,
  recipeToSharePayload,
  shoppingToSharePayload,
  shoppingToText,
} from "./shareCode";

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "r1",
    title: "Pesto Rosso Hähnchen Reis One Pot",
    description: "Schnell und proteinreich",
    servings: 4,
    prepTime: 10,
    cookTime: 25,
    color: "#f97316",
    category: "One Pot",
    tags: ["high-protein", "one-pot"],
    sourceUrl: "https://www.instagram.com/reel/Dc0eafRIVrF/",
    ingredients: [
      { id: "i1", name: "Jasminreis", amount: 200, unit: "g" },
      { id: "i2", name: "Hähnchenbrustfilet", amount: 500, unit: "g" },
      { id: "i3", name: "Knoblauch", amount: 1.5, unit: "TL", notes: "frisch gepresst" },
    ],
    steps: [
      { id: "s1", order: 1, instruction: "Hähnchen und Brokkoli kleinschneiden." },
      { id: "s2", order: 2, instruction: "Alles in eine Auflaufform geben." },
      { id: "s3", order: 3, instruction: "45 Minuten bei 190 °C backen." },
    ],
    favorite: true,
    createdAt: 1,
    updatedAt: 2,
    parserVersion: 14,
    parseSnapshot: { title: "Pesto Rosso", ingredients: [{ name: "Jasminreis" }], steps: ["Alles verrühren."] },
    ...overrides,
  };
}

function shoppingItems(): ShoppingItem[] {
  return [
    { id: "s1", name: "Milch", amount: 1, unit: "l", checked: false, recipeIds: ["r1"], createdAt: 1 },
    { id: "s2", name: "Brot", checked: true, recipeIds: [], createdAt: 2 },
  ];
}

describe("shareCode: Rezept", () => {
  it("überlebt den Rundlauf mit allen weitergegebenen Feldern", async () => {
    const code = await encodeShareCode(recipeToSharePayload(recipe()));
    const decoded = await decodeShareCode(code);

    expect(decoded.kind).toBe("recipe");
    if (decoded.kind !== "recipe") return;
    expect(decoded.recipe.title).toBe("Pesto Rosso Hähnchen Reis One Pot");
    expect(decoded.recipe.description).toBe("Schnell und proteinreich");
    expect(decoded.recipe.servings).toBe(4);
    expect(decoded.recipe.prepTime).toBe(10);
    expect(decoded.recipe.cookTime).toBe(25);
    expect(decoded.recipe.color).toBe("#f97316");
    expect(decoded.recipe.category).toBe("One Pot");
    expect(decoded.recipe.tags).toEqual(["high-protein", "one-pot"]);
    expect(decoded.recipe.sourceUrl).toContain("instagram.com");
    expect(decoded.recipe.ingredients).toHaveLength(3);
    expect(decoded.recipe.ingredients[2]).toEqual({ name: "Knoblauch", amount: 1.5, unit: "TL", notes: "frisch gepresst" });
    expect(decoded.recipe.steps).toEqual([
      "Hähnchen und Brokkoli kleinschneiden.",
      "Alles in eine Auflaufform geben.",
      "45 Minuten bei 190 °C backen.",
    ]);
  });

  it("gibt keine gerätelokalen Felder weiter", async () => {
    const payload = recipeToSharePayload(recipe());
    const json = JSON.stringify(payload);
    expect(json).not.toContain("parseSnapshot");
    expect(json).not.toContain("parserVersion");
    expect(json).not.toContain("favorite");
    expect(json).not.toContain("i1"); // Zutaten-IDs bleiben lokal
  });

  it("hält einen typischen Code kurz genug", async () => {
    const code = await encodeShareCode(recipeToSharePayload(recipe()));
    expect(code.length).toBeLessThan(1500);
    expect(code.length).toBeLessThan(MAX_SHARE_CODE_LENGTH);
    expect(code.startsWith("S2C1:")).toBe(true);
  });

  it("sortiert Schritte nach Reihenfolge", async () => {
    const shuffled = recipe({
      steps: [
        { id: "b", order: 2, instruction: "Zweiter Schritt" },
        { id: "a", order: 1, instruction: "Erster Schritt" },
      ],
    });
    const decoded = await decodeShareCode(await encodeShareCode(recipeToSharePayload(shuffled)));
    if (decoded.kind !== "recipe") throw new Error("falscher Typ");
    expect(decoded.recipe.steps).toEqual(["Erster Schritt", "Zweiter Schritt"]);
  });
});

describe("shareCode: Einkaufsliste", () => {
  it("überlebt den Rundlauf", async () => {
    const code = await encodeShareCode(shoppingToSharePayload(shoppingItems()));
    const decoded = await decodeShareCode(code);
    expect(decoded.kind).toBe("shopping");
    if (decoded.kind !== "shopping") return;
    expect(decoded.items).toEqual([
      { name: "Milch", amount: 1, unit: "l" },
      { name: "Brot", amount: undefined, unit: undefined },
    ]);
  });

  it("überträgt den Abgehakt-Zustand nicht und lässt ihn beim Text weg", () => {
    const payload = shoppingToSharePayload(shoppingItems());
    expect(JSON.stringify(payload)).not.toContain("checked");
    expect(shoppingToText(shoppingItems())).toBe("1 l Milch");
  });
});

describe("shareCode: Erkennung und Fehlerfälle", () => {
  it("erkennt nur echte Codes", async () => {
    const code = await encodeShareCode(shoppingToSharePayload(shoppingItems()));
    expect(looksLikeShareCode(code)).toBe(true);
    expect(looksLikeShareCode(`Schau mal: ${code}`)).toBe(false);
    expect(extractShareCode(`Schau mal: ${code}`)).toBe(code);
    expect(looksLikeShareCode("https://www.instagram.com/reel/abc/")).toBe(false);
    expect(looksLikeShareCode("Zutaten: 200 g Reis")).toBe(false);
  });

  it("meldet unbrauchbare Codes verständlich", async () => {
    await expect(decodeShareCode("irgendein Text")).rejects.toThrow("kein Scroll2Cook-Code");
    await expect(decodeShareCode("S2C1:c:r")).rejects.toThrow("kein Scroll2Cook-Code");
    await expect(decodeShareCode("S2C1:p:r:AABB")).rejects.toThrow("neueren Version");
    await expect(decodeShareCode("S2C1:c:x:AABB")).rejects.toThrow("beschädigt");
    await expect(decodeShareCode("S2C1:c:r:!!!nicht-base64!!!")).rejects.toThrow("beschädigt");
  });

  it("liest auch den unkomprimierten Modus (Fallback ohne CompressionStream)", async () => {
    const json = JSON.stringify({ items: [{ name: "Mehl", amount: 1, unit: "kg" }] });
    const base64 = Buffer.from(json, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const decoded = await decodeShareCode(`S2C1:u:l:${base64}`);
    expect(decoded.kind).toBe("shopping");
    if (decoded.kind !== "shopping") return;
    expect(decoded.items[0]).toEqual({ name: "Mehl", amount: 1, unit: "kg" });
  });

  it("verlangt ein vollständiges Rezept", async () => {
    const json = JSON.stringify({ recipe: { title: "Nur ein Titel", ingredients: [] } });
    const base64 = Buffer.from(json, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await expect(decodeShareCode(`S2C1:u:r:${base64}`)).rejects.toThrow("kein vollständiges Rezept");
  });

  it("bricht ab, wenn der Inhalt zu groß für einen Code ist", async () => {
    // Schwer komprimierbarer Inhalt (repetitive Texte schrumpfen zu stark)
    const noise = (i: number) => `${i * 7919}${Math.sin(i).toString(36)}${Math.cos(i * 3).toString(36)}`.repeat(6);
    const huge = recipe({
      steps: Array.from({ length: 500 }, (_, i) => ({
        id: `s${i}`,
        order: i + 1,
        instruction: `Schritt ${i}: ${noise(i)}`,
      })),
    });
    await expect(encodeShareCode(recipeToSharePayload(huge))).rejects.toThrow("zu groß");
  });
});
