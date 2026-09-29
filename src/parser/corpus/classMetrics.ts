/**
 * Klassen-Metriken über Fixture + Parser-Ergebnis.
 *
 * Die Gesamt-F1 verrät nicht, WELCHE Art Fehler passiert. Diese Zähler machen
 * die vier wiederkehrenden Klassen aus echten Captions sichtbar:
 * Überschrift als Titel, Marketingsatz als Titel, Werbezeilen in den Daten,
 * Zutatenzeilen in den Schritten, Anleitung ohne Schritte, Über-Segmentierung.
 *
 * Bewusst eigenständig (kein Eingriff in den Feld-Score): die Zähler werden
 * dort ausgewertet, wo Fixture und Parser-Ergebnis zusammen vorliegen.
 */
import type { ActualRecipe, CorpusFixture } from "./types";

export interface CaseClasses {
  id: string;
  headingAsTitle: boolean;
  headlineTitle: boolean;
  promoLeaks: number;
  ingredientLeaks: number;
  zeroSteps: boolean;
  overSplit: boolean;
}

export interface ClassSummary {
  cases: number;
  headingAsTitle: number;
  headlineTitle: number;
  promoLeaks: number;
  ingredientLeaks: number;
  zeroStepCases: number;
  overSplitCases: number;
}

/** Abschnitts-/Strukturwörter, die als Titel nie taugen. */
const MARKER_TITLE =
  /^(?:zutaten|zubereitung|anleitung|nährwerte|naehrwerte|portionen|mengenangaben|belag|topping|sauce|soße|dressing|für\s+(?:den|die|das))\b/i;

/** Ansprache/Marketing – ein Satz, kein Rezeptname. */
const HEADLINE_TITLE = /\b(?:ich|wir|du|dir|dich|wenn|falls|folge|folgt|speichere|teste|probiert|schau|check|save)\b/i;

/** Werbung, Codes, Social-CTA – gehört weder in Zutaten noch in Schritte. */
const PROMO =
  /(?:\b(?:folge|folgt|link in bio|rabattcode|gutschein|sparen|werbung|anzeige|anzeigen|cookbook|discount|mealprep)\b|@[\w.]+\.(?:de|com|at|ch)|\bcode\s+\w+)/i;

/** Zutatenzeile: beginnt mit Menge + Einheit ("200 g …", "1 EL …"). */
const QUANTITY_LEAD = /^\s*(?:[-•*·▪]|\d+[.)])?\s*\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|el|tl|prise|päckchen|packung|dose|bund|zehe|stück)\b/i;

export function classifyCase(fixture: CorpusFixture, actual: ActualRecipe | null): CaseClasses {
  const title = actual?.title ?? "";
  const steps = actual?.steps ?? [];
  const ingredients = actual?.ingredients ?? [];

  const promoLeaks =
    ingredients.filter((i) => PROMO.test(i.name)).length + steps.filter((s) => PROMO.test(s)).length;

  return {
    id: fixture.id,
    headingAsTitle: title.length > 0 && MARKER_TITLE.test(title.trim()),
    headlineTitle: title.trim().length > 40 && HEADLINE_TITLE.test(title),
    promoLeaks,
    ingredientLeaks: steps.filter((s) => QUANTITY_LEAD.test(s)).length,
    zeroSteps: fixture.expected.stepsCount > 2 && steps.length === 0,
    overSplit: steps.length > Math.max(12, fixture.expected.ingredients.length * 2.5),
  };
}

export function summarizeClasses(cases: CaseClasses[]): ClassSummary {
  return {
    cases: cases.length,
    headingAsTitle: cases.filter((c) => c.headingAsTitle).length,
    headlineTitle: cases.filter((c) => c.headlineTitle).length,
    promoLeaks: cases.reduce((a, c) => a + c.promoLeaks, 0),
    ingredientLeaks: cases.reduce((a, c) => a + c.ingredientLeaks, 0),
    zeroStepCases: cases.filter((c) => c.zeroSteps).length,
    overSplitCases: cases.filter((c) => c.overSplit).length,
  };
}

export function formatClassSummary(summary: ClassSummary): string {
  return [
    `Klassen (${summary.cases} Fälle):`,
    `  Überschrift als Titel: ${summary.headingAsTitle}`,
    `  Marketingtitel:        ${summary.headlineTitle}`,
    `  Werbezeilen in Daten:  ${summary.promoLeaks}`,
    `  Zutaten in Schritten:  ${summary.ingredientLeaks}`,
    `  Schritte fehlen:       ${summary.zeroStepCases}`,
    `  Über-Segmentierung:    ${summary.overSplitCases}`,
  ].join("\n");
}
