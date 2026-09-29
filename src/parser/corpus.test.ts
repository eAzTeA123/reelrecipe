import { describe, expect, it } from "vitest";
import { parseRecipe } from "./index";
import { ensembleStrategy } from "./strategies/ensemble";
import { loadCorpus } from "./corpus/loader";
import { formatReport, scoreCase, summarize } from "./corpus/score";
import { CORPUS_MIN } from "./corpus/thresholds";
import type { ActualRecipe, CorpusFixture } from "./corpus/types";
import type { CaseScore } from "./corpus/score";

/**
 * Real-Caption-Corpus: echte Instagram/TikTok-Captions mit menschengeschriebener
 * Ground Truth. Misst feldgenau (Zutaten-Name, Menge, Einheit, Titel, Portionen,
 * Schritte) statt nur Anzahlen zu vergleichen.
 *
 * Die Schwellen unten sind die Untergrenze des erreichten Stands: sie dürfen
 * steigen, aber nicht sinken. Neue Captions einfach als JSON in
 * src/parser/corpus/fixtures/ ablegen.
 */

const fixtures = loadCorpus();

const MIN = CORPUS_MIN;

function evaluate(fixture: CorpusFixture): CaseScore {
  const parsed = parseRecipe(fixture.caption);
  const strategy = ensembleStrategy.parse(fixture.caption).strategy;

  const actual: ActualRecipe | null = parsed
    ? {
        title: parsed.title,
        servings: parsed.servings,
        ingredients: parsed.ingredients.map((i) => ({
          amount: i.amount,
          unit: i.unit,
          name: i.name,
        })),
        steps: parsed.steps.map((s) => s.instruction),
        strategy,
      }
    : null;

  return scoreCase(fixture, actual);
}

describe("Real-Caption-Corpus (Feld-Score)", () => {
  const scores = fixtures.map(evaluate);
  const summary = summarize(scores);

  it("enthält echte Captions als Fixtures", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(MIN.fixtures);
    for (const f of fixtures) {
      expect(f.caption.length, `${f.id} hat eine zu kurze Caption`).toBeGreaterThan(80);
      if (f.negative) {
        // Negativfall: die Caption enthält bewusst kein Rezept
        expect(f.expected.ingredients, `${f.id} ist als Negativfall markiert`).toHaveLength(0);
      } else {
        expect(f.expected.ingredients.length, `${f.id} hat keine erwarteten Zutaten`).toBeGreaterThan(0);
      }
    }
  });

  it("druckt den Score-Report und hält die Mindestwerte", () => {
    console.log(formatReport(scores, summary));

    expect(summary.ingredientF1, "Zutaten-F1").toBeGreaterThanOrEqual(MIN.ingredientF1);
    expect(summary.titleAccuracy, "Titel-Treffer").toBeGreaterThanOrEqual(MIN.titleAccuracy);
    expect(summary.amountAccuracy, "Mengen-Treffer").toBeGreaterThanOrEqual(MIN.amountAccuracy);
    expect(summary.unitAccuracy, "Einheiten-Treffer").toBeGreaterThanOrEqual(MIN.unitAccuracy);
    expect(summary.stepsOkRate, "Schritt-Anzahl ±1").toBeGreaterThanOrEqual(MIN.stepsOkRate);
    expect(summary.totalStepLeaks, "Zutaten in den Schritten").toBeLessThanOrEqual(MIN.maxStepLeaks);
    if (summary.servingsAccuracy !== null) {
      expect(summary.servingsAccuracy, "Portionen-Treffer").toBeGreaterThanOrEqual(MIN.servingsAccuracy);
    }
  });
});
