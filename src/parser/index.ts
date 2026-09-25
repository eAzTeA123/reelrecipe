import type { ParsedRecipe } from "@/domain/types";
import { splitLines } from "./normalize";
import {
  parseIngredientLine,
  toIngredient,
  expandIngredientLine,
} from "./ingredient";
import { makeSteps } from "./steps";
import { parseServings, parseTimes, pickTitle } from "./meta";
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

export function parseRecipe(caption: string): ParsedRecipe | null {
  const lines = splitLines(caption);
  if (lines.length === 0) return null;

  // Nutze die Hybrid-Ensemble-Pipeline
  const raw = ensembleStrategy.parse(caption);

  const ingredients = raw.ingredients
    .flatMap(expandIngredientLine)
    .map(parseIngredientLine)
    .filter((i): i is NonNullable<typeof i> => i !== null)
    .map(toIngredient);

  const steps = makeSteps(raw.steps);

  if (ingredients.length === 0 && steps.length === 0) {
    return null;
  }

  const meta = parseTimes(lines);
  const rawTitle =
    raw.title && raw.title.length > 2
      ? raw.title
      : pickTitle(lines, () => false) ?? "Neues Rezept";

  const title = rawTitle
    .replace(/(?:[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+|\s)+$/u, "")
    .trim();

  return {
    title: title || "Neues Rezept",
    servings: parseServings(lines),
    prepTime: meta.prepTime,
    cookTime: meta.cookTime,
    ingredients,
    steps,
  };
}
