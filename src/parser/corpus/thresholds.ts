/**
 * Mindestwerte des Real-Caption-Corpus (Ratchet).
 *
 * Sie sind der gemessene Stand: Verbesserungen heben die Werte, Regressionen
 * lassen den Test `npm run test:corpus` fehlschlagen. Bewusst hier – der
 * Report-Runner und der Test teilen sich dieselben Schwellen.
 *
 * Score-Verlauf (18 echte Captions aus 7 Accounts, feldgenauer Score):
 *   - vor dem Corpus-Umbau (nur 2 Accounts, 8 Fälle): F1 0.987
 *   - nach Corpus-Erweiterung auf 7 Accounts     : F1 0.767  ← Überanpassung sichtbar
 *   - nach den Fixes (Runden 2–5)                : F1 0.971
 *   - Zielmarke ≥95 % auf allen Kennzahlen       : F1 0.985, Recall 0.995, Precision 0.976,
 *     Mengen 99 %, Einheiten 99 %, Titel 100 %, Portionen 100 %, Schritte ±1 100 %,
 *     Zutaten-in-Schritten 1 – kein Account unter 0.97
 *
 * Report mit Details und Account-Aufschlüsselung: `npm run test:corpus`.
 */
export const CORPUS_MIN = {
  ingredientF1: 0.97,
  titleAccuracy: 0.95,
  amountAccuracy: 0.97,
  unitAccuracy: 0.97,
  servingsAccuracy: 0.95,
  stepsOkRate: 0.95,
  maxStepLeaks: 1,
  /** Mindestanzahl echter Captions im Corpus (7 Accounts, verschiedene Stile) */
  fixtures: 18,
} as const;
