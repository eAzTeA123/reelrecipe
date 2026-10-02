/**
 * Baut den Grundstock des Golden Sets aus dem vorhandenen Parser-Corpus.
 *
 * Warum aus dem Corpus: Dort liegen 463 echte Zutatenzeilen aus 42 Rezepten
 * (Instagram/TikTok-Captions), 407 davon mit handgeprüften Mengen und Einheiten.
 * Der Auftrag verlangt mindestens 200 Zeilen – der Grundstock erfüllt das.
 *
 * Drei bewusste Entscheidungen:
 * 1. **Split pro Rezept, nicht pro Zeile.** Sonst lägen Zeilen desselben Rezepts
 *    in Dev und Test, und Tuning auf Dev würde Testwissen enthalten.
 * 2. **Defekte Labels werden markiert, nicht geglättet.** Im Corpus stehen
 *    nachweislich fehlerhafte Einträge (z. B. „Saft of Zitrone" statt „Saft von
 *    Zitrone", Namen mit Bullet: „* 30 g Erythrit"). Sie werden als
 *    `labelDefect` gekennzeichnet, aus den Schwellen ausgeschlossen und dir in
 *    `labels-to-review.json` zur Korrektur vorgelegt – nicht stillschweigend
 *    übernommen.
 * 3. **Die Korrekturliste ist klein.** `ingredients.v1.json` ist die
 *    Maschinenwahrheit (alle Zeilen), `labels-to-review.json` enthält nur, was
 *    menschliche Augen braucht.
 *
 * Aufruf: node scripts/build-golden-set.mjs
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "tests", "golden");
const SOURCES = [
  { dir: join(root, "src", "parser", "corpus", "fixtures"), origin: "reference-corpus" },
  { dir: join(root, "src", "parser", "corpus", "fixtures-user"), origin: "user-stored" },
];

/** Dimension und Faktor je Einheit – Grundlage der Preisfähigkeit.
 *  In Phase 4 wird das die gemeinsame Tabelle in `src/lib/price/units.ts`. */
const UNITS = {
  kg: { dim: "mass", factor: 1000 }, g: { dim: "mass", factor: 1 }, mg: { dim: "mass", factor: 0.001 },
  l: { dim: "volume", factor: 1000 }, dl: { dim: "volume", factor: 100 }, cl: { dim: "volume", factor: 10 },
  ml: { dim: "volume", factor: 1 }, el: { dim: "volume", factor: 15 }, tl: { dim: "volume", factor: 5 },
  tasse: { dim: "volume", factor: 240 }, cup: { dim: "volume", factor: 240 },
  pfund: { dim: "mass", factor: 500 },
  stück: { dim: "count" }, stk: { dim: "count" }, zehe: { dim: "count" }, zehen: { dim: "count" },
  scheibe: { dim: "count" }, scheiben: { dim: "count" }, dose: { dim: "count" }, dosen: { dim: "count" },
  packung: { dim: "count" }, päckchen: { dim: "count" }, tüte: { dim: "count" }, glas: { dim: "count" },
  becher: { dim: "count" }, kopf: { dim: "count" }, knolle: { dim: "count" },
  prise: { dim: "unquantified" }, msp: { dim: "unquantified" }, handvoll: { dim: "unquantified" },
  bund: { dim: "unquantified" }, spritzer: { dim: "unquantified" }, tropfen: { dim: "unquantified" },
  blatt: { dim: "unquantified" }, zweig: { dim: "unquantified" }, stange: { dim: "unquantified" },
};

const PANTRY = new Set(["wasser", "salz", "pfeffer", "salz und pfeffer", "salz pfeffer", "eiswürfel"]);

/** Nur für die Zuordnung von Labels zu Zeilen – keine Laufzeitlogik. */
function normTokens(value) {
  return String(value)
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !/^\d+$/.test(t) && !(t in UNITS));
}

/** Konservative Defekterkennung: nur Muster, die fast sicher falsch sind. */
function labelDefects(name) {
  const defects = [];
  const n = String(name);
  if (/^\s*[*•+\-–]\s/.test(n)) defects.push("bullet-im-namen");
  if (/\bof\b/i.test(n)) defects.push("of-statt-von");
  if (/\b(heap|resting|juices|blend|free|large|small|medium|chopped|minced)\b/i.test(n)) defects.push("unuebersetzt");
  if (/\d+\s*(g|kg|ml|l|tl|el|stk|stück|prise|bund|dose)\b/i.test(n)) defects.push("menge-im-namen");
  if (/\b(ca\.|circa|etwa)\b/i.test(n)) defects.push("circa-im-namen");
  if (n !== n.trim() || /\s{2,}/.test(n)) defects.push("whitespace");
  return defects;
}

function classifyLine(text, itemCount) {
  const classes = [];
  const t = text.trim();
  const lower = t.toLowerCase();
  if (/folg(e|t)\s|link in bio|rabattcode|werbung|anzeige|\bcode\s+\S+|abonnier|speicher.*rezept|schick.*weiter/i.test(lower)) classes.push("promo");
  if (/^(zutaten|zubereitung|nährwerte|nahrwerte|für den|fuer den|für die|für das|teig|frosting|belag|guss|topping|außerdem|sonstiges)/i.test(lower) || /:\s*$/.test(lower)) classes.push("heading");
  if (/\b(kcal|kalorien|protein|kohlenhydrate|fett|zucker|ballaststoffe|brennwert)\b/i.test(lower) && /\d/.test(t)) classes.push("nutrition");
  if (/^\d+[.)]\s/.test(t)) classes.push("step");
  if (/^#/.test(t) || (t.split(/\s+/).length > 1 && t.split(/\s+/).every((w) => w.startsWith("#")))) classes.push("hashtag");
  if (/\bprise\b|\bhandvoll\b|\bbund\b|\bmsp\b|\betwas\b|\bein wenig\b|\bein paar\b/i.test(lower)) classes.push("unquantified-unit");
  if (/nach geschmack|nach belieben|nach wunsch|optional|evtl|ggf|zum garnieren|zum servieren|zur deko/i.test(lower)) classes.push("to-taste");
  if (/[½¼¾⅓⅔⅛⅜⅝⅞]|\b\d+\s?\/\s?\d+\b/.test(t)) classes.push("fraction");
  if (/\b\d+\s*(?:-|–|bis|to)\s*\d+\b/i.test(t)) classes.push("range");
  if (itemCount > 1) classes.push("multi-item-line");
  if (itemCount === 0) classes.push("no-expected-item");
  if (itemCount > 0) classes.push("has-item");
  return classes;
}

function loadFixtures() {
  const fixtures = [];
  for (const source of SOURCES) {
    for (const file of readdirSync(source.dir).filter((f) => f.endsWith(".json")).sort()) {
      const raw = JSON.parse(readFileSync(join(source.dir, file), "utf8"));
      for (const fixture of Array.isArray(raw) ? raw : [raw]) {
        fixtures.push({ ...fixture, id: fixture.id ?? file.replace(/\.json$/, ""), origin: source.origin });
      }
    }
  }
  return fixtures;
}

const fixtures = loadFixtures();

// Split pro Rezept, deterministisch, nach Konto stratifiziert (30 % Test).
const fixtureSplit = new Map();
for (const fixture of fixtures) {
  const hash = createHash("sha1").update(fixture.id).digest("hex").slice(0, 8);
  fixtureSplit.set(fixture.id, parseInt(hash, 16) % 100 < 70 ? "dev" : "test");
}

const lines = [];
const items = [];

for (const fixture of fixtures) {
  const caption = typeof fixture.caption === "string" ? fixture.caption : "";
  const expected = Array.isArray(fixture.expected?.ingredients) ? fixture.expected.ingredients : [];
  const excluded = typeof fixture.exclude === "string" && fixture.exclude.length > 0;
  const split = fixtureSplit.get(fixture.id);

  const rawLines = caption.split(/\r?\n/);
  const lineTokens = rawLines.map((l) => normTokens(l));
  const itemToLine = new Map();

  expected.forEach((item, itemIndex) => {
    const need = normTokens(item.name ?? "");
    let best = null;
    rawLines.forEach((_, lineIndex) => {
      if (need.length === 0) return;
      const have = new Set(lineTokens[lineIndex]);
      if (!need.every((t) => have.has(t))) return;
      if (!best || need.length > best.overlap) best = { lineIndex, overlap: need.length };
    });
    if (best) itemToLine.set(itemIndex, best.lineIndex);
  });

  rawLines.forEach((text, index) => {
    if (text.trim() === "") return;
    const lineId = `${fixture.id}#${index}`;
    const matched = expected
      .map((item, itemIndex) => ({ item, itemIndex }))
      .filter(({ itemIndex }) => itemToLine.get(itemIndex) === index);
    const classes = classifyLine(text, matched.length);

    lines.push({
      id: lineId,
      fixtureId: fixture.id,
      index,
      text,
      istZutat: matched.length > 0,
      istZutatSource: "derived",
      classes,
      reviewPriority:
        matched.length > 0 ||
        classes.some((c) => ["promo", "heading", "nutrition", "step", "unquantified-unit", "to-taste"].includes(c))
          ? "high"
          : "low",
      split,
      excluded,
    });

    matched.forEach(({ item }) => {
      const defects = labelDefects(item.name ?? "");
      items.push({
        id: `${lineId}:${item.name}`,
        fixtureId: fixture.id,
        lineId,
        name: item.name,
        amount: item.amount ?? null,
        amountMax: item.amountMax ?? null,
        unit: item.unit ?? null,
        origin: fixture.origin,
        labelDefect: defects.length > 0 ? defects.join("+") : null,
        split: defects.length > 0 ? "excluded" : split,
        excluded,
      });
    });
  });

  // Erwartete Zutaten ohne Caption-Zeile: meist defekte Labels – sie dürfen
  // nicht verschwinden, sonst wäre die Wahrheit unvollständig. `noLine` und
  // `labelDefect` sind bewusst **unabhängig** (ein Label kann beides sein).
  expected.forEach((item, itemIndex) => {
    if (itemToLine.has(itemIndex)) return;
    const defects = labelDefects(item.name ?? "");
    items.push({
      id: `${fixture.id}#unmatched:${item.name}`,
      fixtureId: fixture.id,
      lineId: null,
      noLine: true,
      name: item.name,
      amount: item.amount ?? null,
      amountMax: item.amountMax ?? null,
      unit: item.unit ?? null,
      origin: fixture.origin,
      labelDefect: defects.length > 0 ? defects.join("+") : null,
      split: "excluded",
      excluded,
    });
  });
}

function priceability(item) {
  const unit = String(item.unit ?? "").toLowerCase().replace(/\.$/, "");
  const def = UNITS[unit];
  const dim = def?.dim ?? (unit === "" ? "unquantified" : "unknown");
  const pantry = PANTRY.has(String(item.name ?? "").toLowerCase().trim());
  return { unit, dim, pantry, priceable: dim === "mass" || dim === "volume" || dim === "count" };
}

const byName = new Map();
for (const item of items) {
  const name = String(item.name ?? "").trim();
  if (!name) continue;
  const key = name.toLowerCase();
  const entry = byName.get(key) ?? { name, occurrences: 0, units: new Map(), dims: new Set(), pantry: false, defect: null };
  const p = priceability(item);
  entry.occurrences++;
  entry.pantry = entry.pantry || p.pantry;
  entry.dims.add(p.dim);
  entry.defect = entry.defect ?? item.labelDefect;
  const key2 = `${item.amount ?? "?"} ${item.unit ?? "(ohne)"}`;
  entry.units.set(key2, (entry.units.get(key2) ?? 0) + 1);
  byName.set(key, entry);
}

const priceableNames = [...byName.values()]
  .filter((e) => !e.pantry && !e.defect && [...e.dims].some((d) => d === "mass" || d === "volume" || d === "count"))
  .sort((a, b) => b.occurrences - a.occurrences);

const referenceProposal = priceableNames.slice(0, 150).map((e) => {
  const common = [...e.units.entries()].sort((a, b) => b[1] - a[1])[0];
  const dims = [...e.dims].filter((d) => d !== "unknown");
  return {
    name: e.name,
    occurrences: e.occurrences,
    dimensions: dims,
    mostCommonQuantity: common ? common[0] : null,
    note: dims.length > 1 ? "mehrere Dimensionen – Referenz je Dimension nötig" : null,
    reference: { pricePerBaseUnit: null, currency: "EUR", shop: null, date: null, url: null, packageSize: null },
    skip: false,
  };
});

// Korrekturliste: nur was menschliche Augen braucht.
// Zutatenzeilen brauchen keine Zeilenprüfung – ihre Labels stammen aus deiner
// geprüften Bibliothek (sie stehen vollständig in items[]). Zu prüfen sind die
// **Nicht**-Zutaten-Zeilen (dort drohen falsch Positive) und die Defekte.
const defectItems = items.filter((i) => i.labelDefect);
const unmatchedItems = items.filter((i) => i.noLine);
const REVIEW_CAP = { nutrition: 20, heading: 20, step: 12, promo: 10, hashtag: 5, "unquantified-unit": 10, "to-taste": 10, sonstiges: 8 };
const reviewSample = [];
const seenClasses = new Map();
for (const line of lines) {
  if (line.reviewPriority !== "high" || line.istZutat) continue;
  const key = line.classes.filter((c) => c !== "no-expected-item").join("+") || "sonstiges";
  const cap = REVIEW_CAP[key] ?? Object.entries(REVIEW_CAP).reduce((acc, [k, v]) => (key.includes(k) ? Math.max(acc, v) : acc), 0);
  const count = seenClasses.get(key) ?? 0;
  if (count >= (cap || 8)) continue;
  seenClasses.set(key, count + 1);
  reviewSample.push({
    lineId: line.id,
    text: line.text,
    vorschlagIstZutat: line.istZutat,
    klasse: key,
    korrekturIstZutat: null,
    korrekturName: null,
    korrekturMenge: null,
    korrekturEinheit: null,
  });
}

mkdirSync(OUT_DIR, { recursive: true });

writeFileSync(
  join(OUT_DIR, "ingredients.v1.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      purpose:
        "Golden Set für Zutaten-Erkennung und Preise. items[] sind Labels (Herkunft in `origin`), lines[].istZutat ist ein Vorschlag. Einträge mit split=\"excluded\" zählen nicht zu den Schwellen.",
      generatedFrom: { parserVersion: 15, fixtureCount: fixtures.length, sources: SOURCES.map((s) => s.dir.replace(/\\/g, "/").replace(root.replace(/\\/g, "/") + "/", "")) },
      fixtures: fixtures.map((f) => ({ id: f.id, account: f.account ?? null, language: f.language ?? null, style: f.style ?? null, origin: f.origin, excluded: typeof f.exclude === "string", split: fixtureSplit.get(f.id) })),
      counts: {
        lines: lines.length,
        linesWithItem: lines.filter((l) => l.istZutat).length,
        items: items.length,
        itemsWithDefect: defectItems.length,
        itemsWithoutLine: unmatchedItems.length,      },
      lines,
      items,
    },
    null,
    2,
  ),
  "utf8",
);

writeFileSync(
  join(OUT_DIR, "labels-to-review.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      instructions:
        "Nur die Abschnitte unten prüfen. Zutatenzeilen gelten als bestätigt, weil ihre Labels aus deiner geprüften Bibliothek stammen (sie stehen vollständig in ingredients.v1.json → items[]). Zu tun ist: (1) defekte Labels korrigieren, (2) Labels ohne Caption-Zeile korrigieren, (3) bei den Zeilen-Vorschlägen die Nicht-Zutaten prüfen – dort drohen falsch Positive.",
      sections: {
        defekteLabels: { hint: "Labels, die im Corpus fehlerhaft sind (z. B. „Saft of Zitrone\"). Bitte korrekten Namen eintragen oder skip setzen.", rows: defectItems.map((i) => ({ itemId: i.id, fixtureId: i.fixtureId, label: i.name, menge: i.amount, einheit: i.unit, defekt: i.labelDefect, korrekturName: null, skip: false })) },
        labelsOhneZeile: { hint: "Erwartete Zutat ließ sich keiner Caption-Zeile zuordnen – meist dieselbe Ursache.", rows: unmatchedItems.map((i) => ({ itemId: i.id, fixtureId: i.fixtureId, label: i.name, defekt: i.labelDefect, korrekturName: null, skip: false })) },
        zeilen: { hint: "Zeilen-Vorschläge für `ist_zutat`. Zutatenzeilen vollständig, Nicht-Zutaten stichprobenartig je Klasse.", rows: reviewSample },
      },
    },
    null,
    2,
  ),
  "utf8",
);

writeFileSync(
  join(OUT_DIR, "reference-prices.v1.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      instructions:
        "Je Zeile den belegten Referenzpreis eintragen: pricePerBaseUnit (EUR je kg, l oder Stück), shop (z. B. Lidl), date (JJJJ-MM-TT) und url. Zeilen ohne Beleg auf skip=true. Mindestens 100 Zutaten müssen ausgefüllt sein.",
      requiredFilled: 100,
      candidates: referenceProposal.length,
      prices: referenceProposal,
    },
    null,
    2,
  ),
  "utf8",
);

const classCounts = {};
for (const line of lines) for (const c of line.classes) classCounts[c] = (classCounts[c] ?? 0) + 1;

writeFileSync(
  join(OUT_DIR, "build-report.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      fixtures: fixtures.length,
      lines: lines.length,
      items: items.length,
      split: {
        fixtures: { dev: [...fixtureSplit.values()].filter((s) => s === "dev").length, test: [...fixtureSplit.values()].filter((s) => s === "test").length },
        items: { dev: items.filter((i) => i.split === "dev").length, test: items.filter((i) => i.split === "test").length, excluded: items.filter((i) => i.split === "excluded").length },
        lines: { dev: lines.filter((l) => l.split === "dev").length, test: lines.filter((l) => l.split === "test").length },
      },
      problemClasses: classCounts,
      labelDefects: defectItems.length,
      labelDefectsByName: defectItems.map((i) => `${i.fixtureId} :: ${i.name} << ${i.labelDefect}`),
      priceability: {
        quantified: items.filter((i) => priceability(i).priceable).length,
        unquantified: items.filter((i) => priceability(i).dim === "unquantified").length,
        unknownUnit: items.filter((i) => priceability(i).dim === "unknown").length,
        pantry: items.filter((i) => priceability(i).pantry).length,
        distinctPriceableNames: priceableNames.length,
      },
      reviewRows: { defects: defectItems.length, unmatched: unmatchedItems.length, lines: reviewSample.length },
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`Fixtures: ${fixtures.length} (dev ${[...fixtureSplit.values()].filter((s) => s === "dev").length} / test ${[...fixtureSplit.values()].filter((s) => s === "test").length})`);
console.log(`Zeilen:   ${lines.length} (davon Zutatenzeilen ${lines.filter((l) => l.istZutat).length})`);
console.log(`Labels:   ${items.length} (defekt ${defectItems.length}, ohne Zeile ${unmatchedItems.length}, dev ${items.filter((i) => i.split === "dev").length} / test ${items.filter((i) => i.split === "test").length})`);
console.log(`preisfähige verschiedene Namen: ${priceableNames.length} (Vorschlagsliste ${referenceProposal.length})`);
console.log(`Korrekturzeilen: ${reviewSample.length + defectItems.length + unmatchedItems.length}`);
