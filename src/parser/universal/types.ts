import type { Ingredient, RecipeStep } from "@/domain/types";

export type ExtractionSource = "site-scraper" | "schema" | "heuristik";

export interface FieldWithMetadata<T> {
  value: T;
  source: ExtractionSource;
  confidence: number; // 0.0 - 1.0
}

export interface RecipeTimes {
  prep?: number;
  cook?: number;
  total?: number;
}

/**
 * Universal recipe schema matching specification section 2:
 * {
 *   titel,
 *   zutaten[],
 *   zubereitung[],
 *   sonstiges[],
 *   bild,
 *   zeiten,
 *   portionen
 * }
 * where each field is a FieldWithMetadata<T>.
 */
export interface UniversalRecipeExtraction {
  titel: FieldWithMetadata<string>;
  zutaten: FieldWithMetadata<string[]>;
  zubereitung: FieldWithMetadata<string[]>;
  sonstiges: FieldWithMetadata<string[]>;
  bild: FieldWithMetadata<string | undefined>;
  zeiten: FieldWithMetadata<RecipeTimes>;
  portionen: FieldWithMetadata<number | undefined>;

  /** Structured representations compatible with existing project model */
  structuredIngredients: Ingredient[];
  structuredSteps: RecipeStep[];

  /** Overall confidence and validation status */
  overallConfidence: number;
  isHighConfidence: boolean;
  sourceUrl?: string;
}

export type ParseRecipeStatus =
  | "success"
  | "login_required"
  | "paywall"
  | "blocked"
  | "not_a_recipe"
  | "fetch_error";

export interface ParseRecipeResult {
  status: ParseRecipeStatus;
  recipe?: UniversalRecipeExtraction;
  error?: string;
  trace?: string[];
}

export type InputType = "url" | "html" | "caption";
