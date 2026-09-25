import type { ParsedRecipe } from "@/domain/types";
import { splitLines } from "./normalize";
import { detectSection, type Section } from "./sections";
import {
  parseIngredientLine,
  looksLikeIngredient,
  toIngredient,
  expandIngredientLine,
} from "./ingredient";
import { makeSteps, looksLikeStep, lineLooksLikeStep } from "./steps";
import { parseServings, parseTimes, pickTitle } from "./meta";

export { splitLines } from "./normalize";
export { parseIngredientLine } from "./ingredient";
export { parseAmountString } from "./quantity";
export { UNIT_LABELS, canonicalUnit } from "./units";

export function parseRecipe(caption: string): ParsedRecipe | null {
  const lines = splitLines(caption);
  if (lines.length === 0) return null;

  const ingredientLines: string[] = [];
  const stepLines: string[] = [];
  const preamble: string[] = [];
  const uncategorized: string[] = [];

  let section: Section = null;
  let sawHeader = false;

  for (const line of lines) {
    const detected = detectSection(line);
    if (detected !== null) {
      // Wenn bisher sawHeader=false war und die erste Überschrift "steps" ist,
      // war die preamble davor möglicherweise der Titel gefolgt von einer Zutatenliste (ohne Zutaten-Überschrift)
      if (!sawHeader && detected === "steps" && preamble.length > 0) {
        // Prüfen, ob Zeilen in der Preamble wie Zutaten aussehen
        const potIngs = preamble.filter((l) => looksLikeIngredient(l) >= 2);
        if (potIngs.length > 0) {
          // Die erste Zeile als Titel behalten, wenn sie NICHT wie eine Zutat aussieht
          if (looksLikeIngredient(preamble[0]) < 2) {
            const titleLine = preamble.shift()!;
            ingredientLines.push(...preamble);
            preamble.length = 0;
            preamble.push(titleLine);
          } else {
            ingredientLines.push(...preamble);
            preamble.length = 0;
          }
        }
      }
      section = detected;
      sawHeader = true;
      continue;
    }
    if (section === "ingredients") ingredientLines.push(line);
    else if (section === "steps") stepLines.push(line);
    else if (section === "ignore") continue;
    else if (!sawHeader) preamble.push(line);
    else uncategorized.push(line);
  }

  // Überschriften vorhanden → klare Zuordnung; Preamble liefert Titel/Meta.
  if (sawHeader) {
    const ingredients = ingredientLines
      .flatMap(expandIngredientLine)
      .map(parseIngredientLine)
      .filter((i): i is NonNullable<typeof i> => i !== null)
      .map(toIngredient);
    const steps = makeSteps(stepLines);
    const meta = parseTimes(lines);
    return {
      title: pickTitle(preamble, (l) => detectSection(l) !== null) ?? "Neues Rezept",
      servings: parseServings(lines),
      prepTime: meta.prepTime,
      cookTime: meta.cookTime,
      ingredients,
      steps,
    };
  }

  // Keine Überschriften → Scoring pro Zeile.
  const scoredIngredients: string[] = [];
  const scoredSteps: string[] = [];
  const scoredPreamble: string[] = [];
  for (const line of lines) {
    const iScore = looksLikeIngredient(line);
    const sScore = looksLikeStep(line);
    if (lineLooksLikeStep(line) || (sScore >= 4 && sScore > iScore)) {
      scoredSteps.push(line);
    } else if (iScore >= 3) {
      scoredIngredients.push(line);
    } else {
      scoredPreamble.push(line);
    }
  }

  const ingredients = scoredIngredients
    .flatMap(expandIngredientLine)
    .map(parseIngredientLine)
    .filter((i): i is NonNullable<typeof i> => i !== null)
    .map(toIngredient);
  const steps = makeSteps(scoredSteps);

  if (ingredients.length === 0 && steps.length === 0) return null;

  const meta = parseTimes(lines);
  return {
    title:
      pickTitle(scoredPreamble, () => false) ??
      pickTitle(lines, () => false) ??
      "Neues Rezept",
    servings: parseServings(lines),
    prepTime: meta.prepTime,
    cookTime: meta.cookTime,
    ingredients,
    steps,
  };
}
