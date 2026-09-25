import type { RecipeStep } from "@/domain/types";
import { newId } from "@/lib/text";

const STEP_PREFIX = /^(?:schritt|step)\s*\d{1,2}\s*[.)\]:\-–—]?\s*|^\d{1,2}\s*[.)\]]\s*|^[0-9]️⃣\s*/iu;
const INLINE_STEP = /(?:^|\s)(?:(?:schritt\s+)?\d{1,2}\s*[.)\]]|[0-9]️⃣)\s+/giu;

export function cleanStepText(line: string): string {
  return line.replace(STEP_PREFIX, "").trim();
}

export function lineLooksLikeStep(line: string): boolean {
  return /^(?:schritt\s+)?\d{1,2}\s*[.)\]]\s+\S+/i.test(line) || /^[0-9]️⃣\s*\S+/u.test(line);
}

/** Zerlegt eine Zeile in mehrere Schritte, wenn sie Nummern enthält ("1. ... 2. ..."). */
export function splitInlineSteps(line: string): string[] {
  const parts: string[] = [];
  let last = 0;
  const matches = [...line.matchAll(INLINE_STEP)];
  if (matches.length < 2) return [line];
  for (const m of matches) {
    const idx = m.index! + (m[0].startsWith(" ") ? 1 : 0);
    if (idx > last) parts.push(line.slice(last, idx).trim());
    last = idx;
  }
  parts.push(line.slice(last).trim());
  return parts.map(cleanStepText).filter((p) => p.length > 2);
}

/** Fallback: langen Fließtext an Satzgrenzen in Schritte teilen. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

export function makeSteps(lines: string[]): RecipeStep[] {
  const out: RecipeStep[] = [];
  for (const line of lines) {
    for (const part of splitInlineSteps(line)) {
      const text = cleanStepText(part);
      if (!text) continue;
      out.push({ id: newId(), order: out.length + 1, instruction: text });
    }
  }
  return out;
}

export function looksLikeStep(line: string): number {
  let score = 0;
  if (lineLooksLikeStep(line)) score += 4;
  if (line.length > 60) score += 2;
  if (/\b(annehmen|geben|hinzufügen|hinzugeben|schneiden|braten|kochen|backen|rühren|mischen|servieren|würzen|erhitzen|mix|add|stir|cook|bake|fry|serve|season|heat|pour|combine|whisk)\b/i.test(line)) score += 3;
  if (/\d+\s*(min|minuten|minutes|grad|°c|°f|h\b)/i.test(line)) score += 1;
  if (line.length <= 40 && !/\d/.test(line)) score -= 1;
  return score;
}
