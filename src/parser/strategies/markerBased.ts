import { getAllVocab } from "../vocabulary";
import { splitLines } from "../normalize";
import type { ParserStrategy, RawParseResult } from "./types";

const vocab = getAllVocab();

function isMarker(line: string, markers: string[], emojis: string[]): boolean {
  const clean = line.trim().toLowerCase().replace(/[:\-_#*]/g, "").trim();
  if (markers.some((m) => clean === m || clean.startsWith(m))) return true;
  if (emojis.some((e) => line.includes(e))) {
    // Wenn ein Emoji vorkommt, die Zeile kurz ist und KEINE Ziffern enthält (keine Zutat wie "2 Eier")
    if (line.trim().length < 25 && !/\d/.test(line)) return true;
  }
  return false;
}

export const markerBasedStrategy: ParserStrategy = {
  name: "marker_based",
  parse(caption: string): RawParseResult {
    const lines = splitLines(caption);
    const result: RawParseResult = {
      title: "",
      ingredients: [],
      steps: [],
      other: [],
      confidence: 0,
      strategy: "marker_based",
    };

    if (lines.length === 0) return result;

    let currentSection: "title" | "ingredients" | "steps" | "other" = "title";
    let foundIngredientMarker = false;
    let foundStepMarker = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Prüfe auf Zutaten-Marker
      if (isMarker(line, vocab.ingredientMarkers, vocab.ingredientEmojis)) {
        currentSection = "ingredients";
        foundIngredientMarker = true;
        continue;
      }

      // Prüfe auf Zubereitungs-Marker
      if (isMarker(line, vocab.stepMarkers, vocab.stepEmojis)) {
        currentSection = "steps";
        foundStepMarker = true;
        continue;
      }

      // Prüfe auf Outro (nur wenn nicht nummeriert und kurz)
      const lower = line.toLowerCase();
      const isNumberedStep = /^\d+[.)]/.test(lower) || /^schritt\s*\d+/i.test(lower);
      if (
        !isNumberedStep &&
        (line.startsWith("#") ||
          vocab.outroKeywords.some((k) => lower.includes(k) && line.length < 60))
      ) {
        currentSection = "other";
      }

      // Zeile zum aktuellen Abschnitt hinzufügen
      if (currentSection === "title") {
        if (!result.title) {
          result.title = line.replace(/^[#*•\-\s]+/, "").trim();
        } else {
          result.other.push(line);
        }
      } else if (currentSection === "ingredients") {
        result.ingredients.push(line);
      } else if (currentSection === "steps") {
        result.steps.push(line);
      } else {
        result.other.push(line);
      }
    }

    if (foundIngredientMarker && foundStepMarker && result.ingredients.length > 0 && result.steps.length > 0) {
      result.confidence = 0.95;
    } else if (foundIngredientMarker && result.ingredients.length > 0) {
      result.confidence = 0.7;
    } else if (foundStepMarker && result.steps.length > 0) {
      result.confidence = 0.6;
    } else {
      result.confidence = 0.1;
    }

    // Heuristic: If we have very long run-on steps, marker_based is probably bad at splitting them.
    if (result.steps.some(s => s.length > 250)) {
      result.confidence -= 0.5;
    }

    return result;
  },
};
