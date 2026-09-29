import type { Ingredient } from "@/domain/types";
import { newId } from "@/lib/text";
import { parseAmountString } from "./quantity";
import { UNIT_REGEX, canonicalUnit } from "./units";
import { stripLeadingBullets } from "./normalize";

/**
 * Zutaten, die nur in der Anleitung genannt werden ("mit 100g Feta … belegen",
 * "etwas schwarzen Pfeffer darüber streuen"), fehlen sonst in der Zutatenliste
 * und damit auf der Einkaufsliste. Diese Ableitung ergänzt sie – konservativ:
 * nur klare Menge+Einheit-Muster oder "etwas/eine Prise X …"-Wendungen, keine
 * Duplikate, keine Zeit-/Temperaturangaben.
 */

const NAME_STOP = /[.,;:!?()&]|\bund\b|\boder\b|\bmit\b|\bin\b|\bauf\b|\bfür\b/i;

/**
 * Einheiten-Muster ohne eigene Fanggruppe: `UNIT_REGEX.source` bringt eine
 * eigene Gruppe mit, die sonst die Indizes der Treffer verschiebt.
 */
const UNIT_SCAN = UNIT_REGEX.source.replace(/\((?!\?)/g, "(?:");

/** (1) Menge + Einheit + Name, irgendwo im Satz (Gruppen: 1 Menge, 2 Einheit, 3 Name) */
const AMOUNT_UNIT_RE = new RegExp(
  `(?:^|[\\s(])(\\d{1,3}(?:[.,]\\d+)?)\\s*(${UNIT_SCAN})\\s+([\\p{L}/][\\p{L}\\-/ ]{2,40})`,
  "giu",
);

/** (2) "etwas schwarzen Pfeffer darüber streuen" → schwarzen Pfeffer */
const PINCH_RE =
  /(?:etwas|ein wenig|ein paar|eine Prise|einen Schuss|einen Spritzer)\s+([\p{L}][\p{L}\- ]{2,40}?)\s+(?:darüber|darunter|darauf|dazu|daran|hinzu|unter|auf|in|über)\b/iu;

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zäöüß ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAlreadyPresent(name: string, existing: Ingredient[]): boolean {
  const n = normalize(name);
  if (!n) return true;
  return existing.some((i) => {
    const e = normalize(i.name);
    return e === n || (n.length >= 5 && e.includes(n)) || (e.length >= 5 && n.includes(e));
  });
}

function cleanName(raw: string): string | undefined {
  const cut = raw.split(NAME_STOP)[0]?.trim() ?? "";
  const name = cut.replace(/[\s\-]+$/, "").trim();
  if (name.length < 3 || name.length > 45) return undefined;
  if (name.split(/\s+/).filter(Boolean).length > 4) return undefined;
  // Zeit-/Temperaturwörter und Nährwerte sind keine Zutaten
  if (/^(?:minuten?|stunden?|grad|°c|kcal|kalorien|gramm|milliliter)\b/i.test(name)) return undefined;
  return name;
}

export function deriveIngredientsFromSteps(steps: string[], existing: Ingredient[]): Ingredient[] {
  const derived: Ingredient[] = [];
  const seen = new Set(existing.map((i) => normalize(i.name)));

  const add = (name: string, amount?: number, unit?: string): void => {
    const key = normalize(name);
    if (seen.has(key) || isAlreadyPresent(name, existing) || isAlreadyPresent(name, derived)) return;
    seen.add(key);
    derived.push({
      id: newId(),
      amount,
      unit,
      name,
      notes: "aus der Anleitung",
    });
  };

  for (const step of steps) {
    const text = stripLeadingBullets(step);

    for (const match of text.matchAll(AMOUNT_UNIT_RE)) {
      const unit = canonicalUnit(match[2] ?? "");
      const name = cleanName(match[3] ?? "");
      if (!unit || !name) continue;
      add(name, parseAmountString(match[1].replace(",", ".")), unit);
    }

    const pinch = text.match(PINCH_RE);
    if (pinch) {
      const name = cleanName(pinch[1]);
      if (name) add(name);
    }
  }

  return derived;
}
