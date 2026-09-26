import { getAllVocab } from "../vocabulary";
import { splitLines } from "../normalize";
import { looksLikeIngredient } from "../ingredient";
import type { ParserStrategy, RawParseResult } from "./types";

const vocab = getAllVocab();

type State = "TITEL" | "PREAMBLE" | "ZUTATEN" | "ZUBEREITUNG" | "SONSTIGES";

const SERVINGS_HEADER_RE = /^(?:für|for|serves?|yields?|ergibt|bei|pro)\s*(?:ca\.?\s*|about\s*)?(?:\d{1,2})?\s*(?:portionen?|pers(?:onen)?\.?|servings?|people|persons|stücke?|tacos?|portion|stück|person)\s*:?$/i;

/** Prüft, ob die Zeile eine Sub-Kategorie für Zutaten ist (z. B. "Für die Soße:") */
function isSubIngredientHeader(line: string): boolean {
  if (line.length > 40) return false;
  if (/^(?:für|for)\s+(?:den|die|das|diesen|diese|der)/i.test(line)) return true;
  const lower = line.toLowerCase().replace(/[:\-_#*]/g, "").trim();
  
  if (vocab.ingredientMarkers.some(m => lower.startsWith(m + " "))) {
    if (!lower.endsWith(" english") && !lower.endsWith(" deutsch")) return true;
  }

  const exactMatch = vocab.subIngredientPrefixes.some(p => lower === p || lower === p + "s"); 
  if (exactMatch) return true;

  return false;
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
  const words = line
    .toLowerCase()
    .replace(/^[0-9.\-•*):]+\s*/, "")
    .replace(/[.,!?]+$/, "")
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?]$/, ""));
  const firstWord = words[0] || "";
  const firstTwoWords = `${words[0] || ""} ${words[1] || ""}`.trim();

  const isVerbStart = vocab.stepVerbs.some((v) => firstWord === v || firstTwoWords === v);
  const isSeq = vocab.sequenceWords.some((s) => firstWord === s || firstTwoWords === s);
  const containsVerb = vocab.stepVerbs.some((v) => words.includes(v));
  const hasOvenOrTemp = /\b(?:backofen|umluft|ober-\/unterhitze|o\/u-hitze|grad|°c|minuten?|stunden?|min\.)\b/i.test(line);

  return isVerbStart || isSeq || containsVerb || hasOvenOrTemp;
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

function isNutritionLine(line: string): boolean {
  if (line.length > 50) return false;
  const lower = line.toLowerCase();
  
  if (lower.includes("kcal") || lower.includes("kalorien")) return true;
  if (/k\w?cal/i.test(line)) return true;
  
  const words = lower.split(/[\s,;|:]+/);
  const nutritionWords = ["kh", "kohlenhydrate", "protein", "eiweiß", "fett", "f", "ew", "carbs", "fat"];
  const macroCount = words.filter(w => nutritionWords.includes(w)).length;
  if (macroCount >= 2) return true;

  if (/(?:kh|ew|f|p|eiweiß|fett|protein|kohlenhydrate|carbs|fat)\s*:\s*\d+/i.test(line)) return true;
  if (/\d+\s*(?:g|%)\s+(?:kh|ew|f|p|eiweiß|fett|protein|kohlenhydrate|carbs|fat)(?:\s|$)/i.test(line)) return true;

  return false;
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

      if (isNutritionLine(line)) {
        result.other.push(line);
        continue;
      }

      // 1. Outro Check (nur wenn wir schon tief im Rezept sind)
      if (isOutroLine(line) && (state === "ZUBEREITUNG" || state === "ZUTATEN" || state === "SONSTIGES")) {
        state = "SONSTIGES";
        result.other.push(line);
        continue;
      }

      // 2. Zustandsübergänge (NUR VORWÄRTS: TITEL -> PREAMBLE -> ZUTATEN -> ZUBEREITUNG -> SONSTIGES)
      if (state === "TITEL") {
        const clean = line.toLowerCase().replace(/[:\-_#*]/g, "").trim();
        const isHeader =
          vocab.ingredientMarkers.some((m) => clean === m || clean.startsWith(m)) ||
          vocab.stepMarkers.some((m) => clean === m || clean.startsWith(m));
        if (isHeader) {
          state = "PREAMBLE";
          // Nicht als Titel setzen, in PREAMBLE weiterverarbeiten
        } else if (!result.title) {
          result.title = line.replace(/^[#*•\-\s]+/, "").trim();
          state = "PREAMBLE";
          continue;
        }
      }

      if (state === "PREAMBLE") {
        // Expliziter Zubereitungs-Marker leitet direkt Zubereitung ein
        const cleanLower = line.toLowerCase().replace(/[:\-_#*]/g, "").trim();
        if (vocab.stepMarkers.some((m) => cleanLower === m || cleanLower.startsWith(m))) {
          state = "ZUBEREITUNG";
          continue;
        }

        // Expliziter Zutaten-Marker oder Portions-Header leitet Zutaten ein
        if (
          vocab.ingredientMarkers.some((m) => line.toLowerCase().includes(m)) ||
          vocab.ingredientEmojis.some((e) => line.includes(e)) ||
          SERVINGS_HEADER_RE.test(line)
        ) {
          state = "ZUTATEN";
          result.other.push(line);
          continue;
        }

        // Wenn die Zeile wie eine Zutat aussieht (z.B. mit Mengenangabe / Bullets)
        if (looksLikeIngredient(line) >= 2 || /^[-•*]\s*\d/.test(line)) {
          state = "ZUTATEN";
          result.ingredients.push(line);
          continue;
        }

        // Sonst ist es ein Marketing-Hook / Beschreibungstext
        result.other.push(line);
        continue;
      }

      if (state === "ZUTATEN") {
        // Expliziter Zubereitungs-Marker (z.B. "Zubereitung:", "Anleitung:", 👩‍🍳)
        const cleanLower = line.toLowerCase().replace(/[:\-_#*]/g, "").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
        const isExplicitStepMarker =
          vocab.stepMarkers.some((m) => cleanLower === m || cleanLower.startsWith(m)) ||
          (vocab.stepEmojis.some((e) => line.includes(e)) && line.length < 25 && !/\d/.test(line));

        if (isExplicitStepMarker) {
          state = "ZUBEREITUNG";
          continue;
        }

        const isExactIngredientMarker = vocab.ingredientMarkers.some((m) => cleanLower === m);
        if (isExactIngredientMarker) {
          continue;
        }

        // Portionszeilen (z. B. "Für 4 Stück:") gehören nicht in die Zutatenliste
        if (SERVINGS_HEADER_RE.test(line)) {
          result.other.push(line);
          continue;
        }

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

        // Check if it's a continuation line (short, no bullet or number at start)
        if (
          !/^[-•*]|\d/.test(line) &&
          !line.endsWith(":") &&
          line.length < 40 &&
          result.ingredients.length > 0 &&
          !isSubIngredientHeader(line)
        ) {
          const lastIdx = result.ingredients.length - 1;
          const lastStr = result.ingredients[lastIdx].trim();
          if (lastStr.endsWith("-")) {
            result.ingredients[lastIdx] = lastStr + line.trim();
          } else {
            result.ingredients[lastIdx] += " " + line.trim();
          }
          continue;
        }

        // Check if it's a continuation line (starts with lowercase, no bullet)
        if (
          !/^[-•*]|\d/.test(line) &&
          /^[a-zäöü]/.test(line) &&
          !line.endsWith(":") &&
          line.length < 50 &&
          result.ingredients.length > 0 &&
          !isSubIngredientHeader(line)
        ) {
          const lastIdx = result.ingredients.length - 1;
          const lastStr = result.ingredients[lastIdx].trim();
          if (lastStr.endsWith("-")) {
            result.ingredients[lastIdx] = lastStr + line.trim();
          } else {
            result.ingredients[lastIdx] += " " + line.trim();
          }
          continue;
        }

        // Ansonsten bleibt es eine Zutat
        result.ingredients.push(line);
        continue;
      }

      if (state === "ZUBEREITUNG") {
        // Falls wir eine Sub-Überschrift finden (z.B. Zubereitung Füllung), geht's wieder in die Zutaten!
        if (isSubIngredientHeader(line)) {
          state = "ZUTATEN";
          result.ingredients.push(line);
          continue;
        }

        // Wenn ein neuer Rezept-Block beginnt (z.B. englische Übersetzung), abbrechen
        const cleanLower = line.toLowerCase().replace(/[:\-_#*]/g, "").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
        const isNewRecipe = 
          vocab.ingredientMarkers.some((m) => cleanLower === m || cleanLower === m + " english" || cleanLower === m + " deutsch") ||
          vocab.stepMarkers.some((m) => cleanLower === m || cleanLower === m + " english" || cleanLower === m + " deutsch");
        
        if (isNewRecipe && result.steps.length > 1) {
          state = "SONSTIGES";
          result.other.push(line);
          continue;
        }

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
