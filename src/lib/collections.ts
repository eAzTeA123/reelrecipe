import type { Collection, CollectionFilter, Recipe } from "@/domain/types";
import { matchesTags } from "./tags";
import { normalizeForSearch } from "./text";

function hasText(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

/** Gesamtzeit eines Rezepts in Minuten (0 = unbekannt). */
export function totalTime(recipe: Recipe): number {
  return (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
}

/** true, wenn die Sammlung gar keine Filterregel gesetzt hat. */
export function isCollectionFilterEmpty(filter: CollectionFilter | undefined): boolean {
  if (!filter) return true;
  return (
    !filter.category &&
    !(filter.categories && filter.categories.length > 0) &&
    !(filter.tags && filter.tags.length > 0) &&
    filter.maxTotalTime === undefined &&
    !filter.favoritesOnly &&
    !hasText(filter.titleContains) &&
    !hasText(filter.ingredientContains) &&
    !hasText(filter.query)
  );
}

/**
 * Prüft ein Rezept gegen die gesetzten Regeln (UND). Leere Regeln werden
 * übersprungen, eine leere Sammlung passt damit zu nichts – das entscheidet
 * der Aufrufer über `isCollectionFilterEmpty`.
 */
export function matchesCollectionFilter(
  filter: CollectionFilter | undefined,
  recipe: Recipe,
): boolean {
  const f = filter ?? {};

  const categories = [...(f.categories ?? []), ...(f.category ? [f.category] : [])];
  if (categories.length > 0) {
    const own = (recipe.category ?? "").toLowerCase();
    if (!categories.some((entry) => entry.toLowerCase() === own)) return false;
  }

  if (f.tags && f.tags.length > 0 && !matchesTags(recipe, f.tags)) return false;

  if (f.favoritesOnly && !recipe.favorite) return false;

  if (f.maxTotalTime !== undefined) {
    const total = totalTime(recipe);
    if (total <= 0 || total > f.maxTotalTime) return false;
  }

  const titleContains = normalizeForSearch(f.titleContains ?? "");
  if (titleContains && !normalizeForSearch(recipe.title).includes(titleContains)) return false;

  const ingredientContains = normalizeForSearch(f.ingredientContains ?? "");
  if (
    ingredientContains &&
    !recipe.ingredients.some((entry) => normalizeForSearch(entry.name).includes(ingredientContains))
  ) {
    return false;
  }

  const legacyQuery = normalizeForSearch(f.query ?? "");
  if (legacyQuery) {
    const hit =
      normalizeForSearch(recipe.title).includes(legacyQuery) ||
      recipe.ingredients.some((entry) => normalizeForSearch(entry.name).includes(legacyQuery));
    if (!hit) return false;
  }

  return true;
}

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
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const result: Recipe[] = [];
  const seen = new Set<string>();

  if (!isCollectionFilterEmpty(collection.filter)) {
    for (const recipe of recipes) {
      if (!matchesCollectionFilter(collection.filter, recipe)) continue;
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
