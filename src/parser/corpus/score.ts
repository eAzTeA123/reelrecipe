import type { ActualIngredient, ActualRecipe, CorpusFixture, CorpusIngredient } from "./types";

/* ------------------------------------------------------------------ */
/* Text-Normalisierung & Namensvergleich                               */
/* ------------------------------------------------------------------ */

const FILLER = new Set([
  "der", "die", "das", "und", "oder", "mit", "von", "vom", "für", "fur", "the", "and",
  "aus", "dem", "den", "ein", "eine", "einen", "etwas", "ca", "je", "jeweils", "optional",
]);

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[„“”"']/g, "")
    .replace(/[^a-z0-9äöüß%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Namens-Normalisierung für den Vergleich: Klammerzusätze ("Zwiebel(n)",
 * "Ei (Größe M)") und beschreibende Adjektive entfernen – die Caption schreibt
 * "Zwiebel(n)", der Parser normalisiert zu "Zwiebeln"; beides meint dasselbe.
 */
function normalizeName(value: string): string {
  // Klammerzusätze ZUERST entfernen: normalizeText würde "(Größe M)" in
  // eigenständige Wörter zerlegen ("ei größe m" ≠ "ei").
  return normalizeText(value.replace(/\([^)]*\)/g, " "))
    .replace(/\b(?:grosse|grosser|grosses|große|großer|großes|kleine|kleiner|kleines|feine|feiner|feines|frische|frischer|frisches|eingelegte|eingelegter|geriebene|geriebener|gehackte|gehackter|halbe|halber|halbes)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sehr leichte Stammform für deutsche Plurale ("Zwiebeln" → "zwiebel"). */
function stemToken(token: string): string {
  return token.length > 4 ? token.replace(/(?:en|er|es|e|n|s)$/, "") : token;
}

function stemmedName(value: string): string {
  return normalizeName(value)
    .split(" ")
    .filter(Boolean)
    .map(stemToken)
    .join(" ");
}

function tokens(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .map(stemToken)
    .filter((t) => t.length >= 3 && !FILLER.has(t));
}

function jaccard(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

/** 0 = kein Treffer, 1 = sicherer Treffer. */
export function nameMatchScore(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length >= 5 && long.includes(short)) return 0.8;
  if (stemmedName(na) === stemmedName(nb)) return 0.75;
  const j = jaccard(a, b);
  if (j >= 0.6) return 0.7;
  return 0;
}

/**
 * Kategorie-Zeilen innerhalb einer Zutatenliste ("🌶️ GEWÜRZE FÜR DAS HÄHNCHEN",
 * "Für die Soße", "Topping"). Der Parser behält sie bewusst als Struktur für die
 * UI – als *Zutat* zählen sie hier aber nicht, sonst verzerren sie die Precision.
 */
export function isCategoryLine(ingredient: ActualIngredient): boolean {
  if (ingredient.amount !== undefined || ingredient.unit !== undefined) return false;
  const raw = ingredient.name.trim();
  if (raw.length === 0 || raw.length > 45) return false;
  // Zwischenüberschrift mit Doppelpunkt ("Suppe:", "Ananas-Chutney:", "Für die Soße:")
  if (raw.endsWith(":")) return true;
  const name = raw.replace(/^[^\p{L}]+/u, "").trim();
  if (name.length === 0 || name.length > 45) return false;
  if (/^(?:für|for)\s+(?:den|die|das|demn|dem|der)\b/i.test(name)) return true;
  if (/^(?:gewürze|zutaten|topping|sauce|soße|dressing|marinade|deko|garnitur|belag|füllung|außerdem|ausserdem)\b/i.test(name)) {
    return true;
  }
  // Bauteil-Label innerhalb der Zutatenliste ("Haselnuss-Creme", "Bueno-Finish"):
  // mehrteilig, ohne Menge – das ist eine Zwischenüberschrift, keine Zutat.
  if (
    name.split(/\s+/).length <= 3 &&
    /[- ](?:creme|sauce|soße|topping|füllung|boden|dressing|crunch|finish|glasur|belag)\b/i.test(name)
  ) {
    return true;
  }
  // Einzelnes Bauteil-Wort ("Crunch", "Topping") ist ebenfalls Struktur
  if (/^(?:crunch|topping|glasur|füllung|dressing|belag|boden)\b/i.test(name)) return true;
  // Durchgehend groß geschriebene Zwischenüberschrift
  return name === name.toUpperCase() && /\p{Lu}{3}/u.test(name);
}

const MATCH_THRESHOLD = 0.7;

/**
 * Unabhängige Plausibilitätsprüfung für Titel (bewusst nicht die Parser-Logik):
 * Listenzeilen, Klammer-Notizen, Mengen+Einheit und Werbetext sind keine Titel.
 */
export function isPlausibleTitleText(title: string): boolean {
  const t = (title ?? "").trim();
  if (t.length < 3 || t.length > 80) return false;
  if (/^[(\[{]/.test(t) || /[)\]}]\s*$/.test(t)) return false;
  if (/^[-–—•·*+~›»]/.test(t) || /^\d/.test(t)) return false;
  if (
    /\d+[.,]?\d*\s*(?:g|gr|ml|kg|l|el|tl|stück|stk|packung|dose|zehe|scheibe|prise|bund|handvoll|zweig|blatt|kopf|glas|becher|cup|oz|lb)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  if (/\b(?:prozis|rabattcode|rabatte?|gutschein|werbung|anzeige|folge mir|folgt mir|gratis|unterstützen)\b/i.test(t)) {
    return false;
  }
  return true;
}

export function normUnit(unit?: string | null): string {
  return (unit ?? "").toLowerCase().replace(/\.$/, "").trim();
}

export function amountEquals(expected?: number | null, actual?: number, expectedMax?: number | null): boolean {
  if (expected === null || expected === undefined) return true; // nicht bewertet
  if (actual === undefined) return false;
  const upper = expectedMax ?? expected;
  return actual >= expected - 0.01 && actual <= upper + 0.01;
}

/* ------------------------------------------------------------------ */
/* Bewertung eines Falls                                               */
/* ------------------------------------------------------------------ */

export interface IngredientPair {
  expected: CorpusIngredient;
  actual?: ActualIngredient;
  score: number;
}

export interface CaseScore {
  id: string;
  account?: string;
  /** Freie Stil-Beschreibung aus dem Fixture (z. B. "numbered-steps+prose") */
  style?: string;
  strategy?: string;
  parsed: boolean;
  titleOk: boolean;
  expectedTitle: string;
  actualTitle: string;
  /** null = Fixture erwartet keine Portionsangabe → nicht bewertet */
  servingsOk: boolean | null;
  matched: IngredientPair[];
  missing: CorpusIngredient[];
  extra: ActualIngredient[];
  recall: number;
  precision: number;
  f1: number;
  amountHits: number;
  amountTotal: number;
  unitHits: number;
  unitTotal: number;
  expectedSteps: number;
  actualSteps: number;
  stepsOk: boolean;
  /** Schritte, die eigentlich Zutatenzeilen sind */
  stepLeaks: string[];
}

export function scoreCase(fixture: CorpusFixture, actual: ActualRecipe | null): CaseScore {
  // Negativfall: hier zählt nur, dass der Parser nichts erfindet.
  if (fixture.negative) {
    const inventedIngredients = actual?.ingredients.length ?? 0;
    const inventedSteps = actual?.steps.length ?? 0;
    const clean = inventedIngredients === 0 && inventedSteps === 0;
    return {
      id: fixture.id,
      account: fixture.account,
      style: fixture.style,
      strategy: actual?.strategy,
      parsed: actual !== null,
      titleOk: true,
      expectedTitle: "(Negativfall: kein Rezept in der Caption)",
      actualTitle: actual?.title ?? "(nichts erkannt)",
      servingsOk: null,
      matched: [],
      missing: [],
      extra: actual?.ingredients ?? [],
      recall: clean ? 1 : 0,
      precision: clean ? 1 : 0,
      f1: clean ? 1 : 0,
      amountHits: 0,
      amountTotal: 0,
      unitHits: 0,
      unitTotal: 0,
      expectedSteps: 0,
      actualSteps: inventedSteps,
      stepsOk: clean,
      stepLeaks: [],
    };
  }

  // Symmetrie: Strukturzeilen (Überschriften, "Für den Teig", "Belag:")
  // zählen auf beiden Seiten nicht – sonst gilt eine Überschrift als
  // "fehlende Zutat" und drückt Recall und F1 künstlich.
  const expectedIngredients = fixture.expected.ingredients.filter(
    (ingredient) =>
      !isCategoryLine({
        amount: ingredient.amount ?? undefined,
        unit: ingredient.unit ?? undefined,
        name: ingredient.name,
      }),
  );
  // Kategorie-Überschriften sind Struktur, keine Zutaten-Behauptung.
  // Wiederholte Nennungen bleiben bewusst erhalten: Captions wiederholen Zutaten
  // (z. B. Gewürze für zwei Komponenten) und die Ground Truth zählt sie mit.
  const actualIngredients = (actual?.ingredients ?? []).filter((i) => !isCategoryLine(i));

  if (!actual) {
    return {
      id: fixture.id,
      account: fixture.account,
      style: fixture.style,
      parsed: false,
      titleOk: false,
      expectedTitle: fixture.expected.title ?? "(kein Titel in der Caption)",
      actualTitle: "(nicht geparst)",
      servingsOk: fixture.expected.servings != null ? false : null,
      matched: [],
      missing: [...expectedIngredients],
      extra: [],
      recall: 0,
      precision: 0,
      f1: 0,
      amountHits: 0,
      amountTotal: expectedIngredients.filter((i) => i.amount != null).length,
      unitHits: 0,
      unitTotal: expectedIngredients.filter((i) => i.unit != null).length,
      expectedSteps: fixture.expected.stepsCount,
      actualSteps: 0,
      stepsOk: false,
      stepLeaks: [],
    };
  }

  // Greedy-Matching: spezifische (längere) Erwartungen zuerst zuordnen
  const remaining = actualIngredients.map((a, index) => ({ a, index, used: false }));
  const matched: IngredientPair[] = [];
  const missing: CorpusIngredient[] = [];

  const ordered = [...expectedIngredients].sort((x, y) => y.name.length - x.name.length);

  for (const expected of ordered) {
    let best: { a: ActualIngredient; index: number; used: boolean } | undefined;
    let bestScore = 0;
    let bestLengthDelta = Number.POSITIVE_INFINITY;
    for (const candidate of remaining) {
      if (candidate.used) continue;
      const score = nameMatchScore(expected.name, candidate.a.name);
      // Bei gleichem Score gewinnt der namensähnlichste Kandidat
      // ("Ananas" → "kleine Ananas" statt "Ananas-Chutney")
      const lengthDelta = Math.abs(candidate.a.name.length - expected.name.length);
      if (score > bestScore || (score === bestScore && score > 0 && lengthDelta < bestLengthDelta)) {
        bestScore = score;
        best = candidate;
        bestLengthDelta = lengthDelta;
      }
    }
    if (best && bestScore >= MATCH_THRESHOLD) {
      best.used = true;
      matched.push({ expected, actual: best.a, score: bestScore });
    } else {
      missing.push(expected);
    }
  }

  const extra = remaining.filter((c) => !c.used).map((c) => c.a);

  const recall = expectedIngredients.length > 0 ? matched.length / expectedIngredients.length : 1;
  const precision = actualIngredients.length > 0 ? matched.length / actualIngredients.length : expectedIngredients.length === 0 ? 1 : 0;
  const f1 = recall + precision > 0 ? (2 * recall * precision) / (recall + precision) : 0;

  let amountHits = 0;
  let amountTotal = 0;
  let unitHits = 0;
  let unitTotal = 0;
  for (const pair of matched) {
    if (pair.expected.amount != null) {
      amountTotal++;
      if (amountEquals(pair.expected.amount, pair.actual?.amount, pair.expected.amountMax)) amountHits++;
    }
    if (pair.expected.unit != null) {
      unitTotal++;
      if (normUnit(pair.expected.unit) === normUnit(pair.actual?.unit)) unitHits++;
    }
  }

  const stepLeaks = actual.steps.filter((step) => {
    const words = normalizeText(step).split(" ").filter(Boolean);
    if (words.length > 6) return false;
    return expectedIngredients.some((i) => nameMatchScore(i.name, step) >= MATCH_THRESHOLD);
  });

  const expectedTitle = fixture.expected.title;
  const actualTitle = actual.title ?? "";
  const titleOk =
    expectedTitle === null
      ? isPlausibleTitleText(actualTitle)
      : normalizeText(actualTitle) === normalizeText(expectedTitle) ||
        nameMatchScore(expectedTitle, actualTitle) >= 0.7 ||
        jaccard(expectedTitle, actualTitle) >= 0.75;

  const servingsOk =
    fixture.expected.servings == null
      ? null
      : actual.servings !== undefined &&
        actual.servings >= fixture.expected.servings - 0.01 &&
        actual.servings <= (fixture.expected.servingsMax ?? fixture.expected.servings) + 0.01;

  // Fixtures, deren Schrittzahl nicht aus der Caption ableitbar ist (z. B. von
  // Hand ergänzte Anleitung), werden hier neutral bewertet statt falsch.
  const stepsOk =
    fixture.stepsUnreliable !== undefined ||
    Math.abs(actual.steps.length - fixture.expected.stepsCount) <= 1;

  return {
    id: fixture.id,
    account: fixture.account,
    style: fixture.style,
    strategy: actual.strategy,
    parsed: true,
    titleOk,
    expectedTitle: expectedTitle ?? "(kein Titel in der Caption)",
    actualTitle,
    servingsOk,
    matched,
    missing,
    extra,
    recall,
    precision,
    f1,
    amountHits,
    amountTotal,
    unitHits,
    unitTotal,
    expectedSteps: fixture.expected.stepsCount,
    actualSteps: actual.steps.length,
    stepsOk,
    stepLeaks,
  };
}

/* ------------------------------------------------------------------ */
/* Aggregat + Report                                                   */
/* ------------------------------------------------------------------ */

export interface CorpusSummary {
  cases: number;
  ingredientF1: number;
  ingredientRecall: number;
  ingredientPrecision: number;
  amountAccuracy: number;
  unitAccuracy: number;
  titleAccuracy: number;
  servingsAccuracy: number | null;
  stepsOkRate: number;
  totalStepLeaks: number;
  failedCases: string[];
  topMissing: [string, number][];
  topExtra: [string, number][];
}

const avg = (values: number[]): number =>
  values.length === 0 ? 1 : values.reduce((a, b) => a + b, 0) / values.length;

export interface GroupScore {
  key: string;
  cases: number;
  ingredientF1: number;
  titleAccuracy: number;
  amountAccuracy: number;
  unitAccuracy: number;
  stepsOkRate: number;
}

/**
 * Auswertung je Account: zeigt, ob der Parser nur auf einzelne Creator-Stile
 * eingestellt ist (große Streuung) oder über Stile hinweg trägt.
 */
export function groupByAccount(scores: CaseScore[]): GroupScore[] {
  const groups = new Map<string, CaseScore[]>();
  for (const s of scores) {
    const key = s.account ?? "unbekannt";
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }

  return [...groups.entries()]
    .map(([key, list]) => {
      const totalAmount = list.reduce((a, s) => a + s.amountTotal, 0);
      const totalUnit = list.reduce((a, s) => a + s.unitTotal, 0);
      return {
        key,
        cases: list.length,
        ingredientF1: avg(list.map((s) => s.f1)),
        titleAccuracy: avg(list.map((s) => (s.titleOk ? 1 : 0))),
        amountAccuracy: totalAmount > 0 ? list.reduce((a, s) => a + s.amountHits, 0) / totalAmount : 1,
        unitAccuracy: totalUnit > 0 ? list.reduce((a, s) => a + s.unitHits, 0) / totalUnit : 1,
        stepsOkRate: avg(list.map((s) => (s.stepsOk ? 1 : 0))),
      };
    })
    .sort((a, b) => a.ingredientF1 - b.ingredientF1 || a.key.localeCompare(b.key));
}

export function summarize(scores: CaseScore[]): CorpusSummary {
  const missingCount = new Map<string, number>();
  const extraCount = new Map<string, number>();
  for (const s of scores) {
    for (const m of s.missing) missingCount.set(m.name, (missingCount.get(m.name) ?? 0) + 1);
    for (const e of s.extra) extraCount.set(e.name, (extraCount.get(e.name) ?? 0) + 1);
  }
  const top = (map: Map<string, number>): [string, number][] =>
    [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);

  const totalAmount = scores.reduce((a, s) => a + s.amountTotal, 0);
  const totalUnit = scores.reduce((a, s) => a + s.unitTotal, 0);
  const servingsScored = scores.filter((s) => s.servingsOk !== null);

  return {
    cases: scores.length,
    ingredientF1: avg(scores.map((s) => s.f1)),
    ingredientRecall: avg(scores.map((s) => s.recall)),
    ingredientPrecision: avg(scores.map((s) => s.precision)),
    amountAccuracy: totalAmount > 0 ? scores.reduce((a, s) => a + s.amountHits, 0) / totalAmount : 1,
    unitAccuracy: totalUnit > 0 ? scores.reduce((a, s) => a + s.unitHits, 0) / totalUnit : 1,
    titleAccuracy: avg(scores.map((s) => (s.titleOk ? 1 : 0))),
    servingsAccuracy:
      servingsScored.length > 0
        ? servingsScored.filter((s) => s.servingsOk).length / servingsScored.length
        : null,
    stepsOkRate: avg(scores.map((s) => (s.stepsOk ? 1 : 0))),
    totalStepLeaks: scores.reduce((a, s) => a + s.stepLeaks.length, 0),
    failedCases: scores.filter((s) => s.f1 < 1 || !s.titleOk).map((s) => s.id),
    topMissing: top(missingCount),
    topExtra: top(extraCount),
  };
}

const pct = (value: number): string => `${(value * 100).toFixed(0)}%`.padStart(4);
const pad = (value: string, width: number): string => value.padEnd(width).slice(0, width);

export function formatReport(scores: CaseScore[], summary: CorpusSummary): string {
  const lines: string[] = [];
  const width = 132;
  lines.push("");
  lines.push("=".repeat(width));
  lines.push("REAL-CAPTION-CORPUS (Feld-Score)");
  lines.push("=".repeat(width));
  lines.push(
    `${pad("ID", 28)} ${pad("Stil", 26)} ${pad("Zutaten R/P", 11)} ${pad("F1", 5)} ${pad("Menge", 7)} ${pad(
      "Einheit",
      8,
    )} ${pad("Schritte", 9)} ${pad("Titel", 6)} ${pad("Port.", 6)}`,
  );
  lines.push("-".repeat(width));

  for (const s of scores) {
    const amounts = s.amountTotal > 0 ? `${s.amountHits}/${s.amountTotal}` : "–";
    const units = s.unitTotal > 0 ? `${s.unitHits}/${s.unitTotal}` : "–";
    lines.push(
      `${pad(s.id, 28)} ${pad(s.style ?? "–", 26)} ${pad(
        `${s.matched.length}/${s.matched.length + s.extra.length}`,
        11,
      )} ${pad(s.f1.toFixed(2), 5)} ${pad(amounts, 7)} ${pad(units, 8)} ${pad(
        `${s.actualSteps}/${s.expectedSteps}`,
        9,
      )} ${pad(s.titleOk ? "✓" : "✗", 6)} ${pad(s.servingsOk === null ? "–" : s.servingsOk ? "✓" : "✗", 6)}`,
    );
  }

  lines.push("-".repeat(width));
  lines.push(
    `Zutaten-F1 (Makro): ${summary.ingredientF1.toFixed(3)}   Recall: ${summary.ingredientRecall.toFixed(
      3,
    )}   Precision: ${summary.ingredientPrecision.toFixed(3)}`,
  );
  lines.push(
    `Mengen: ${pct(summary.amountAccuracy)}   Einheiten: ${pct(summary.unitAccuracy)}   Titel: ${pct(
      summary.titleAccuracy,
    )}   Portionen: ${summary.servingsAccuracy === null ? "–" : pct(summary.servingsAccuracy)}   Schritte ±1: ${pct(
      summary.stepsOkRate,
    )}   Zutaten-in-Schritten: ${summary.totalStepLeaks}`,
  );

  lines.push("");
  lines.push("Nach Account (schlechtester zuerst):");
  lines.push(
    `  ${pad("Account", 22)} ${pad("Fälle", 6)} ${pad("F1", 6)} ${pad("Titel", 6)} ${pad("Menge", 6)} ${pad(
      "Einheit",
      8,
    )} ${pad("Schritte", 9)}`,
  );
  for (const g of groupByAccount(scores)) {
    lines.push(
      `  ${pad(g.key, 22)} ${pad(String(g.cases), 6)} ${pad(g.ingredientF1.toFixed(2), 6)} ${pad(
        pct(g.titleAccuracy),
        6,
      )} ${pad(pct(g.amountAccuracy), 6)} ${pad(pct(g.unitAccuracy), 8)} ${pad(pct(g.stepsOkRate), 9)}`,
    );
  }

  if (summary.topMissing.length > 0) {
    lines.push(`Häufig fehlend:  ${summary.topMissing.map(([n, c]) => `${n} (${c}×)`).join(", ")}`);
  }
  if (summary.topExtra.length > 0) {
    lines.push(`Häufig zu viel:  ${summary.topExtra.map(([n, c]) => `${n} (${c}×)`).join(", ")}`);
  }

  const problematic = scores.filter((s) => s.f1 < 1 || !s.titleOk || s.stepLeaks.length > 0);
  if (problematic.length > 0) {
    lines.push("");
    lines.push("--- Details der auffälligen Fälle ---");
    for (const s of problematic) {
      lines.push(`\n[${s.id}]${s.strategy ? ` (Strategie: ${s.strategy})` : ""}`);
      if (!s.titleOk) lines.push(`  Titel:      "${s.expectedTitle}" → "${s.actualTitle}"`);
      if (s.missing.length > 0) lines.push(`  Fehlt:      ${s.missing.map((m) => m.name).join(" | ")}`);
      if (s.extra.length > 0) lines.push(`  Zu viel:    ${s.extra.map((e) => e.name).join(" | ")}`);
      const wrongAmounts = s.matched
        .filter((p) => p.expected.amount != null && !amountEquals(p.expected.amount, p.actual?.amount, p.expected.amountMax))
        .map((p) => `${p.expected.name}: ${p.expected.amount} → ${p.actual?.amount ?? "?"}`);
      if (wrongAmounts.length > 0) lines.push(`  Mengen:     ${wrongAmounts.join(" | ")}`);
      const wrongUnits = s.matched
        .filter((p) => p.expected.unit != null && normUnit(p.expected.unit) !== normUnit(p.actual?.unit))
        .map((p) => `${p.expected.name}: ${p.expected.unit} → ${p.actual?.unit ?? "?"}`);
      if (wrongUnits.length > 0) lines.push(`  Einheiten:  ${wrongUnits.join(" | ")}`);
      if (!s.stepsOk) lines.push(`  Schritte:   ${s.actualSteps} erkannt, ${s.expectedSteps} erwartet`);
      if (s.stepLeaks.length > 0) lines.push(`  Zutaten in Schritten: ${s.stepLeaks.join(" | ")}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}


