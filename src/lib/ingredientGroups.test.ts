import { describe, expect, it } from "vitest";
import type { Ingredient } from "@/domain/types";
import { groupIngredients } from "./ingredientGroups";

function ing(name: string, group?: string): Ingredient {
  return { id: name, name, group };
}

describe("groupIngredients", () => {
  it("fasst aufeinanderfolgende Zutaten derselben Gruppe zusammen", () => {
    const groups = groupIngredients([ing("Mehl", "Teig"), ing("Butter", "Teig"), ing("Sahne", "Guss")]);
    expect(groups.map((entry) => entry.group)).toEqual(["Teig", "Guss"]);
    expect(groups[0].items.map((item) => item.name)).toEqual(["Mehl", "Butter"]);
  });

  it("trennt eine Gruppe, die später erneut auftaucht", () => {
    const groups = groupIngredients([ing("Butter", "Teig"), ing("Zucker", "Füllung"), ing("Butter", "Teig")]);
    expect(groups.map((entry) => entry.group)).toEqual(["Teig", "Füllung", "Teig"]);
  });

  it("lässt Rezepte ohne Gruppen unverändert (eine Gruppe ohne Namen)", () => {
    const groups = groupIngredients([ing("Mehl"), ing("Butter")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].group).toBeUndefined();
    expect(groups[0].items).toHaveLength(2);
  });
});
