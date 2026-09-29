import type { ParsedRecipe } from "@/domain/types";
import { splitLines } from "./normalize";
import {
  parseIngredientLine,
  toIngredient,
  expandIngredientLine,
  stripMultiplierHeaders,
} from "./ingredient";
import { makeSteps } from "./steps";
import { deriveIngredientsFromSteps } from "./deriveIngredients";
import { parseServings, parseTimes, pickTitle, cleanTitle, isPlausibleTitle, extractTitleFromHeadline } from "./meta";
import { ensembleStrategy, ALL_STRATEGIES } from "./strategies/ensemble";
import { markerBasedStrategy } from "./strategies/markerBased";
import { lineStateMachineStrategy } from "./strategies/lineStateMachine";
import { sentenceStateMachineStrategy } from "./strategies/sentenceStateMachine";

export { splitLines } from "./normalize";
export { parseIngredientLine } from "./ingredient";
export { parseAmountString } from "./quantity";
export { UNIT_LABELS, canonicalUnit } from "./units";
export {
  ensembleStrategy,
  markerBasedStrategy,
  lineStateMachineStrategy,
  sentenceStateMachineStrategy,
  ALL_STRATEGIES,
};

/** Inkrement bei jeder wesentlichen Parser-Änderung */
export const PARSER_VERSION = 14;

import { isSectionHeader as isSectionHeaderLine } from "./lineFacts";

function isSectionHeader(l: string): boolean {
  return isSectionHeaderLine(l);
}

export function parseRecipe(caption: string): ParsedRecipe | null {
  const lines = splitLines(caption);
  if (lines.length === 0) return null;

  // Nutze die Hybrid-Ensemble-Pipeline
  const raw = ensembleStrategy.parse(caption);

  const ingredients = stripMultiplierHeaders(raw.ingredients)
    .flatMap(expandIngredientLine)
    .map(parseIngredientLine)
    .filter((i): i is NonNullable<typeof i> => i !== null)
    .map(toIngredient);

  const steps = makeSteps(raw.steps);

  if (ingredients.length === 0 && steps.length === 0) {
    return null;
  }

  // Zutaten, die nur in der Anleitung genannt sind, ergänzen (Einkaufsliste!)
  ingredients.push(
    ...deriveIngredientsFromSteps(
      steps.map((s) => s.instruction),
      ingredients,
    ),
  );

  const meta = parseTimes(lines);
  let title =
    raw.title && !isSectionHeader(raw.title) && isPlausibleTitle(raw.title)
      ? cleanTitle(raw.title)
      : "";

  if (!title || title.length < 3) {
    const picked = pickTitle(lines, isSectionHeader);
    title = picked ? cleanTitle(picked) : "";
  }

  // Marketing-Headlines als letzte Chance vor dem Zutaten-Fallback
  if (!title || title.length < 3) {
    for (const line of lines.slice(0, 3)) {
      const derived = extractTitleFromHeadline(line);
      if (derived) {
        title = derived;
        break;
      }
    }
  }

  if (!title || title.length < 3) {
    if (ingredients.length > 0 && ingredients[0].name.length >= 3) {
      title = ingredients[0].name.replace(/\s*\(.*?\)/g, "").trim();
    }
  }

  title = title || "Neues Rezept";

  return {
    title: title || "Neues Rezept",
    servings: parseServings(lines),
    prepTime: meta.prepTime,
    cookTime: meta.cookTime,
    ingredients,
    steps,
  };
}









