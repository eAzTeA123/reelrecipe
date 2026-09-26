import Dexie, { type Table } from "dexie";
import type { LocalImage, Recipe, ShoppingItem, MealPlanEntry } from "@/domain/types";

interface SettingRow {
  key: string;
  value: unknown;
}

export class RecipeDB extends Dexie {
  recipes!: Table<Recipe, string>;
  images!: Table<LocalImage, string>;
  shopping!: Table<ShoppingItem, string>;
  settings!: Table<SettingRow, string>;
  mealPlan!: Table<MealPlanEntry, string>;

  constructor() {
    super("rezept");
    this.version(1).stores({
      recipes: "id, title, category, favorite, createdAt",
      images: "id",
      shopping: "id, checked, createdAt",
      settings: "key",
    });

    this.version(2).stores({
      recipes: "id, title, category, favorite, createdAt, *tags",
      mealPlan: "id, dayOfWeek, recipeId",
    }).upgrade(tx => {
      return tx.table("recipes").toCollection().modify(recipe => {
        if (!recipe.tags) recipe.tags = [];
      });
    });
    this.version(3).stores({
      recipes: "id, title, category, favorite, createdAt, *tags, sourceUrl",
    }).upgrade(tx => {
      return tx.table("recipes").toCollection().modify(recipe => {
        if (recipe.parserVersion === undefined) {
          recipe.parserVersion = 0; // Markiert als "vor dem neuen Parser"
        }
      });
    });
  }
}

let dbInstance: RecipeDB | undefined;

export function getDB(): RecipeDB {
  if (!dbInstance) dbInstance = new RecipeDB();
  return dbInstance;
}
