export interface Ingredient {
  id: string;
  amount?: number;
  unit?: string;
  name: string;
  notes?: string;
  /** true, wenn der Parser die Zeile nicht eindeutig zuordnen konnte */
  uncertain?: boolean;
}

export interface RecipeStep {
  id: string;
  order: number;
  instruction: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  /** Bild-Referenz: "local-image:<id>" (Blob in IndexedDB) oder externe URL */
  image?: string;
  sourceUrl?: string;
  /** Originale Caption, aus der das Rezept erkannt wurde */
  sourceCaption?: string;
  servings?: number;
  /** Vorbereitungszeit in Minuten */
  prepTime?: number;
  /** Koch-/Backzeit in Minuten */
  cookTime?: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  category?: string;
  tags?: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  /** Version des Parsers, mit der dieses Rezept zuletzt geparst wurde */
  parserVersion?: number;
}

export type RecipeInput = Omit<Recipe, "id" | "createdAt" | "updatedAt">;

export type DayOfWeek = "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su";

export interface MealPlanEntry {
  id: string;
  dayOfWeek: DayOfWeek;
  recipeId: string;
  servings: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount?: number;
  unit?: string;
  checked: boolean;
  /** Rezepte, aus denen die Zutat stammt */
  recipeIds: string[];
  createdAt: number;
}

export interface LocalImage {
  id: string;
  blob: Blob;
  mime: string;
  createdAt: number;
}

export interface BackupImage {
  id: string;
  mime: string;
  dataBase64: string;
}

export interface BackupFile {
  app: "rezept";
  version: 1;
  exportedAt: number;
  recipes: Recipe[];
  images: BackupImage[];
  shopping: ShoppingItem[];
}

export interface ParsedRecipe {
  title: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  tags?: string[];
}
