import type { Ingredient } from "@/domain/types";
import { newId } from "@/lib/text";
import { stripLeadingBullets } from "./normalize";
import { getAllVocab } from "./vocabulary";
import { UNIT_REGEX, UNIT_START_REGEX, canonicalUnit } from "./units";
import { AMOUNT_REGEX, parseAmountString, wordToNumber } from "./quantity";

const STEP_VERBS = new Set(getAllVocab().stepVerbs);

export interface ParsedIngredient {
  amount?: number;
  unit?: string;
  name: string;
  notes?: string;
  uncertain: boolean;
}

const STEP_VERB_HINTS = /^(den|die|das|in|im|mit|auf|bei|dann|danach|anschließend|anschliessend|zuerst|nun|jetzt|alles|zum|vorsichtig|gut)\b/i;

/** Überschriften, die niemals eine Zutat sind ("Pro Portion (4 Portionen):"). */
const NUTRITION_OR_PORTION_HEADER_RE =
  /^(?:pro|je)\s+portion\b|^(?:nährwerte|nährwertangaben|nutrition|macros?|makros?)\b/i;

function splitNameAndNotes(rest: string): { name: string; notes?: string } {
  let r = rest.trim();
  const notes: string[] = [];
  // (optional), (ca. 2 cm) etc. ans Ende
  const parens = r.match(/\(([^)]{1,120})\)\s*$/) || r.match(/\(([^)]{1,120})\)/);
  if (parens) {
    notes.push(parens[1].trim());
    r = r.replace(parens[0], "").trim();
  }

  // "Laugenstangen -> jeweils 100g"
  const arrowMatch = r.match(/\s*(?:->|–>|=>)\s*(.+)$/);
  if (arrowMatch) {
    notes.push(arrowMatch[1].trim());
    r = r.slice(0, arrowMatch.index).trim();
  }

  // Zubereitungs-Qualifier gehören in die Notizen, nicht in den Namen
  // ("Salz nach Geschmack", "Petersilie zum Garnieren").
  const qualifier = r.match(
    /\s+(nach\s+Geschmack|nach\s+Belieben|nach\s+Wunsch|zum\s+Garnieren|zum\s+Servieren|zur\s+Deko|optional|evtl\.?|ggf\.?)$/i,
  );
  if (qualifier) {
    notes.push(qualifier[1].trim());
    r = r.slice(0, qualifier.index).trim();
  }

  // "Hähnchenbrust, in Streifen geschnitten" → name + notes
  // Ignoriere Dezimalkommas in Zahlen (z. B. "0,2% Fett")
  let comma = -1;
  for (let i = 0; i < r.length; i++) {
    if (r[i] === ",") {
      const prevIsDigit = i > 0 && /\d/.test(r[i - 1]);
      const nextIsDigit = i < r.length - 1 && /\d/.test(r[i + 1]);
      if (!(prevIsDigit && nextIsDigit)) {
        comma = i;
        break;
      }
    }
  }

  if (comma > 0) {
    const tail = r.slice(comma + 1).trim();
    // Deutsche Zutatenlisten schreiben Nomen groß: "Zero, Protein Chips" ist ein
    // Name, "Schinkenwürfel, mager" dagegen Name + Hinweis.
    const tailIsName = /^[\p{Lu}\d„"]/u.test(tail);
    if (tail.length >= 2 && tailIsName) {
      r = `${r.slice(0, comma).trim()} ${tail}`;
    } else if (tail.length >= 2) {
      notes.push(tail.replace(/\.$/, ""));
      r = r.slice(0, comma).trim();
    }
  }
  r = r.replace(/^[–\-:;,\s.]+/, "").replace(/[\s.,;]+$/, "");
  // Emojis am Namensende sind Deko ("Zero Protein Chips ❤️")
  r = r.replace(/[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u, "");
  // Angehängtes Kochverb aus einer Ein-Zeilen-Liste entfernen
  // ("80ml Wasser vermengen" → "Wasser"), aber "Öl zum Braten" bleibt.
  const words = r.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && !/^(?:zum|zur|mit|in|für|und|oder)$/i.test(words[words.length - 2] ?? "")) {
    const last = words[words.length - 1].toLowerCase().replace(/[.,;!]+$/, "");
    if (STEP_VERBS.has(last)) r = words.slice(0, -1).join(" ");
  }
  return { name: r, notes: notes.length ? notes.join(", ") : undefined };
}

const SERVINGS_HEADER_RE = /^(?:(?:für|for|serves?|yields?|ergibt)\s*)?(?:ca\.?\s*|about\s*)?\d{1,2}\s*(?:portionen?|pers(?:onen)?\.?|servings?|people|persons|stücke?|tacos?|portion|stück|person)\s*:?$/i;
const TIME_DESC_RE = /(?:\bunter\s*\d+\s*min|\b\d+\s*(?:minuten?|minutes?|min\.?|stunden?|hours?|std\.?)\b|\b\d+\s*(?:°C|grad|celsius|f|fahrenheit)\b|\bhigh\s*protein\b|\bkalorienarm\b)/i;

const COMPACT_REGEX = new RegExp(`^(\\d+[.,]?\\d*(?:\\s+\\d+\\/\\d+|\\/\\d+)?)\\s*(${UNIT_REGEX.source})(?:\\s+(.+))?$`, "iu");
const TRAILING_REGEX = new RegExp(`^(.{2,80}?)\\s+(\\d+[.,]?\\d*(?:\\s+\\d+\\/\\d+|\\/\\d+)?)\\s*(${UNIT_REGEX.source})$`, "iu");
const NUTRITION_RE = /\b(?:kcal|kalorien|kohlenhydrate|carbs)\b|^(?:eiweiß|protein|fett|fat)\s*(?:ca\.?|approx\.?|:|-)?\s*\d+\s*g\b|\b\d+\s*g\s*(?:eiweiß|protein|fett|fat)\b/i;

/** Parst eine Zeile zu einer Zutat. Gibt null zurück, wenn unmöglich. */
export function parseIngredientLine(line: string): ParsedIngredient | null {
  // Chefkoch-Pluralschreibweise "Scheibe/n", "Zehe/n", "Ei/er" und "Scheibe(n)" → "Scheiben", "Zehen", "Eier"
  let rest = line
    .trim()
    .replace(/(\p{L})\/(n|en|e|s|er)(?![\p{L}])/gu, "$1$2")
    .replace(/\s*\(\s*n\s*\)/giu, "n");
  if (!rest || rest.length > 160) return null;

  // Servings-Zeilen niemals als Zutat werten (z. B. "Für 4 Stück:")
  if (SERVINGS_HEADER_RE.test(rest)) return null;

  // Reine Zeit- oder Werbebeschreibungen ohne Zutateneigenschaften verwerfen
  if (!AMOUNT_REGEX.test(rest) && TIME_DESC_RE.test(rest)) return null;

  // Nährwertangaben verwerfen
  if (NUTRITION_RE.test(rest)) return null;
  if (NUTRITION_OR_PORTION_HEADER_RE.test(stripLeadingBullets(rest))) return null;

  let amount: number | undefined;
  let unit: string | undefined;
  let uncertain = false;

  rest = stripLeadingBullets(rest);
  rest = rest.replace(/^(?:ca\.?|circa|zirka|etwa|rund|ungefähr|approximately|approx\.?)\s+/i, "");
  rest = rest.replace(/^(?:optional|alternativ|evtl\.?|ggf\.?|nach Belieben|nach Geschmack|etwas|ein paar|ein wenig|ev\.?)\s+/i, "");
  // "restlichen 100g Vanille Protein Pudding" → dieselbe Zutat wie oben, "restlichen" ist Hinweis
  rest = rest.replace(/^restliche[nrs]?\s+/i, "");

  // Reine Multiplikator-Zeile ("4x:", "2x") ist eine Zwischenüberschrift, keine Zutat
  if (/^\d{1,2}\s*[x×]\s*:?$/i.test(rest)) return null;

  // 0) Multiplikator: "4x 100g Hähnchen Filet" → 400 g Hähnchen Filet
  const multiplierMatch = rest.match(/^(\d{1,2})\s*[x×]\s+(\d+[.,]?\d*)\s*(\p{L}{1,8}\.?)\s+(.+)$/u);
  if (multiplierMatch) {
    const count = parseInt(multiplierMatch[1], 10);
    const unitPerItem = canonicalUnit(multiplierMatch[3]);
    if (count > 0 && unitPerItem) {
      amount = Math.round(count * parseFloat(multiplierMatch[2].replace(",", ".")) * 100) / 100;
      unit = unitPerItem;
      rest = multiplierMatch[4].trim();
    }
  }

  // 1) Zahl am Anfang: "500 g Mehl", "2 Eier", "1 1/2 Tassen Reis"
  const amountMatch = amount === undefined ? rest.match(AMOUNT_REGEX) : null;
  if (amountMatch) {
    amount = parseAmountString(amountMatch[0]);
    rest = rest.slice(amountMatch[0].length).trim();
    rest = rest.replace(/^[x×]\s+(?=\p{L})/iu, "");
    const unitMatch = rest.match(UNIT_START_REGEX);
    if (unitMatch) {
      unit = canonicalUnit(unitMatch[1]);
      rest = rest.slice(unitMatch[0].length).trim();
      rest = rest.replace(/^(of|von)\s+/i, "");
    }
  } else if (amount === undefined) {
    // 1b) Kompakte Zahl+Einheit am Anfang ohne Leerzeichen: "500g Mehl", "250ml Milch"
    const compactMatch = rest.match(COMPACT_REGEX);
    if (compactMatch && compactMatch[3]) {
      amount = parseAmountString(compactMatch[1]);
      unit = canonicalUnit(compactMatch[2]);
      rest = compactMatch[3].trim();
      rest = rest.replace(/^(of|von)\s+/i, "");
    } else {
      // 2) Wortzahl + Einheit: "eine Prise Salz", "two cups flour"
      const wordMatch = rest.match(/^([a-zA-ZäöüÄÖÜß]+)\s+/);
      if (wordMatch) {
        const wnum = wordToNumber(wordMatch[1]);
        const after = rest.slice(wordMatch[0].length);
        const unitMatch = after.match(UNIT_START_REGEX);
        if (wnum !== undefined && unitMatch) {
          amount = wnum;
          unit = canonicalUnit(unitMatch[1]);
          rest = after.slice(unitMatch[0].length).trim();
          rest = rest.replace(/^(of|von)\s+/i, "");
        }
      }
      // 3) Einheit am Anfang ohne Zahl: "Prise Salz", "Bund Petersilie"
      if (amount === undefined) {
        const unitMatch = rest.match(UNIT_START_REGEX);
        if (unitMatch) {
          amount = 1;
          unit = canonicalUnit(unitMatch[1]);
          rest = rest.slice(unitMatch[0].length).trim();
          rest = rest.replace(/^(of|von)\s+/i, "");
        }
      }
    }
  }

  // 4) Trailing-Menge: "Mehl 500 g", "Hähnchenbrust 400g"
  if (amount === undefined) {
    const trailing = rest.match(TRAILING_REGEX);
    if (trailing) {
      rest = trailing[1].trim();
      amount = parseAmountString(trailing[2]);
      unit = canonicalUnit(trailing[3]);
      uncertain = false;
    }
  }

  // 4b) Einheit hinter dem Namen: "1 Knoblauch Zehe" → 1 Zehe Knoblauch
  if (amount !== undefined && unit === undefined) {
    const trailingUnit = rest.match(new RegExp(`\\s+(${UNIT_REGEX.source})$`, "iu"));
    if (trailingUnit) {
      unit = canonicalUnit(trailingUnit[1]);
      rest = rest.slice(0, trailingUnit.index).trim();
    }
  }

  // 4b) Category Prefix: "Gewürze: je 1 TL Salz" -> name "Salz", amount 1
  if (amount === undefined) {
    const prefixMatch = rest.match(/^(?:[a-zA-ZäöüÄÖÜß\s]{3,25}:\s*)?(?:je|jeweils)?\s*(\d+[.,]?\d*(?:\s+\d+\/\d+|\/\d+)?)\s*(.*)$/i);
    if (prefixMatch) {
       const potentialAmount = parseAmountString(prefixMatch[1]);
       let potentialRest = prefixMatch[2].trim();
       let potentialUnit;
       const unitMatch = potentialRest.match(UNIT_START_REGEX);
       if (unitMatch) {
         potentialUnit = canonicalUnit(unitMatch[1]);
         potentialRest = potentialRest.slice(unitMatch[0].length).trim();
         potentialRest = potentialRest.replace(/^(of|von)\s+/i, "");
       }
       if (potentialRest.length >= 2) {
         amount = potentialAmount;
         unit = potentialUnit;
         rest = potentialRest;
         uncertain = false;
       }
    }
  }

  // 5) "Juice of 1/2 lime" → name "Juice of lime", amount 0.5
  if (amount === undefined) {
    const ofMatch = rest.match(
      /^([a-zA-ZäöüÄÖÜß][a-zA-ZäöüÄÖÜß ]{1,30}?)\s+(?:of|von)\s+(\d+[.,]?\d*(?:\s+\d+\/\d+|\/\d+)?)\s*(.*)$/i,
    );
    if (ofMatch) {
      const prefix = ofMatch[1].trim();
      const tail = ofMatch[3].trim();
      const unitMatch = tail.match(UNIT_START_REGEX);
      amount = parseAmountString(ofMatch[2]);
      if (unitMatch) {
        unit = canonicalUnit(unitMatch[1]);
        rest = `${prefix} of ${tail.slice(unitMatch[0].length).trim()}`;
      } else {
        rest = tail ? `${prefix} of ${tail}` : prefix;
      }
      uncertain = false;
    }
  }

  if (amount === undefined && !unit) uncertain = true;

  const { name, notes } = splitNameAndNotes(rest);
  if (!name || name.length < 2) return null;
  // eine reine Zutatenzeile sollte nicht wie ein Kochschritt aussehen
  if (amount === undefined && STEP_VERB_HINTS.test(name) && name.split(" ").length > 4) {
    return null;
  }
  if (name.length > 80) return null;
  return { amount, unit, name, notes, uncertain };
}

/** Heuristik: sieht eine Zeile wie eine Zutat aus? (für Captions ohne Überschriften) */
export function looksLikeIngredient(line: string): number {
  let l = stripLeadingBullets(line);
  l = l.replace(/^(?:[a-zA-ZäöüÄÖÜß\s]{3,25}:\s*)?(?:je|jeweils)\s+/i, "");
  l = l.replace(/^[a-zA-ZäöüÄÖÜß\s]{3,25}:\s*(?=\d)/i, "");
  
  let score = 0;
  if (AMOUNT_REGEX.test(l)) score += 3;
  if (UNIT_REGEX.test(l)) {
    if (AMOUNT_REGEX.test(l)) score += 3;
    else score += 1;
  }
  if (l.length <= 60) score += 1;
  if (l.length > 100) score -= 2;
  if (/\d+\s*(min|minuten|minutes|h|stunden)\b/i.test(l)) score -= 2;
  if (/(?:ober-\/?unterhitze|umluft|heißluft|backofen|ofen|grad|°c|celsius|fahrenheit)/i.test(l)) score -= 3;
  if (STEP_VERB_HINTS.test(l) && !AMOUNT_REGEX.test(l)) score -= 2;
  if (NUTRITION_RE.test(l)) score -= 5;
  
  const wordCount = l.split(" ").length;
  if (wordCount > 10 && !UNIT_REGEX.test(l)) score -= 2;
  if (wordCount > 6 && !AMOUNT_REGEX.test(l)) score -= 3;
  
  return score;
}

const SEGMENT_START = /^\s*\d/;
/** Aufzählungen in einer Zeile: "Salz und 1 Prise Zucker" = zwei Zutaten. */
const CONJUNCTION_SPLIT = /\s+(?:und|oder|sowie)\s+/i;
/** Bindewörter, die einen Nebensatz statt einer zweiten Zutat einleiten. */
const CONJUNCTION_GUARD = /^(?:dann|danach|nun|zum|für|frisch|fein|in|mit|im|so)\b/i;

const MULTIPLIER_HEADER_RE = /^[-•*+~›»]?\s*(\d{1,2})\s*[x×]\s*:?\s*$/i;

/**
 * "4x:"-Zeilen sind Zwischenüberschriften, keine Zutaten.
 * Die Menge selbst steht in der Zutat ("4x 100g Hähnchen Filet" → 400 g) – eine
 * Vererbung des Faktors auf die folgenden Zeilen erzeugt dagegen Phantom-Mengen
 * für Referenz-Zeilen wie "Sauce" (im Corpus gemessen), deshalb bewusst nicht.
 */
export function stripMultiplierHeaders(lines: string[]): string[] {
  return lines.filter((line) => !MULTIPLIER_HEADER_RE.test(line));
}

const ITEM_GUARD = /^(?:in|im|mit|zum|zur|nach|frisch|fein|gut|dann|danach|nun|ca|etwa|oder|und|sowie)\b/i;
/** Prozentangaben sind Qualifier, keine eigene Zutat ("Milch, 1,5 % Fett"). */
const PERCENT_ONLY = /^\d+[.,]?\d*\s*%/;

/** Kurzer, "nackter" Listeneintrag mit großgeschriebenem Nomen ("Salz"). */
function isPlainItem(segment: string): boolean {
  const words = segment.split(/\s+/).filter(Boolean);
  return words.length <= 3 && /^[\p{Lu}„"(]/u.test(segment) && !ITEM_GUARD.test(segment);
}

const isQuantity = (segment: string): boolean => SEGMENT_START.test(segment) && !PERCENT_ONLY.test(segment);

/**
 * Zerlegt eine Ein-Zeilen-Zutatenliste ("300g Magerquark, 2 Eier, Salz & 80ml Wasser").
 * Gibt null zurück, wenn es keine Liste ist – damit Notiz-Konstruktionen
 * ("Hähnchen, in Streifen geschnitten", "Miracle Whip, Balance") heil bleiben.
 */
function splitIngredientList(line: string): string[] | null {
  const commaParts = line
    .split(/,(?!\d)/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (commaParts.length < 2) {
    // Reine "&"-Aufzählung: nur trennen, wenn rechts eine Menge steht
    const amp = line.split(/\s*[&;]\s*/).map((s) => s.trim()).filter(Boolean);
    if (amp.length > 1 && amp.slice(1).every(isQuantity)) return amp;
    return null;
  }

  const atoms: string[] = [];
  for (const part of commaParts) {
    const amp = part.split(/\s*[&;]\s*/).map((s) => s.trim()).filter(Boolean);
    if (amp.length > 1 && amp.slice(1).every(isQuantity)) atoms.push(...amp);
    else atoms.push(part);
  }

  const items: string[] = [];
  for (const atom of atoms) {
    if (items.length === 0) {
      items.push(atom);
      continue;
    }
    if (isQuantity(atom) || isPlainItem(atom)) items.push(atom);
    else items[items.length - 1] += `, ${atom}`; // Qualifier/Notiz bleibt am Eintrag
  }

  // Eine Liste ist es nur, wenn mindestens zwei Einträge eine eigene Menge haben
  if (items.length < 2 || items.filter(isQuantity).length < 2) return null;
  return items;
}

/**
 * "1 tbsp cumin, 2 tsp paprika & 1 tsp salt" → mehrere Zutaten.
 * Zusätzlich: Aufzählungen mit "und"/"oder"/"sowie" ("Salz und 1 Prise Zucker").
 */
export function expandIngredientLine(line: string): string[] {
  const parts = line
    .split(CONJUNCTION_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);

  if (
    parts.length >= 2 &&
    parts.length <= 3 &&
    parts.every((p) => p.length >= 3 && !CONJUNCTION_GUARD.test(p))
  ) {
    return parts.flatMap((p) => splitIngredientList(p) ?? [p]);
  }
  return splitIngredientList(line) ?? [line];
}

export function toIngredient(p: ParsedIngredient): Ingredient {
  return {
    id: newId(),
    amount: p.amount,
    unit: p.unit,
    name: p.name,
    notes: p.notes,
    uncertain: p.uncertain || undefined,
  };
}
