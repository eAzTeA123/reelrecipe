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

/**
 * Inkrement bei jeder wesentlichen Parser-Änderung.
 *
 * **Wichtig:** Diese Zahl ist der Auslöser für die Neu-Einlese-Migration
 * (`data/local/migrationService.ts`): Beim App-Start werden alle Rezepte mit
 * `parserVersion < PARSER_VERSION` aus ihrer gespeicherten Caption neu geparst –
 * über den schützenden Merge, eigene Änderungen bleiben also erhalten
 * (Rückmeldung als Toast in `MigrationRunner`).
 *
 * Version 17: Titelbereinigung (Anpreisungen, Nutzen-Floskeln, Emojis), Headlines
 * mit dem Gerichtsnamen hinter dem Doppelpunkt, und Zutatenzeilen mit eigener
 * Menge werden nicht mehr an die vorherige Zutat gehängt („Quark ca. 200 ml Milch").
 */
export const PARSER_VERSION = 17;

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

  // Marketing-Headlines als letzte Chance vor dem Zutaten-Fallback.
  // Fenster bewusst größer als 3 Zeilen: Captions beginnen oft mit
  // "ZUM REZEPT ⬇️ / . / ." und der echte Titel steht erst darunter.
  if (!title || title.length < 3) {
    for (const line of lines.slice(0, 10)) {
      const derived = extractTitleFromHeadline(line);
      if (derived) {
        title = derived;
        break;
      }
    }
  }

  if (!title || title.length < 3) {
    // Letzter Ausweg: die erste Zutat – aber nur, wenn sie als Titel taugt.
    // Sonst wurde aus einer durchgesickerten Überschrift ("Zutaten") oder einer
    // Werbezeile der Rezeptname.
    const candidate = ingredients[0]?.name.replace(/\s*\(.*?\)/g, "").trim() ?? "";
    if (candidate.length >= 3 && !isSectionHeader(candidate) && isPlausibleTitle(candidate)) {
      title = candidate;
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










