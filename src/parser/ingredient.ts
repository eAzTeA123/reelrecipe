import type { Ingredient } from "@/domain/types";
import { newId } from "@/lib/text";
import { UNIT_REGEX, UNIT_START_REGEX, canonicalUnit } from "./units";
import { AMOUNT_REGEX, parseAmountString, wordToNumber } from "./quantity";

export interface ParsedIngredient {
  amount?: number;
  unit?: string;
  name: string;
  notes?: string;
  uncertain: boolean;
}

const STEP_VERB_HINTS = /^(den|die|das|in|im|mit|auf|bei|dann|danach|anschließend|anschliessend|zuerst|nun|jetzt|alles|zum|vorsichtig|gut)\b/i;

function splitNameAndNotes(rest: string): { name: string; notes?: string } {
  let r = rest.trim();
  const notes: string[] = [];
  // (optional), (ca. 2 cm) etc. ans Ende
  const parens = r.match(/\(([^)]{1,60})\)\s*$/) || r.match(/\(([^)]{1,60})\)/);
  if (parens) {
    notes.push(parens[1].trim());
    r = r.replace(parens[0], "").trim();
  }
  // "Hähnchenbrust, in Streifen geschnitten" → name + notes
  const comma = r.indexOf(",");
  if (comma > 0) {
    const tail = r.slice(comma + 1).trim();
    if (tail.length >= 2) {
      notes.push(tail.replace(/\.$/, ""));
      r = r.slice(0, comma).trim();
    }
  }
  r = r.replace(/^[–\-:;,\s]+/, "").replace(/[\s.,;]+$/, "");
  return { name: r, notes: notes.length ? notes.join(", ") : undefined };
}

const SERVINGS_HEADER_RE = /^(?:für|for|serves?|yields?|ergibt)\s*(?:ca\.?\s*|about\s*)?\d{1,2}\s*(?:portionen?|pers(?:onen)?\.?|servings?|people|persons|stücke?|tacos?|portion|stück|person)\s*:?$/i;
const TIME_DESC_RE = /(?:\bunter\s*\d+\s*min|\b\d+\s*(?:minuten?|minutes?|stunden?|hours?|std\.?)\b|\bhigh\s*protein\b|\bkalorienarm\b)/i;

/** Parst eine Zeile zu einer Zutat. Gibt null zurück, wenn unmöglich. */
export function parseIngredientLine(line: string): ParsedIngredient | null {
  let rest = line.trim();
  if (!rest || rest.length > 160) return null;

  // Servings-Zeilen niemals als Zutat werten (z. B. "Für 4 Stück:")
  if (SERVINGS_HEADER_RE.test(rest)) return null;

  // Reine Zeit- oder Werbebeschreibungen ohne Zutateneigenschaften verwerfen
  if (!AMOUNT_REGEX.test(rest) && TIME_DESC_RE.test(rest)) return null;

  let amount: number | undefined;
  let unit: string | undefined;
  let uncertain = false;

  // 1) Zahl am Anfang: "500 g Mehl", "2 Eier", "1 1/2 Tassen Reis"
  const amountMatch = rest.match(AMOUNT_REGEX);
  if (amountMatch) {
    amount = parseAmountString(amountMatch[0]);
    rest = rest.slice(amountMatch[0].length).trim();
    const unitMatch = rest.match(UNIT_START_REGEX);
    if (unitMatch) {
      unit = canonicalUnit(unitMatch[1]);
      rest = rest.slice(unitMatch[0].length).trim();
      rest = rest.replace(/^(of|von)\s+/i, "");
    }
  } else {
    // 1b) Kompakte Zahl+Einheit am Anfang ohne Leerzeichen: "500g Mehl", "250ml Milch"
    const compactMatch = rest.match(
      new RegExp(`^(\\d+[.,]?\\d*(?:\\s+\\d+\\/\\d+|\\/\\d+)?)\\s*(${UNIT_REGEX.source})(?:\\s+(.+))?$`, "iu"),
    );
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
    const trailing = rest.match(
      new RegExp(`^(.{2,80}?)\\s+(\\d+[.,]?\\d*(?:\\s+\\d+\\/\\d+|\\/\\d+)?)\\s*(${UNIT_REGEX.source})$`, "iu"),
    );
    if (trailing) {
      rest = trailing[1].trim();
      amount = parseAmountString(trailing[2]);
      unit = canonicalUnit(trailing[3]);
      uncertain = false;
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
  let score = 0;
  if (AMOUNT_REGEX.test(line)) score += 3;
  if (UNIT_REGEX.test(line)) score += 3;
  if (line.length <= 60) score += 1;
  if (line.length > 100) score -= 2;
  if (/\d+\s*(min|minuten|minutes|h|stunden)\b/i.test(line)) score -= 2;
  if (STEP_VERB_HINTS.test(line) && !AMOUNT_REGEX.test(line)) score -= 2;
  if (line.split(" ").length > 10 && !UNIT_REGEX.test(line)) score -= 2;
  return score;
}

const SEGMENT_START = /^\s*\d/;

/**
 * "1 tbsp cumin, 2 tsp paprika & 1 tsp salt" → mehrere Zutaten.
 * Nur splitten, wenn jeder weitere Abschnitt ebenfalls mit einer Menge beginnt,
 * sonst ist es eine Notes-Konstruktion ("Hähnchen, in Streifen").
 */
export function expandIngredientLine(line: string): string[] {
  const segments = line.split(/[;&]|,(?!\d)/).map((s) => s.trim()).filter(Boolean);
  if (segments.length < 2) return [line];
  const restHaveAmounts = segments.slice(1).every((s) => SEGMENT_START.test(s));
  if (!restHaveAmounts) return [line];
  return segments;
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
