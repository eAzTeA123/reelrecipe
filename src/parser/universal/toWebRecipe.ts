import type { Ingredient, RecipeStep } from "@/domain/types";
import type { ExtractionSource, ParseRecipeResult } from "./types";

export type WebRecipeStatus =
  | "success"
  | "login_required"
  | "paywall"
  | "blocked"
  | "not_a_recipe"
  | "fetch_error"
  | "invalid_url";

export interface WebRecipe {
  title: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  image?: string;
  description?: string;
  sourceUrl: string;
  confidence: number;
  highConfidence: boolean;
  fieldSources: Record<string, { source: ExtractionSource; confidence: number }>;
}

export interface WebRecipeResponse {
  status: WebRecipeStatus;
  recipe?: WebRecipe;
}

/** HTTP-Fehler beim Abruf in einen für Nutzer sinnvollen Status übersetzen */
export function statusFromFetchError(error?: string): WebRecipeStatus {
  const code = error?.match(/HTTP-Fehler (\d{3})/)?.[1];
  if (code === "401" || code === "402" || code === "403" || code === "429") return "blocked";
  if (code === "404" || code === "410") return "not_a_recipe";
  if (error && /Content-Type/i.test(error)) return "not_a_recipe";
  return "fetch_error";
}

/** SEO-/Werbetexte statt echter Beschreibung (z. B. "Über 56 Bewertungen … ► Portionsrechner") */
export function isSeoBoilerplate(text: string): boolean {
  return (
    /[►▶▸]/.test(text) ||
    /\b\d+\s+(bewertungen|ratings|reviews)\b/i.test(text) ||
    /jetzt\s+(entdecken|ausprobieren)|click here|mehr erfahren/i.test(text)
  );
}

/** Übersetzt das Ergebnis von parse_recipe in das Import-Format der App */
export function toWebRecipeResponse(result: ParseRecipeResult, requestedUrl: string): WebRecipeResponse {
  if (result.status === "fetch_error") return { status: statusFromFetchError(result.error) };
  if (result.status !== "success" || !result.recipe) return { status: result.status };

  const r = result.recipe;
  if (r.structuredIngredients.length === 0 && r.structuredSteps.length === 0) {
    return { status: "not_a_recipe" };
  }
  const { prep, cook, total } = r.zeiten.value;
  const cookTime = cook ?? (total !== undefined ? (prep !== undefined && total > prep ? total - prep : total) : undefined);

  return {
    status: "success",
    recipe: {
      title: r.titel.value,
      ingredients: r.structuredIngredients,
      steps: r.structuredSteps,
      servings: r.portionen.value,
      prepTime: prep,
      cookTime,
      image: r.bild.value,
      description: r.sonstiges.value.find((d) => d.trim() && !isSeoBoilerplate(d)),
      sourceUrl: r.sourceUrl ?? requestedUrl,
      confidence: r.overallConfidence,
      highConfidence: r.isHighConfidence,
      fieldSources: Object.fromEntries(
        (["titel", "zutaten", "zubereitung", "bild", "zeiten", "portionen"] as const).map((k) => [
          k,
          { source: r[k].source, confidence: r[k].confidence },
        ]),
      ),
    },
  };
}
