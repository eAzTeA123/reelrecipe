import type {
  ImageRepository,
  RecipeRepository,
  ShoppingListRepository,
  MealPlanRepository,
} from "./repositories";
import { LocalRecipeRepository } from "./local/LocalRecipeRepository";
import { LocalShoppingListRepository } from "./local/LocalShoppingListRepository";
import { LocalImageRepository } from "./local/LocalImageRepository";
import { LocalMealPlanRepository } from "./local/LocalMealPlanRepository";

/**
 * Einziger Ort, an dem die konkrete Datenquelle gewählt wird.
 * Für Supabase später: neue Implementierung der Interfaces in
 * `data/supabase/*` und hier die Factory umschalten. Die UI bleibt unverändert.
 */

let recipeRepo: RecipeRepository | undefined;
let shoppingRepo: ShoppingListRepository | undefined;
let imageRepo: ImageRepository | undefined;
let mealPlanRepo: MealPlanRepository | undefined;

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

export function getMealPlanRepository(): MealPlanRepository {
  if (!mealPlanRepo) mealPlanRepo = new LocalMealPlanRepository();
  return mealPlanRepo;
}

export type { ImageRepository, RecipeRepository, SearchFilter, ShoppingListRepository, MealPlanRepository } from "./repositories";
