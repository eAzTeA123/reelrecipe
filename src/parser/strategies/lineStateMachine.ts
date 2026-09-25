import { getAllVocab } from "../vocabulary";
import { splitLines } from "../normalize";
import { looksLikeIngredient } from "../ingredient";
import type { ParserStrategy, RawParseResult } from "./types";

const vocab = getAllVocab();

type State = "TITEL" | "ZUTATEN" | "ZUBEREITUNG" | "SONSTIGES";

/** Prüft, ob die Zeile eine Sub-Kategorie für Zutaten ist (z. B. "Für die Soße:") */
function isSubIngredientHeader(line: string): boolean {
  const lower = line.toLowerCase().trim();
  return vocab.subIngredientPrefixes.some((p) => lower.startsWith(p) || lower.includes(p));
}

/** Prüft, ob die Zeile wie Outro / Social Media CTA / Hashtags aussieht */
function isOutroLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  if (/^\d+[.)]/.test(lower) || /^schritt\s*\d+/i.test(lower)) {
    return false;
  }
  if (lower.startsWith("#") || lower.split(/\s+/).filter((w) => w.startsWith("#")).length >= 3) {
    return true;
  }
  if (line.length > 60) return false;
  return vocab.outroKeywords.some((k) => lower.includes(k));
}

/** Signal 1: Beginnt mit Verb/Sequenzwort ODER enthält Kochverb */
function hasVerbOrSequenceStart(line: string): boolean {
  const words = line.toLowerCase().replace(/^[0-9.\-•*):]+\s*/, "").trim().split(/\s+/);
  const firstWord = words[0] || "";
  const firstTwoWords = `${words[0] || ""} ${words[1] || ""}`.trim();

  const isVerbStart = vocab.stepVerbs.some((v) => firstWord === v || firstTwoWords === v);
  const isSeq = vocab.sequenceWords.some((s) => firstWord === s || firstTwoWords === s);
  const containsVerb = vocab.stepVerbs.some((v) => words.includes(v));

  return isVerbStart || isSeq || containsVerb;
}

/** Signal 2: Strukturwechsel (langer Satz, wenig wie Zutat geformt) */
function hasSentenceStructure(line: string): boolean {
  const trimmed = line.trim();
  const ingScore = looksLikeIngredient(trimmed);
  // Wenn es deutlich weniger als Zutat gewertet wird und länger als 30 Zeichen ist oder mit Satzzeichen endet
  return (trimmed.length > 30 || /[.!?]$/.test(trimmed)) && ingScore < 2;
}

/** Signal 3: Schritt-Nummerierung oder explizites Schrittwort */
function hasStepNumbering(line: string): boolean {
  return (
    /^(?:schritt\s*\d+|\d+[.)]|step\s*\d+)/i.test(line.trim()) ||
    vocab.sequenceWords.some((w) => line.toLowerCase().trim().startsWith(w))
  );
}

export const lineStateMachineStrategy: ParserStrategy = {
  name: "line_state_machine",
  parse(caption: string): RawParseResult {
    const lines = splitLines(caption);
    const result: RawParseResult = {
      title: "",
      ingredients: [],
      steps: [],
      other: [],
      confidence: 0,
      strategy: "line_state_machine",
    };

    if (lines.length === 0) return result;

    let state: State = "TITEL";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // 1. Outro Check (kann immer nach SONSTIGES wechseln)
      if (isOutroLine(line)) {
        state = "SONSTIGES";
        result.other.push(line);
        continue;
      }

      // 2. Zustandsübergänge (NUR VORWÄRTS: TITEL -> ZUTATEN -> ZUBEREITUNG -> SONSTIGES)
      if (state === "TITEL") {
        if (!result.title) {
          result.title = line.replace(/^[#*•\-\s]+/, "").trim();
          state = "ZUTATEN";
          continue;
        }
      }

      if (state === "ZUTATEN") {
        // Schütze Sub-Abschnitte (z.B. "Für die Soße:")
        if (isSubIngredientHeader(line)) {
          result.ingredients.push(line);
          continue;
        }

        // Berechne das 2-von-3 Signal-Bündel für Übergang zu ZUBEREITUNG
        const s1 = hasVerbOrSequenceStart(line);
        const s2 = hasSentenceStructure(line);
        const s3 = hasStepNumbering(line);

        const signalsMet = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0);

        if (signalsMet >= 2) {
          // Übergang zu ZUBEREITUNG ausgelöst!
          state = "ZUBEREITUNG";
          result.steps.push(line);
          continue;
        }

        // Ansonsten bleibt es eine Zutat
        result.ingredients.push(line);
        continue;
      }

      if (state === "ZUBEREITUNG") {
        // Einmal in ZUBEREITUNG, bleibt alles ZUBEREITUNG bis SONSTIGES
        result.steps.push(line);
        continue;
      }

      if (state === "SONSTIGES") {
        result.other.push(line);
        continue;
      }
    }

    // Konfidenz berechnen
    if (result.ingredients.length > 0 && result.steps.length > 0) {
      result.confidence = 0.85;
    } else if (result.ingredients.length > 0) {
      result.confidence = 0.55;
    } else {
      result.confidence = 0.2;
    }

    return result;
  },
};
