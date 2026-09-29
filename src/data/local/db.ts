import Dexie, { type Table } from "dexie";
import type {
  LocalImage,
  Recipe,
  ShoppingItem,
  MealPlanEntry,
  AisleCheckEvent,
  ParserCorrection,
} from "@/domain/types";

interface SettingRow {
  key: string;
  value: unknown;
}

export interface DraftRow {
  id: string;
  recipe: any;
  imageBlob?: Blob;
}

export class RecipeDB extends Dexie {
  recipes!: Table<Recipe, string>;
  images!: Table<LocalImage, string>;
  shopping!: Table<ShoppingItem, string>;
  settings!: Table<SettingRow, string>;
  mealPlan!: Table<MealPlanEntry, string>;
  drafts!: Table<DraftRow, string>;
  aisleOrder!: Table<AisleCheckEvent, string>;
  corrections!: Table<ParserCorrection, string>;

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
    this.version(4).stores({
      drafts: "id",
    });
    this.version(5).stores({
      aisleOrder: "id, aisle, timestamp",
    });

    // Lokales Parser-Korrektur-Log (nur für die Parser-Verbesserung, bleibt im Browser)
    this.version(6).stores({
      corrections: "id, createdAt",
    });
  }
}

let dbInstance: RecipeDB | undefined;

export function getDB(): RecipeDB {
  if (!dbInstance) dbInstance = new RecipeDB();
  return dbInstance;
}
