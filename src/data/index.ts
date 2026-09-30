import type {
  ImageRepository,
  RecipeRepository,
  ShoppingListRepository,
  MealPlanRepository,
  CorrectionRepository,
  AisleOrderRepository,
  CollectionRepository,
} from "./repositories";
import { LocalRecipeRepository } from "./local/LocalRecipeRepository";
import { LocalShoppingListRepository } from "./local/LocalShoppingListRepository";
import { LocalImageRepository } from "./local/LocalImageRepository";
import { LocalMealPlanRepository } from "./local/LocalMealPlanRepository";
import { LocalCorrectionRepository } from "./local/LocalCorrectionRepository";
import { LocalAisleOrderRepository } from "./local/LocalAisleOrderRepository";
import { LocalCollectionRepository } from "./local/LocalCollectionRepository";

/**
 * Einziger Ort, an dem die konkrete Datenquelle gewählt wird.
 * Für Supabase später: neue Implementierung der Interfaces in
 * `data/supabase/*` und hier die Factory umschalten. Die UI bleibt unverändert.
 */

let recipeRepo: RecipeRepository | undefined;
let shoppingRepo: ShoppingListRepository | undefined;
let imageRepo: ImageRepository | undefined;
let mealPlanRepo: MealPlanRepository | undefined;
let correctionRepo: CorrectionRepository | undefined;
let aisleOrderRepo: AisleOrderRepository | undefined;
let collectionRepo: CollectionRepository | undefined;

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

export function getCorrectionRepository(): CorrectionRepository {
  if (!correctionRepo) correctionRepo = new LocalCorrectionRepository();
  return correctionRepo;
}

/** Gelernte Abteilungs-Reihenfolge der Einkaufsliste (localStorage-frei, Dexie). */
export function getAisleOrderRepository(): AisleOrderRepository {
  if (!aisleOrderRepo) aisleOrderRepo = new LocalAisleOrderRepository();
  return aisleOrderRepo;
}

/** Sammlungen (Ordner) für Rezepte. */
export function getCollectionRepository(): CollectionRepository {
  if (!collectionRepo) collectionRepo = new LocalCollectionRepository();
  return collectionRepo;
}

export type { ImageRepository, RecipeRepository, SearchFilter, ShoppingListRepository, MealPlanRepository, CorrectionRepository, AisleOrderRepository, CollectionRepository } from "./repositories";
export { getDB } from './local/db';
