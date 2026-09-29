import type { ParsedRecipe, ParserCorrection } from "@/domain/types";
import type { CorpusFixture, CorpusIngredient } from "./types";

/**
 * Eine Nutzerkorrektur aus dem Review-Schritt: was der Parser vorgeschlagen hat
 * und was der Mensch daraus gemacht hat. Daraus werden Corpus-Fixtures erzeugt,
 * damit jede echte Fehleingabe dauerhaft als Testfall existiert.
 */
export type CorrectionRecord = ParserCorrection;

type IngredientLike = { name: string; amount?: number; unit?: string };

function ingredientKey(i: IngredientLike): string {
  return `${i.amount ?? ""}|${(i.unit ?? "").toLowerCase().trim()}|${i.name.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

/** Nur echte Abweichungen sind als Testfall wertvoll. */
export function hasMeaningfulCorrection(parsed: ParsedRecipe, corrected: ParsedRecipe): boolean {
  if (parsed.title.trim() !== corrected.title.trim()) return true;
  if ((parsed.servings ?? null) !== (corrected.servings ?? null)) return true;
  if ((parsed.cookTime ?? null) !== (corrected.cookTime ?? null)) return true;
  if (parsed.ingredients.length !== corrected.ingredients.length) return true;
  if (parsed.ingredients.some((ing, idx) => ingredientKey(ing) !== ingredientKey(corrected.ingredients[idx]))) {
    return true;
  }
  if (parsed.steps.length !== corrected.steps.length) return true;
  return parsed.steps.some((step, idx) => step.instruction.trim() !== corrected.steps[idx]?.instruction.trim());
}

/** Reicht die Korrektur als Fixture? (Caption vorhanden, mindestens eine Zutat) */
export function isRecordableCorrection(
  parsed: ParsedRecipe,
  corrected: ParsedRecipe,
  sourceCaption: string,
): boolean {
  if (sourceCaption.trim().length < 30) return false;
  if (corrected.ingredients.length === 0) return false;
  return hasMeaningfulCorrection(parsed, corrected);
}

function toCorpusIngredient(ingredient: IngredientLike): CorpusIngredient {
  return {
    amount: ingredient.amount ?? null,
    unit: ingredient.unit ?? null,
    name: ingredient.name.trim(),
  };
}

function slugFromSource(sourceUrl?: string): string | undefined {
  if (!sourceUrl) return undefined;
  const match = sourceUrl.match(/\/(?:reel|reels|p|tv|video)\/([A-Za-z0-9_-]{5,30})/);
  return match ? match[1].toLowerCase() : undefined;
}

/** Wandelt eine App-Korrektur in ein Corpus-Fixture um (Ground Truth = Nutzerfassung). */
export function correctionToFixture(record: CorrectionRecord): CorpusFixture {
  const slug = slugFromSource(record.sourceUrl);
  const shortId = record.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toLowerCase();
  const parsedDiff =
    `${record.parsed.ingredients.length} Zutaten / ${record.parsed.steps.length} Schritte` +
    ` → ${record.corrected.ingredients.length} Zutaten / ${record.corrected.steps.length} Schritte`;

  return {
    id: `app-${slug ?? shortId}`,
    source: record.sourceUrl ?? "app://manuell",
    account: "app-korrektur",
    language: "de",
    style: "user-korrigiert",
    caption: record.sourceCaption,
    expected: {
      title: record.corrected.title.trim(),
      servings: record.corrected.servings ?? null,
      ingredients: record.corrected.ingredients.map(toCorpusIngredient),
      stepsCount: record.corrected.steps.length,
    },
    notes: `Automatisch aus einer App-Korrektur vom ${new Date(record.createdAt).toISOString().slice(0, 10)} (Parser: ${parsedDiff}).`,
  };
}

/** Alle Korrekturen als eine JSON-Datei, die direkt in corpus/fixtures/ gelegt werden kann. */
export function correctionsToFixtureJson(records: CorrectionRecord[]): string {
  return `${JSON.stringify(records.map(correctionToFixture), null, 2)}\n`;
}
