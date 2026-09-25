import type {
  ImageRepository,
  RecipeRepository,
  ShoppingListRepository,
} from "./repositories";
import { LocalRecipeRepository } from "./local/LocalRecipeRepository";
import { LocalShoppingListRepository } from "./local/LocalShoppingListRepository";
import { LocalImageRepository } from "./local/LocalImageRepository";

/**
 * Einziger Ort, an dem die konkrete Datenquelle gewählt wird.
 * Für Supabase später: neue Implementierung der Interfaces in
 * `data/supabase/*` und hier die Factory umschalten. Die UI bleibt unverändert.
 */

let recipeRepo: RecipeRepository | undefined;
let shoppingRepo: ShoppingListRepository | undefined;
let imageRepo: ImageRepository | undefined;

export function getRecipeRepository(): RecipeRepository {
  if (!recipeRepo) recipeRepo = new LocalRecipeRepository();
  return recipeRepo;
}

export function getShoppingListRepository(): ShoppingListRepository {
  if (!shoppingRepo) shoppingRepo = new LocalShoppingListRepository();
  return shoppingRepo;
}

export function getImageRepository(): ImageRepository {
  if (!imageRepo) imageRepo = new LocalImageRepository();
  return imageRepo;
}

export type { ImageRepository, RecipeRepository, SearchFilter, ShoppingListRepository } from "./repositories";
