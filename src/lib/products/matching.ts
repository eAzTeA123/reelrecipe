import type { Nutrition100, PackageSize, QuantityKind } from "@/domain/productTypes";

/** Mindest-Sicherheit, ab der ein Produkt für Preis/Nährwerte verwendet wird */
export const MATCH_THRESHOLD = 0.8;

/** Grundzutaten, die nicht bepreist werden (Vorrat bzw. Leitungswasser) */
const PANTRY = new Set(["wasser", "salz", "pfeffer", "salz und pfeffer", "salz pfeffer", "eiswürfel", "water", "salt", "pepper"]);

/** Beschreibende Wörter, die für die Produktsuche irrelevant sind */
const DESCRIPTORS = new Set([
  "frisch", "frische", "frischer", "frisches", "fein", "feine", "grob", "gehackt", "gehackte", "gerieben",
  "geriebener", "geriebenen", "gewürfelt", "gewürfelte", "getrocknet", "getrocknete", "gekocht", "gekochte",
  "groß", "große", "großer", "klein", "kleine", "kleiner", "mittelgroß", "mittelgroße", "reif", "reife",
  "weich", "weiche", "kalt", "kalte", "warm", "warme", "zimmerwarm", "nativ", "natives", "extra", "vergine",
  "tk", "bio", "etwas", "ca", "einige", "evtl", "optional", "nach", "belieben", "geschmack", "und", "oder",
  "mit", "ohne", "für", "zum", "zur", "der", "die", "das", "den", "dem", "ein", "eine", "einer", "von",
  "in", "im", "am", "auf", "aus", "als", "je", "pro",
  "rot", "rote", "roter", "gelb", "gelbe", "grün", "grüne", "weiß", "weiße", "schwarz", "schwarzer",
  "fresh", "chopped", "minced", "large", "small", "medium", "of", "the", "a",
]);

/**
 * Wortteile, die aus einer Zutat ein anderes Produkt machen
 * (Hähnchen → Hähnchenbrühe, Paprika → Paprikapulver, Tomate → Tomatenmark).
 * Taucht so ein Teil im Produktnamen auf, aber nicht in der Zutat, wird abgewertet.
 */
const FORM_CHANGERS = [
  "pulver", "mark", "brühe", "bruehe", "fond", "saft", "sirup", "soße", "sosse", "sauce", "chips", "paste",
  "aroma", "extrakt", "gewürz", "würz", "snack", "riegel", "creme", "aufstrich", "suppe", "salat", "pesto",
  "flocken", "mehl", "öl", "essig", "konfitüre", "marmelade", "getränk", "drink", "joghurt", "eis",
  "schokolade", "keks", "kuchen", "pizza", "fertig", "mischung", "spieß", "wurst", "chutney",
  "scheiben", "aufschnitt", "geräuchert", "nuggets", "wiener", "salami", "schinken",
];

/** Erlaubte Endungen, wenn der Produkt-Token mit der Zutat beginnt (Hähnchenbrust → Hähnchenbrustfilet) */
const OK_SUFFIXES = ["", "n", "en", "e", "s", "filet", "filets", "teilstück", "teilstücke", "stücke", "streifen", "würfel", "hälften"];
/** Erlaubte Endungen, wenn die Zutat mit dem Produkt-Token beginnt (Knoblauchzehen → Knoblauch) */
const INGREDIENT_UNIT_SUFFIXES = ["zehe", "zehen", "stange", "stangen", "blätter", "bund", "knolle", "knollen", "schote", "schoten"];
/** Sorten-Präfixe, bei denen ein längeres Produktwort dieselbe Zutat meint (Kirschtomaten ⊂ Tomaten) */
const VARIETY_PREFIXES = ["kirsch", "cherry", "rispen", "strauch", "roma", "cocktail", "gemüse", "spitz", "speise", "rinder", "schweine", "hähnchen", "puten", "voll", "fett", "mager", "block", "süß"];

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(s: string): string[] {
  return normalizeText(s).split(" ").filter((t) => t.length > 1 && !/^\d+$/.test(t));
}

/** Kernwörter einer Zutat für Suche und Abgleich */
export function ingredientCoreTokens(name: string): string[] {
  return tokenize(name).filter((t) => !DESCRIPTORS.has(t));
}

export function isPantryIngredient(name: string): boolean {
  const n = normalizeText(name);
  if (PANTRY.has(n)) return true;
  const core = ingredientCoreTokens(name).join(" ");
  return PANTRY.has(core);
}

/** Suchbegriff für die Produktsuche */
export function searchTermFor(name: string, notes?: string): string {
  const main = ingredientCoreTokens(name).join(" ");
  if (!notes) return main;
  const noteTokens = ingredientCoreTokens(notes).filter((t) => !main.includes(t));
  return noteTokens.length ? `${main} ${noteTokens.join(" ")}` : main;
}

/** Fallback-Suchbegriff, wenn der erste keine Preise liefert: nur das letzte/spezifischste Kernwort */
export function fallbackSearchTermFor(name: string): string {
  const tokens = ingredientCoreTokens(name);
  // Nomen meist am Ende; bei Zutaten wie "Chilischoten" bleibt das Wort erhalten
  if (tokens.length === 0) return name.trim().toLowerCase();
  if (tokens.length === 1) return tokens[0];
  // Zusammengesetzte Begriffe wie "Knoblauchzehen" -> "Knoblauch" probieren
  const withUnitRemoved = tokens.map((t) => t.replace(/(zehe|zehen|stange|stangen|schote|schoten|blätter|bund)$/i, "")).filter(Boolean);
  if (withUnitRemoved.length > 0 && withUnitRemoved.join(" ") !== tokens.join(" ")) {
    return withUnitRemoved.join(" ");
  }
  return tokens.slice(-2).join(" ");
}

function tokenScore(core: string, p: string): number {
  if (p === core) return 1;
  if (p.startsWith(core)) {
    const suffix = p.slice(core.length);
    if (OK_SUFFIXES.includes(suffix)) return 0.92;
    return 0;
  }
  if (core.startsWith(p) && p.length >= 4) {
    const suffix = core.slice(p.length);
    if (INGREDIENT_UNIT_SUFFIXES.includes(suffix) || OK_SUFFIXES.includes(suffix)) return 0.9;
    return 0;
  }
  if (p.endsWith(core) && core.length >= 4) {
    const prefix = p.slice(0, p.length - core.length);
    if (VARIETY_PREFIXES.includes(prefix)) return 0.85;
    return 0;
  }
  return 0;
}

/**
 * Bewertet, wie sicher ein Produktname dieselbe Zutat meint (0–1).
 * Bewusst streng: lieber kein Treffer als ein falscher Preis.
 */
export function scoreProductName(ingredientName: string, productName: string): number {
  const core = ingredientCoreTokens(ingredientName);
  const prod = tokenize(productName);
  if (core.length === 0 || prod.length === 0) return 0;

  let sum = 0;
  for (const c of core) {
    let best = 0;
    for (const p of prod) best = Math.max(best, tokenScore(c, p));
    sum += best;
  }
  let score = sum / core.length;
  if (score === 0) return 0;

  const ingredientNorm = normalizeText(ingredientName);
  const changed = FORM_CHANGERS.some(
    (f) => !ingredientNorm.includes(f) && prod.some((p) => p.includes(f) && !core.some((c) => c.includes(f))),
  );
  if (changed) score *= 0.3;

  // Viele zusätzliche Wörter (Fertiggerichte, Mischungen) leicht abwerten
  const extra = Math.max(0, prod.length - core.length - 2);
  score -= Math.min(0.15, extra * 0.04);

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

/** Menge einer Zutat in einer vergleichbaren Basiseinheit */
export function toBaseQuantity(amount?: number, unit?: string): { amount: number; kind: QuantityKind } | undefined {
  if (amount === undefined || !Number.isFinite(amount) || amount <= 0) return undefined;
  const u = (unit ?? "").toLowerCase().replace(/\.$/, "").trim();
  if (u === "kg") return { amount: amount * 1000, kind: "mass" };
  if (u === "g" || u === "gramm") return { amount, kind: "mass" };
  if (u === "l" || u === "liter") return { amount: amount * 1000, kind: "volume" };
  if (u === "ml" || u === "milliliter") return { amount, kind: "volume" };
  if (u === "cl") return { amount: amount * 10, kind: "volume" };
  if (u === "el" || u === "esslöffel" || u === "tbsp") return { amount: amount * 15, kind: "volume" };
  if (u === "tl" || u === "teelöffel" || u === "tsp") return { amount: amount * 5, kind: "volume" };
  if (u === "" || u === "stück" || u === "stk" || u === "st") return { amount, kind: "count" };
  return undefined;
}

/**
 * Packungsgröße aus Open-Food-Facts-Angaben ("600g", "4 x 125 g", "1 l", "10 Stück").
 */
export function parsePackageSize(quantity?: string, productQuantity?: number | string, productQuantityUnit?: string): PackageSize | undefined {
  const pq = typeof productQuantity === "string" ? parseFloat(productQuantity.replace(",", ".")) : productQuantity;
  if (pq && Number.isFinite(pq) && pq > 0 && productQuantityUnit) {
    const base = toBaseQuantity(pq, productQuantityUnit);
    if (base) return base;
  }
  if (!quantity) return undefined;
  const q = quantity.toLowerCase().replace(",", ".");
  const multi = q.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)\b/);
  if (multi) {
    const base = toBaseQuantity(parseInt(multi[1], 10) * parseFloat(multi[2]), multi[3]);
    if (base) return base;
  }
  const single = q.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l|stück|stk|st)\b/);
  if (single) return toBaseQuantity(parseFloat(single[1]), single[2]);
  return undefined;
}

export interface CostResult {
  packagesNeeded: number;
  shoppingCost: number;
  ingredientCost?: number;
  amountUnclear: boolean;
}

/**
 * Trennt Einkaufswert (ganze Packungen) und Zutatenwert (verbrauchter Anteil).
 * Bei nicht vergleichbaren Einheiten wird eine Packung angenommen und der
 * Zutatenwert bleibt leer (amountUnclear).
 */
export function computeCost(
  need: { amount: number; kind: QuantityKind } | undefined,
  pkg: PackageSize | undefined,
  price: number,
  basis: "package" | "kilogram" | "unit" = "package",
): CostResult {
  const round = (n: number) => Math.round(n * 100) / 100;
  if (basis === "kilogram") {
    if (need && need.kind !== "count") {
      const cost = round((need.amount / 1000) * price);
      return { packagesNeeded: 1, shoppingCost: cost, ingredientCost: cost, amountUnclear: false };
    }
    return { packagesNeeded: 1, shoppingCost: round(price), amountUnclear: true };
  }
  if (basis === "unit") {
    if (need && need.kind === "count") {
      const cost = round(need.amount * price);
      return { packagesNeeded: Math.ceil(need.amount), shoppingCost: cost, ingredientCost: cost, amountUnclear: false };
    }
    return { packagesNeeded: 1, shoppingCost: round(price), amountUnclear: true };
  }
  const comparable =
    need && pkg && (need.kind === pkg.kind || (need.kind !== "count" && pkg.kind !== "count"));
  if (!comparable || !need || !pkg) {
    return { packagesNeeded: 1, shoppingCost: round(price), amountUnclear: true };
  }
  const fraction = need.amount / pkg.amount;
  const packagesNeeded = Math.max(1, Math.ceil(fraction - 1e-9));
  return {
    packagesNeeded,
    shoppingCost: round(packagesNeeded * price),
    ingredientCost: round(fraction * price),
    amountUnclear: false,
  };
}

/** Nährwertbeitrag einer Zutat (g bzw. ml ≈ g) */
export function scaleNutrition(n: Nutrition100, grams: number): Nutrition100 {
  const f = grams / 100;
  const out: Nutrition100 = {};
  for (const [k, v] of Object.entries(n) as [keyof Nutrition100, number | undefined][]) {
    if (typeof v === "number") out[k] = v * f;
  }
  return out;
}

export function addNutrition(a: Nutrition100, b: Nutrition100): Nutrition100 {
  const out: Nutrition100 = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof Nutrition100, number | undefined][]) {
    if (typeof v === "number") out[k] = (out[k] ?? 0) + v;
  }
  return out;
}
