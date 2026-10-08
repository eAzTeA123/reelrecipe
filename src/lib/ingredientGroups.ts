import type { Ingredient } from "@/domain/types";

export interface IngredientGroup {
  /** Gruppenname aus der Caption, `undefined` für Zutaten ohne Gruppe */
  group?: string;
  items: Ingredient[];
}

/**
 * Zutaten in ihre Gruppen zerlegen – **in Reihenfolge**.
 *
 * Nur aufeinanderfolgende Zutaten derselben Gruppe kommen zusammen; taucht eine
 * Gruppe später erneut auf (zwei Füllungen in einem Rezept), bleibt die Trennung
 * erhalten. Zutaten ohne Gruppe bilden eine eigene Gruppe ohne Überschrift – so
 * funktionieren alte Rezepte unverändert.
 */
export function groupIngredients(ingredients: Ingredient[]): IngredientGroup[] {
  const groups: IngredientGroup[] = [];
  for (const ingredient of ingredients) {
    const last = groups[groups.length - 1];
    if (last && last.group === ingredient.group) {
      last.items.push(ingredient);
      continue;
    }
    groups.push({ group: ingredient.group, items: [ingredient] });
  }
  return groups;
}
