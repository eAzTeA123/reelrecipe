import type { Collection, Recipe } from "@/domain/types";
import { matchesTags } from "./tags";

/**
 * Welche Rezepte gehören in eine Sammlung?
 *
 * Eine Sammlung kann dynamisch sein (`filter`), statisch (`recipeIds`) oder
 * beides – dann gilt die Vereinigung. Mitglieder, die es nicht mehr gibt,
 * fallen still heraus, ohne dass eine Aufräum-Migration nötig wäre.
 */
export function resolveCollectionRecipes(
  collection: Pick<Collection, "filter" | "recipeIds">,
  recipes: Recipe[],
): Recipe[] {
  const filter = collection.filter ?? {};
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const result: Recipe[] = [];
  const seen = new Set<string>();

  const hasFilter = Boolean(
    (filter.tags && filter.tags.length > 0) || filter.category || (filter.query && filter.query.trim()),
  );

  if (hasFilter) {
    const query = filter.query?.trim().toLowerCase();
    for (const recipe of recipes) {
      if (filter.category && recipe.category !== filter.category) continue;
      if (filter.tags && filter.tags.length > 0 && !matchesTags(recipe, filter.tags)) continue;
      if (query && !recipe.title.toLowerCase().includes(query)) continue;
      if (seen.has(recipe.id)) continue;
      seen.add(recipe.id);
      result.push(recipe);
    }
  }

  for (const id of collection.recipeIds ?? []) {
    const recipe = byId.get(id);
    if (!recipe || seen.has(id)) continue;
    seen.add(id);
    result.push(recipe);
  }

  return result;
}
