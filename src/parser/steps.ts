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
    if (idx > last) {
      const slice = line.slice(last, idx).trim();
      if (slice) parts.push(slice);
    }
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

const STEP_HEADER_RE = /^(?:zubereitung|anleitung|instructions?|directions?|method|schritte?|so geht'?s?|vorgehensweise):?$/i;

export function makeSteps(lines: string[]): RecipeStep[] {
  // Wenn es nur 1 einzigen langen Fließtext-Block ohne Nummerierung gibt, an Satzgrenzen aufteilen
  let effectiveLines = lines;
  if (
    lines.length === 1 &&
    lines[0].length > 100 &&
    !lineLooksLikeStep(lines[0]) &&
    !INLINE_STEP.test(lines[0])
  ) {
    const sentences = splitSentences(lines[0]);
    if (sentences.length > 1) {
      effectiveLines = sentences;
    }
  }

  const out: RecipeStep[] = [];
  for (const line of effectiveLines) {
    for (const part of splitInlineSteps(line)) {
      const text = cleanStepText(part);
      if (!text || STEP_HEADER_RE.test(text)) continue;
      
      let cleanSt = text.replace(/(?:#\w+\s*)+$/i, "").trim();
      cleanSt = cleanSt.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/gu, "").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/gu, "").trim();
      if (/^(?:was|welche|welches|welchen|wie|warum|wo|wer|habt|schreibt|lasst)\b.*\?$/i.test(cleanSt)) continue;

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
