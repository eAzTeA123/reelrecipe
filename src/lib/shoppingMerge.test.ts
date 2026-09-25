import { describe, expect, it } from "vitest";
import type { ShoppingItem } from "@/domain/types";
import { mergeIntoList, normalizeAmount } from "./shoppingMerge";

function item(partial: Partial<ShoppingItem> & Pick<ShoppingItem, "name">): ShoppingItem {
  return {
    id: partial.id ?? "existing",
    amount: partial.amount,
    unit: partial.unit,
    checked: partial.checked ?? false,
    recipeIds: partial.recipeIds ?? ["r1"],
    createdAt: partial.createdAt ?? 1,
    name: partial.name,
  };
}

describe("normalizeAmount", () => {
  it("normalisiert kompatible Masse und Volumen", () => {
    expect(normalizeAmount(1, "kg")).toEqual({ amount: 1000, unit: "g" });
    expect(normalizeAmount(1.5, "l")).toEqual({ amount: 1500, unit: "ml" });
  });
});

describe("mergeIntoList", () => {
  it("addiert gleiche und kompatible Einheiten", () => {
    const result = mergeIntoList(
      [item({ name: "Hähnchenbrust", amount: 500, unit: "g" })],
      { name: "Hähnchenbrust", amount: 0.25, unit: "kg" },
      "r2",
    );
    expect(result.update).toMatchObject({ amount: 750, unit: "g", recipeIds: ["r1", "r2"] });
  });

  it("addiert EL und TL nicht ohne Umrechnung", () => {
    const result = mergeIntoList(
      [item({ name: "Olivenöl", amount: 1, unit: "EL" })],
      { name: "Olivenöl", amount: 1, unit: "TL" },
      "r2",
    );
    expect(result.update).toBeUndefined();
    expect(result.create).toMatchObject({ amount: 1, unit: "TL" });
  });

  it("lässt inkompatible Einheiten getrennt", () => {
    const result = mergeIntoList(
      [item({ name: "Parmesan", amount: 50, unit: "g" })],
      { name: "Parmesan", amount: 1, unit: "Stück" },
      "r2",
    );
    expect(result.create).toMatchObject({ amount: 1, unit: "Stück" });
  });

  it("verhindert falsche 500 kg wenn bestehendes Item unbekannte Menge hat (A01)", () => {
    const result = mergeIntoList(
      [item({ name: "Mehl", amount: undefined, unit: "kg" })],
      { name: "Mehl", amount: 500, unit: "g" },
      "r2",
    );
    // Soll nicht zu 500 kg mutieren, sondern separat erstellt werden
    expect(result.update).toBeUndefined();
    expect(result.create).toMatchObject({ amount: 500, unit: "g" });
  });

  it("führt Synonym-Einheiten wie tbsp und EL zusammen", () => {
    const result = mergeIntoList(
      [item({ name: "Olivenöl", amount: 1, unit: "EL" })],
      { name: "Olivenöl", amount: 1, unit: "tbsp" },
      "r2",
    );
    expect(result.update).toMatchObject({ amount: 2, unit: "EL" });
  });
});
