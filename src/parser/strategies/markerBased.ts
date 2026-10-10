import { getAllVocab } from "../vocabulary";
import { splitLines } from "../normalize";
import { looksLikeIngredient, startsWithOwnQuantity } from "../ingredient";
import { CONTINUATION_START_RE, isLabelLine, isPureGroupHeader, isTemperatureLine } from "../lineFacts";
import {
  INGREDIENT_EMOJIS,
  STEP_EMOJIS,
  hasEmoji,
  isCreditOrLinkLine,
  isListItemWithoutVerb,
  isNoteLine,
  isNutritionLine,
  isOutroLine,
  isPromoLine,
  isStepLeadIn,
  looksLikeHeading,
  normalizeHeader,
} from "../lineFacts";
import type { ParserStrategy, RawParseResult } from "./types";

const vocab = getAllVocab();

function isMarker(line: string, markers: string[], emojis: string[]): boolean {
  const clean = normalizeHeader(line);
  if (markers.some((m) => clean === m || clean.startsWith(m))) return true;
  // Wenn ein Emoji vorkommt, die Zeile kurz ist und KEINE Ziffern enthält (keine Zutat wie "2 Eier")
  return hasEmoji(line, emojis) && line.trim().length < 25 && !/\d/.test(line);
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
      if (isMarker(line, vocab.ingredientMarkers, INGREDIENT_EMOJIS)) {
        currentSection = "ingredients";
        foundIngredientMarker = true;
        continue;
      }

      // Prüfe auf Zubereitungs-Marker
      if (isMarker(line, vocab.stepMarkers, STEP_EMOJIS)) {
        currentSection = "steps";
        foundStepMarker = true;
        continue;
      }

      // Nährwerte/Portionsangaben: ab in "other", Abschnitt NICHT umschalten,
      // damit danach folgende Zubereitungsschritte nicht verloren gehen.
      if (isNutritionLine(line)) {
        result.other.push(line);
        continue;
      }

      // Prüfe auf Outro (nur wenn nicht nummeriert und kurz) – inklusive
      // Werbe-/Kooperationszeilen, die sonst als Schritte enden. Notizzeilen zu
      // einer Zutat ("( erhältlich bei Prozis )") sind keine Werbung.
      const lower = line.toLowerCase();
      const isNumberedStep = /^\d+[.)]/.test(lower) || /^schritt\s*\d+/i.test(lower);
      if (
        !isNumberedStep &&
        !isNoteLine(line) &&
        (line.startsWith("#") || isOutroLine(line) || isPromoLine(line))
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
        const withoutBullet = line.replace(/^[-•*]\s*/, "").trim();
        if (/^\(\([\s\S]+\)\)$/.test(withoutBullet)) {
          result.other.push(line);
          continue;
        }
        // Klammer-Notizen und Alternativangaben gehören zur vorherigen Zutat
        if (result.ingredients.length > 0 && (isNoteLine(line) || /^\([\s\S]+\)$/.test(withoutBullet))) {
          result.ingredients[result.ingredients.length - 1] += ` ${withoutBullet}`;
          continue;
        }

        if (looksLikeIngredient(line) < 0) {
          result.steps.push(line);
        } else {
          /*
           * Fortsetzung der Zeile darüber („1 Zwiebel" + „fein gehackt") – dieselbe
           * Regel wie in der Zustandsmaschine, aus derselben Liste. Ohne sie standen
           * Fragmente wie „fein gehackt" als eigene Zutaten in der Liste. Gemessen:
           * Diese Strategie gewinnt bei Captions der Form „Zutaten … Zubereitung".
           */
          const previous = result.ingredients[result.ingredients.length - 1]?.trim() ?? "";
          const isContinuation =
            result.ingredients.length > 0 &&
            (CONTINUATION_START_RE.test(line) || /[,-]$/.test(previous)) &&
            !startsWithOwnQuantity(line) &&
            !isPureGroupHeader(line) &&
            line.length < 50;
          if (isContinuation) {
            result.ingredients[result.ingredients.length - 1] += ` ${withoutBullet}`;
            continue;
          }
          result.ingredients.push(line);
        }
      } else if (currentSection === "steps") {
        /*
         * Nummerierte Zeilen sind **immer** Schritte („1️⃣ Ofen auf 190 °C
         * vorheizen", „2️⃣ Hähnchen … würfeln", „7️⃣ Servieren & genießen").
         * Vorher fielen sie durch die Überschriften-/Lead-in-Prüfungen und die
         * Anleitung verlor mehrere Schritte (redaktionell geprüft an Rezept 12).
         */
        const numberedStep = /^(?:[0-9]\uFE0F?\u20E3|\d{1,2}\s*[.)\]])\s*\S/u.test(line);
        // Fortsetzungszeile mit Pfeil gehört zum Schritt darüber („➡️ 45 Min abgedeckt")
        const arrowStripped = line.replace(/^[\u27A1\u2192\uFE0F\s]+/u, "").trim();
        const isShortTimingNote =
          result.steps.length > 0 &&
          line.length < 45 &&
          /\b\d+\s*(?:min|minuten|std|stunden)\b/i.test(line) &&
          !/\b(?:backen|kochen|braten|anbraten|vorheizen|erhitzen|mischen|kneten|ruehren)\b/i.test(line);
        if ((/^[\u27A1\u2192\uFE0F\s]/.test(line) || isShortTimingNote) && arrowStripped.length > 0) {
          result.steps[result.steps.length - 1] += ` ${arrowStripped}`;
          continue;
        }
        if (
          !numberedStep &&
          (isCreditOrLinkLine(line) ||
            looksLikeHeading(line, lines[i + 1]) ||
            isStepLeadIn(line, lines.slice(i + 1, i + 3)) ||
            isListItemWithoutVerb(line) ||
            isNoteLine(line) ||
            /*
             * Strukturzeilen sind keine Schritte (redaktionell geprüft an 23 und
             * 39): „Zum Servieren:", „Anrichten", reine Ofenangaben und
             * Nährwertzeilen. Eine Ofenangabe **mit** Handlungsverb bleibt Schritt.
             */
            isPureGroupHeader(line) ||
            isLabelLine(line) ||
            isTemperatureLine(line) ||
            isNutritionLine(line))
        ) {
          result.other.push(line);
          continue;
        }
        result.steps.push(line);
      } else {
        result.other.push(line);
      }
    }

    if (foundIngredientMarker && foundStepMarker && result.ingredients.length > 0 && result.steps.length > 0) {
      result.confidence = 0.95;
    } else if (foundIngredientMarker && result.ingredients.length >= 3 && result.steps.length > 0) {
      result.confidence = 0.9;
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

    // Wenn viele Zutaten-ähnliche Zeilen in "other"/"steps" gelandet sind, hat die
    // Marker-Zuordnung die Liste zerrissen ("Für das Gyros:"-Blöcke) – dann ist die
    // hohe Konfidenz falsch und die Zeilen-Strategie wäre die bessere Wahl.
    const leaked = [...result.other, ...result.steps].filter((l) => looksLikeIngredient(l) >= 3).length;
    if (leaked > result.ingredients.length) {
      result.confidence = Math.max(0.1, result.confidence - 0.4);
    }

    return result;
  },
};


