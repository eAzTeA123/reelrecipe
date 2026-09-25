import Dexie, { type Table } from "dexie";
import type { LocalImage, Recipe, ShoppingItem } from "@/domain/types";

interface SettingRow {
  key: string;
  value: unknown;
}

export class RecipeDB extends Dexie {
  recipes!: Table<Recipe, string>;
  images!: Table<LocalImage, string>;
  shopping!: Table<ShoppingItem, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super("rezept");
    this.version(1).stores({
      recipes: "id, title, category, favorite, createdAt",
      images: "id",
      shopping: "id, checked, createdAt",
      settings: "key",
    });
  }
}

let dbInstance: RecipeDB | undefined;

export function getDB(): RecipeDB {
  if (!dbInstance) dbInstance = new RecipeDB();
  return dbInstance;
}
