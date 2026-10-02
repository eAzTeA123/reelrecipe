/**
 * Golden-Set-Eval: misst alle Schwellen A–D und beendet sich mit Exit-Code 1,
 * sobald eine erreichbare Schwelle verfehlt wird.
 *
 * Aufruf über `npm run eval` (bündelt diese Datei mit esbuild, weil Vitest in
 * manchen Umgebungen nicht startet) bzw. `npm run eval:final` für die
 * **einmalige** Messung auf dem Testset.
 *
 * Zwei Regeln sind hier hart eingebaut, damit die Messung ehrlich bleibt:
 * 1. Ohne `--final` wird **nur** das Dev-Set gemessen. Das Testset wird nie
 *    beim Tunen angesehen.
 * 2. Jeder Final-Lauf wird mit Zeitstempel und Hash des Testsets protokolliert
 *    (`tests/golden/final-run.log`), damit Mehrfachmessungen sichtbar sind.
 *
 * Zahlen werden nicht gerundet und nicht schöngerechnet: die Tabelle zeigt die
 * vollen Nachkommastellen, die Schwellenprüfung vergleicht exakt.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { parseRecipe } from "@/parser";
import { ensembleStrategy } from "@/parser/strategies/ensemble";
import { amountEquals, nameMatchScore, normUnit, scoreCase, summarize } from "@/parser/corpus/score";
import type { CaseScore, IngredientPair } from "@/parser/corpus/score";
import type { ActualRecipe, CorpusFixture, CorpusIngredient } from "@/parser/corpus/types";

const MODE = process.argv.includes("--final") ? "final" : "dev";
const LIVE = process.argv.includes("--live");
const ROOT = process.cwd();
/** Erlaubt eine abweichende Golden-Set-Ablage, z. B. eine lokale Messung auf
 *  einer echten Sicherungskopie (`tests/golden/local/`, nicht im Repo). */
const goldenArg = (() => {
  const index = process.argv.indexOf("--golden");
  return index >= 0 ? process.argv[index + 1] : undefined;
})();
const GOLDEN_DIR = goldenArg ? resolve(ROOT, goldenArg) : join(ROOT, "tests", "golden");

const THRESHOLDS = {
  precision: 0.95,
  recall: 0.95,
  amountUnit: 0.95,
  priceAccuracy: 0.95,
  coverage: 0.8,
  recipeCostRate: 0.9,
  recipeTolerance: 0.2,
  priceTolerance: 0.25,
  latencyP95Ms: 3000,
};

const pct = (v: number) => `${(v * 100).toFixed(2)} %`;
const pad = (s: string, n: number) => s.padEnd(n, " ");

interface GoldenItem {
  id: string;
  fixtureId: string;
  lineId: string | null;
  noLine?: boolean;
  name: string;
  amount: number | null;
  amountMax: number | null;
  unit: string | null;
  labelDefect: string | null;
  split: "dev" | "test" | "excluded";
  excluded: boolean;
}
interface GoldenLine {
  id: string;
  fixtureId: string;
  text: string;
  istZutat: boolean;
  classes: string[];
  split: "dev" | "test";
}
interface GoldenFixture {
  id: string;
  account: string | null;
  language: string | null;
  style: string | null;
  origin: string;
  excluded: boolean;
  split: "dev" | "test";
  caption: string;
  expected: {
    title: string | null;
    servings: number | null;
    servingsMax: number | null;
    stepsCount: number;
    stepsUnreliable: string | null;
    negative: boolean;
  };
}
interface GoldenFile {
  fixtures: GoldenFixture[];
  lines: GoldenLine[];
  items: GoldenItem[];
  counts: { lines: number; items: number; itemsWithDefect: number; itemsWithoutLine: number };
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(GOLDEN_DIR, file), "utf8")) as T;
}

const golden = readJson<GoldenFile>("ingredients.v1.json");

/**
 * Der Corpus wird **aus dem Golden Set** gebaut, nicht aus den Corpus-Ordnern.
 * Dadurch ist die Messung selbsttragend: sie funktioniert auch für eine lokale
 * Ablage (echte Sicherungskopie), ohne dass dort dieselben Fixture-IDs liegen.
 */
const corpus: CorpusFixture[] = golden.fixtures.map((f) => ({
  id: f.id,
  source: f.origin,
  account: f.account ?? undefined,
  language: (f.language === "en" ? "en" : "de") as "de" | "en",
  style: f.style ?? undefined,
  caption: f.caption,
  expected: {
    title: f.expected.title,
    servings: f.expected.servings,
    servingsMax: f.expected.servingsMax,
    ingredients: [],
    stepsCount: f.expected.stepsCount,
  },
  negative: f.expected.negative || undefined,
  stepsUnreliable: f.expected.stepsUnreliable ?? undefined,
  exclude: f.excluded ? "ausgeschlossen" : undefined,
}));

// ---------------------------------------------------------------- Vorprüfungen
const problems: string[] = [];
const check = (ok: boolean, message: string) => {
  if (!ok) problems.push(message);
};

check(golden.items.length === golden.counts.items, "ingredients.v1.json ist veraltet (Item-Anzahl passt nicht zu counts)");
check(golden.lines.length === golden.counts.lines, "ingredients.v1.json ist veraltet (Zeilen-Anzahl passt nicht zu counts)");

const goldenFixtureIds = new Set(golden.fixtures.map((f) => f.id));
check(goldenFixtureIds.size === golden.fixtures.length, "doppelte Fixture-IDs im Golden Set");
for (const fixture of golden.fixtures) {
  if (fixture.caption.trim().length === 0) problems.push(`Fixture ${fixture.id} hat keine Caption`);
  const items = golden.items.filter((i) => i.fixtureId === fixture.id);
  if (fixture.expected.negative) {
    check(items.length === 0, `Negativfall ${fixture.id} darf keine Labels haben`);
  } else if (!fixture.excluded) {
    check(items.length > 0, `Fixture ${fixture.id} hat keine Labels`);
  }
}

const splitOf = new Map(golden.fixtures.map((f) => [f.id, f.split]));
const devFixtures = golden.fixtures.filter((f) => !f.excluded && f.split === "dev").length;
const testFixtures = golden.fixtures.filter((f) => !f.excluded && f.split === "test").length;
const testShare = testFixtures / (devFixtures + testFixtures);
// Die Split-Regel gilt für das versionierte Golden Set. Eine lokale Messung auf
// einer echten Sicherungskopie hat keinen Tuning-Split und darf sie nicht
// verletzen.
if (!goldenArg) {
  check(testShare >= 0.2 && testShare <= 0.4, `Testanteil außerhalb 20–40 % (ist ${pct(testShare)})`);
}

function isValidSplit(value: string): boolean {
  return value === "dev" || value === "test" || value === "excluded";
}
for (const item of golden.items) check(isValidSplit(item.split), `ungültiger Split bei ${item.id}`);
for (const line of golden.lines) check(line.split === "dev" || line.split === "test", `ungültiger Split bei ${line.id}`);

// Erwartete Zutaten je Fixture aus dem Golden Set (Single Source of Truth).
// Nicht bewertet werden:
// - defekte Labels (nachweislich falsch geschrieben),
// - ausgeschlossene Fixtures,
// - Labels, die im Caption-Text gar nicht vorkommen (`noLine`). Was nicht im
//   Text steht, kann der Parser nicht finden; das zu bewerten würde die
//   Handbearbeitung der Bibliothek messen, nicht den Parser.
const expectedByFixture = new Map<string, CorpusIngredient[]>();
const defectsByFixture = new Map<string, string[]>();
let notInText = 0;
for (const item of golden.items) {
  if (item.labelDefect) {
    const list = defectsByFixture.get(item.fixtureId) ?? [];
    list.push(item.name);
    defectsByFixture.set(item.fixtureId, list);
  }
  if (item.excluded || item.labelDefect) continue;
  if (item.noLine) {
    notInText++;
    continue;
  }
  const list = expectedByFixture.get(item.fixtureId) ?? [];
  list.push({ name: item.name, amount: item.amount, amountMax: item.amountMax, unit: item.unit });
  expectedByFixture.set(item.fixtureId, list);
}

const defectCount = golden.items.filter((i) => i.labelDefect).length;
const noLineCount = golden.items.filter((i) => i.noLine).length;
check(
  golden.counts.itemsWithDefect === defectCount,
  `Defekt-Anzahl passt nicht zu counts (${golden.counts.itemsWithDefect} vs ${defectCount})`,
);
check(
  golden.counts.itemsWithoutLine === noLineCount,
  `Anzahl ohne Caption-Zeile passt nicht zu counts (${golden.counts.itemsWithoutLine} vs ${noLineCount})`,
);

// ------------------------------------------------------------------- Messung A
function evaluate(fixture: CorpusFixture): CaseScore {
  const parsed = parseRecipe(fixture.caption);
  const strategy = ensembleStrategy.parse(fixture.caption).strategy;
  const actual: ActualRecipe | null = parsed
    ? {
        title: parsed.title,
        servings: parsed.servings,
        ingredients: parsed.ingredients.map((i) => ({ amount: i.amount, unit: i.unit, name: i.name })),
        steps: parsed.steps.map((s) => s.instruction),
        strategy,
      }
    : null;

  // Defekte Labels sind auf **beiden** Seiten nicht bewertbar. Würde man nur die
  // Erwartung streichen, zählte die korrekte Parser-Ausgabe als falsch positiv
  // (genau das passierte bei „Saft of Zitrone": erwartet war der Tippfehler,
  // gelesen wurde „Saft von Zitrone"). Deshalb wird zu jedem defekten Label auch
  // die passende Parser-Zutat entfernt.
  if (actual) {
    for (const defectName of defectsByFixture.get(fixture.id) ?? []) {
      let bestIndex = -1;
      let bestScore = 0.7;
      actual.ingredients.forEach((ing, index) => {
        const score = nameMatchScore(defectName, ing.name);
        if (score >= bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });
      if (bestIndex >= 0) actual.ingredients.splice(bestIndex, 1);
    }
  }

  const expectedIngredients = expectedByFixture.get(fixture.id) ?? [];
  const filtered: CorpusFixture = { ...fixture, expected: { ...fixture.expected, ingredients: expectedIngredients } };
  return scoreCase(filtered, actual);
}

interface SplitMetrics {
  fixtures: number;
  matched: number;
  missing: number;
  extra: number;
  precision: number;
  recall: number;
  precisionMacro: number;
  recallMacro: number;
  amountUnitHits: number;
  amountUnitTotal: number;
  amountHits: number;
  amountTotal: number;
  unitHits: number;
  unitTotal: number;
}

function metricsFor(scores: CaseScore[]): SplitMetrics {
  const matched = scores.reduce((a, s) => a + s.matched.length, 0);
  const missing = scores.reduce((a, s) => a + s.missing.length, 0);
  const extra = scores.reduce((a, s) => a + s.extra.length, 0);
  let amountUnitHits = 0;
  let amountUnitTotal = 0;
  let amountHits = 0;
  let amountTotal = 0;
  let unitHits = 0;
  let unitTotal = 0;
  for (const score of scores) {
    for (const pair of score.matched as IngredientPair[]) {
      const expected = pair.expected;
      const hasAmount = expected.amount !== undefined && expected.amount !== null;
      const hasUnit = expected.unit !== undefined && expected.unit !== null;
      const amountOk = !hasAmount || amountEquals(expected.amount, pair.actual?.amount, expected.amountMax);
      const unitOk = !hasUnit || normUnit(expected.unit) === normUnit(pair.actual?.unit);
      if (hasAmount) {
        amountTotal++;
        if (amountOk) amountHits++;
      }
      if (hasUnit) {
        unitTotal++;
        if (unitOk) unitHits++;
      }
      if (hasAmount) {
        amountUnitTotal++;
        if (amountOk && unitOk) amountUnitHits++;
      }
    }
  }
  const summary = summarize(scores);
  return {
    fixtures: scores.length,
    matched,
    missing,
    extra,
    precision: matched + extra > 0 ? matched / (matched + extra) : 1,
    recall: matched + missing > 0 ? matched / (matched + missing) : 1,
    precisionMacro: summary.ingredientPrecision,
    recallMacro: summary.ingredientRecall,
    amountUnitHits,
    amountUnitTotal,
    amountHits,
    amountTotal,
    unitHits,
    unitTotal,
  };
}

const splitsToScore: ("dev" | "test")[] = MODE === "final" ? ["dev", "test"] : ["dev"];
const scoresBySplit = new Map<string, CaseScore[]>();
for (const split of splitsToScore) {
  const fixtures = corpus.filter((f) => splitOf.get(f.id) === split && !golden.fixtures.find((g) => g.id === f.id)?.excluded);
  scoresBySplit.set(split, fixtures.map(evaluate));
}

// --------------------------------------------------- Messung B/C/D (Phase 4)
interface PriceResults {
  ingredients: {
    itemId: string;
    name: string;
    status: string;
    latencyMs: number | null;
    referenceValue: number | null;
    referenceUnit: string | null;
    displayedValue: number | null;
    displayedUnit: string | null;
    missingFields: string[];
  }[];
  recipes: { fixtureId: string; fullyCovered: boolean; totalEur: number | null; referenceTotalEur: number | null }[];
}
const priceResultsPath = join(GOLDEN_DIR, "price-results.json");
const priceResults: PriceResults | null = existsSync(priceResultsPath)
  ? (JSON.parse(readFileSync(priceResultsPath, "utf8")) as PriceResults)
  : null;

interface PriceMetrics {
  displayed: number;
  withinTolerance: number;
  accuracy: number;
  coverageQuantified: number;
  coverageAll: number;
  latencyP95: number;
  recipesFullyCovered: number;
  recipesWithinTolerance: number;
  recipeRate: number;
  failuresByCause: Map<string, number>;
}

function percentiles(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function priceMetrics(results: PriceResults): PriceMetrics {
  const failures = new Map<string, number>();
  const withReference = results.ingredients.filter((i) => i.referenceValue !== null);
  const displayed = withReference.filter((i) => i.displayedValue !== null);
  let within = 0;
  for (const item of displayed) {
    const reference = item.referenceValue as number;
    const shown = item.displayedValue as number;
    if (reference > 0 && Math.abs(shown - reference) / reference <= THRESHOLDS.priceTolerance) within++;
    else failures.set("Preis außerhalb Toleranz", (failures.get("Preis außerhalb Toleranz") ?? 0) + 1);
  }
  for (const item of results.ingredients) {
    if (item.displayedValue === null) {
      const cause = item.missingFields.length > 0 ? `Beleg unvollständig (${item.missingFields.join(",")})` : `kein Preis (${item.status})`;
      failures.set(cause, (failures.get(cause) ?? 0) + 1);
    }
  }
  const covered = results.ingredients.filter((i) => i.displayedValue !== null).length;
  const quantified = results.ingredients.filter((i) => i.status !== "unquantified").length;
  const recipes = results.recipes;
  const fully = recipes.filter((r) => r.fullyCovered);
  const withinRecipe = fully.filter(
    (r) => r.totalEur !== null && r.referenceTotalEur !== null && r.referenceTotalEur > 0 &&
      Math.abs(r.totalEur - r.referenceTotalEur) / r.referenceTotalEur <= THRESHOLDS.recipeTolerance,
  );
  return {
    displayed: displayed.length,
    withinTolerance: within,
    accuracy: displayed.length > 0 ? within / displayed.length : 0,
    coverageQuantified: quantified > 0 ? covered / quantified : 0,
    coverageAll: results.ingredients.length > 0 ? covered / results.ingredients.length : 0,
    latencyP95: percentiles(results.ingredients.map((i) => i.latencyMs).filter((v): v is number => v !== null)),
    recipesFullyCovered: fully.length,
    recipesWithinTolerance: withinRecipe.length,
    recipeRate: fully.length > 0 ? withinRecipe.length / fully.length : 0,
    failuresByCause: failures,
  };
}

// ------------------------------------------------------------------- Bericht
const lines: string[] = [];
const verdicts: { label: string; value: string; ok: boolean | null }[] = [];

lines.push(`GOLDEN-SET-EVAL · Modus ${MODE.toUpperCase()}${LIVE ? " · live" : ""}`);
lines.push(`Golden Set: ${golden.fixtures.length} Rezepte, ${golden.lines.length} Zeilen, ${golden.items.length} Labels`);
lines.push(`Corpus geladen: ${corpus.length} Rezepte · Split: ${devFixtures} dev / ${testFixtures} test (ausgeschlossen: ${golden.fixtures.filter((f) => f.excluded).length})`);
lines.push(`Nicht bewertet: ${golden.items.filter((i) => i.labelDefect).length} defekte Labels · ${notInText} Labels ohne Textstelle`);
lines.push(`Vorprüfungen: ${problems.length === 0 ? "alle bestanden" : `${problems.length} VERLETZT`}`);
for (const p of problems) lines.push(`  ✗ ${p}`);
lines.push("");

lines.push("A) Zutaten-Erkennung");
for (const split of splitsToScore) {
  const scores = scoresBySplit.get(split) ?? [];
  const m = metricsFor(scores);
  lines.push(
    `  ${pad(split, 5)} ${m.fixtures} Rezepte · Precision ${pct(m.precision)} (macro ${pct(m.precisionMacro)}) · ` +
      `Recall ${pct(m.recall)} (macro ${pct(m.recallMacro)})`,
  );
  lines.push(
    `        Menge+Einheit korrekt ${m.amountUnitTotal ? pct(m.amountUnitHits / m.amountUnitTotal) : "–"} ` +
      `(Menge ${m.amountTotal ? pct(m.amountHits / m.amountTotal) : "–"}, Einheit ${m.unitTotal ? pct(m.unitHits / m.unitTotal) : "–"})`,
  );
  lines.push(`        Fehlend ${m.missing} · Zuviel ${m.extra} · Treffer ${m.matched}`);
  const top = summarize(scores);
  const fmt = (list: [string, number][], n: number) =>
    list.length === 0 ? "–" : list.slice(0, n).map(([name, count]) => `${name} (${count}×)`).join(", ");
  lines.push(`        fehlt am häufigsten:  ${fmt(top.topMissing, 6)}`);
  lines.push(`        zuviel am häufigsten: ${fmt(top.topExtra, 6)}`);
  if (top.failedCases.length > 0) lines.push(`        Rezepte mit Fehlern: ${top.failedCases.length}`);
  if (split === (MODE === "final" ? "test" : "dev")) {
    verdicts.push({ label: "A1 Precision", value: pct(m.precision), ok: m.precision >= THRESHOLDS.precision });
    verdicts.push({ label: "A2 Recall", value: pct(m.recall), ok: m.recall >= THRESHOLDS.recall });
    verdicts.push({
      label: "A3 Menge+Einheit",
      value: m.amountUnitTotal ? pct(m.amountUnitHits / m.amountUnitTotal) : "–",
      ok: m.amountUnitTotal > 0 && m.amountUnitHits / m.amountUnitTotal >= THRESHOLDS.amountUnit,
    });
  }
}
lines.push("");

lines.push("B) Preise");
if (!priceResults) {
  lines.push("  nicht verfügbar – Phase 4 hat noch keine price-results.json erzeugt");
  verdicts.push({ label: "B1 Preisgenauigkeit", value: "nicht verfügbar", ok: null });
  verdicts.push({ label: "B2 Abdeckung", value: "nicht verfügbar", ok: null });
} else {
  const p = priceMetrics(priceResults);
  lines.push(`  Genauigkeit ±${THRESHOLDS.priceTolerance * 100} %: ${pct(p.accuracy)} (${p.withinTolerance}/${p.displayed} angezeigte Preise)`);
  lines.push(`  Abdeckung preisfähig: ${pct(p.coverageQuantified)} · über alle Zutaten: ${pct(p.coverageAll)}`);
  lines.push(`  Antwortzeit p95 je Quellenaufruf: ${p.latencyP95} ms`);
  verdicts.push({ label: "B1 Preisgenauigkeit", value: pct(p.accuracy), ok: p.accuracy >= THRESHOLDS.priceAccuracy });
  verdicts.push({ label: "B2 Abdeckung", value: pct(p.coverageQuantified), ok: p.coverageQuantified >= THRESHOLDS.coverage });
  verdicts.push({ label: "D1 Antwortzeit p95", value: `${p.latencyP95} ms`, ok: p.latencyP95 > 0 && p.latencyP95 < THRESHOLDS.latencyP95Ms });
  lines.push("");
  lines.push("C) Rezepte");
  lines.push(`  voll abgedeckt: ${p.recipesFullyCovered} · davon ±${THRESHOLDS.recipeTolerance * 100} %: ${p.recipesWithinTolerance} (${pct(p.recipeRate)})`);
  verdicts.push({ label: "C Rezeptkosten", value: pct(p.recipeRate), ok: p.recipeRate >= THRESHOLDS.recipeCostRate });
  lines.push("");
  lines.push("Fehler nach Ursache");
  for (const [cause, count] of [...p.failuresByCause.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${String(count).padStart(4)}  ${cause}`);
  }
}
lines.push("");

lines.push("Schwellen");
for (const v of verdicts) {
  const mark = v.ok === null ? "…" : v.ok ? "OK" : "VERFEHLT";
  lines.push(`  ${pad(mark, 8)} ${pad(v.label, 22)} ${v.value}`);
}

const enforced = verdicts.filter((v) => v.ok !== null);
const failed = enforced.filter((v) => v.ok === false);
lines.push("");
lines.push(
  enforced.length === 0
    ? "ERGEBNIS: keine prüfbaren Schwellen"
    : failed.length === 0
      ? "ERGEBNIS: alle erreichbaren Schwellen bestanden"
      : `ERGEBNIS: NICHT BESTANDEN (${failed.map((f) => f.label).join(", ")})`,
);

if (MODE === "final") {
  const testPortion = JSON.stringify(golden.items.filter((i) => i.split === "test"));
  const hash = createHash("sha256").update(testPortion).digest("hex").slice(0, 16);
  const logPath = join(GOLDEN_DIR, "final-run.log");
  appendFileSync(
    logPath,
    `${new Date().toISOString()} testset=${hash} fixtures=${testFixtures} ergebnis=${failed.length === 0 ? "bestanden" : "verfehlt"}\n`,
    "utf8",
  );
  const previous = existsSync(logPath) ? readFileSync(logPath, "utf8").trim().split("\n").length : 0;
  lines.push(`Final-Lauf protokolliert (${logPath}). Läufe insgesamt: ${previous}`);
  if (previous > 1) lines.push("ACHTUNG: Das Testset wurde mehrfach gemessen – der Bericht muss das ausweisen.");
}

mkdirSync(GOLDEN_DIR, { recursive: true });
writeFileSync(
  join(GOLDEN_DIR, "last-run.json"),
  JSON.stringify({ mode: MODE, live: LIVE, at: new Date().toISOString(), thresholds: THRESHOLDS, verdicts, problems, table: lines }, null, 2),
  "utf8",
);

console.log(lines.join("\n"));
process.exit(failed.length > 0 || problems.length > 0 ? 1 : 0);
