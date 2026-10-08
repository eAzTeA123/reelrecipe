import { getAllVocab } from "../vocabulary";
import { splitLines } from "../normalize";
import { looksLikeIngredient, startsWithOwnQuantity } from "../ingredient";
import {
  SERVINGS_HEADER_RE,
  containsIngredientMarker,
  hasIngredientEmoji,
  hasStepEmoji,
  hasStepNumbering,
  hasVerbOrSequenceStart,
  isCreditOrLinkLine,
  isIngredientMarkerHeading,
  isListItemWithoutVerb,
  isNoteLine,
  isNutritionLine,
  isOutroLine,
  isPromoLine,
  isStepLeadIn,
  isStepMarkerHeading,
  isSubIngredientHeader,
  cleanGroupTitle,
  isPureGroupHeader,
  looksLikeHeading,
  normalizeHeader,
  startsNewItem,
} from "../lineFacts";
import type { ParserStrategy, RawParseResult } from "./types";

const vocab = getAllVocab();

type State = "TITEL" | "PREAMBLE" | "ZUTATEN" | "ZUBEREITUNG" | "SONSTIGES";

/** Signal 2: Strukturwechsel (langer Satz, wenig wie Zutat geformt) */
function hasSentenceStructure(line: string): boolean {
  const trimmed = line.trim();
  const ingScore = looksLikeIngredient(trimmed);
  // Wenn es deutlich weniger als Zutat gewertet wird und länger als 30 Zeichen ist oder mit Satzzeichen endet
  return (trimmed.length > 30 || /[.!?]$/.test(trimmed)) && ingScore < 2;
}

/**
 * "4x:"-Überschrift: folgende Zutaten ohne eigene Menge erben den Faktor.
 * Die Faktor-Logik selbst liegt zentral in `applyItemMultiplier` (ingredient.ts),
 * damit alle Strategien identisch behandelt werden.
 */
const MULTIPLIER_HEADER_RE = /^[-•*+~›»]?\s*(\d{1,2})\s*[x×]\s*:?\s*$/i;

export const lineStateMachineStrategy: ParserStrategy = {
  name: "line_state_machine",
  parse(caption: string): RawParseResult {
    const lines = splitLines(caption);
    /*
     * Gruppen laufen **index-gleich** zur Zutatenliste mit. So bleibt die
     * Zuordnung auch dann korrekt, wenn eine Zutat durch Fortsetzungszeilen
     * verlängert wird (dort wird nur angehängt, nicht gepusht).
     */
    const ingredientGroups: (string | undefined)[] = [];
    const result: RawParseResult = {
      title: "",
      ingredients: [],
      ingredientGroups,
      steps: [],
      other: [],
      confidence: 0,
      strategy: "line_state_machine",
    };

    if (lines.length === 0) return result;

    let state: State = "TITEL";
    let hasExplicitStepMarker = false;
    /** Gruppe aus der letzten Überschrift („Teig", „Belag", „FÜLLUNG"). */
    let currentGroup: string | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (isNutritionLine(line)) {
        result.other.push(line);
        continue;
      }

      // "4x:" / "2x" als Zwischenüberschrift: keine Zutat, Faktor setzt
      // `applyItemMultiplier` beim Zusammenbau des Rezepts.
      if (MULTIPLIER_HEADER_RE.test(line)) {
        result.other.push(line);
        continue;
      }

      // 1. Outro Check (nur wenn wir schon tief im Rezept sind)
      if (isOutroLine(line) && (state === "ZUBEREITUNG" || state === "ZUTATEN" || state === "SONSTIGES")) {
        state = "SONSTIGES";
        result.other.push(line);
        continue;
      }

      // Werbe-/Kooperationszeilen beenden das Rezept – aber nur innerhalb der
      // Zutaten-/Zubereitungsphase und nur, wenn die Zeile keine Listenzeile ist.
      // (In PREAMBLE regelt das schon der PREAMBLE-Zweig, ohne den Zustand zu beenden.)
      if (
        isPromoLine(line) &&
        (state === "ZUBEREITUNG" || state === "ZUTATEN") &&
        !startsNewItem(line) &&
        !isNoteLine(line) &&
        looksLikeIngredient(line) < 2
      ) {
        state = "SONSTIGES";
        result.other.push(line);
        continue;
      }

      // 2. Zustandsübergänge (NUR VORWÄRTS: TITEL -> PREAMBLE -> ZUTATEN -> ZUBEREITUNG -> SONSTIGES)
      if (state === "TITEL") {
        const isHeader = isIngredientMarkerHeading(line) || isStepMarkerHeading(line);
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
        if (isStepMarkerHeading(line)) {
          state = "ZUBEREITUNG";
          hasExplicitStepMarker = true;
          continue;
        }

        // Expliziter Zutaten-Marker oder Portions-Header leitet Zutaten ein
        if (containsIngredientMarker(line) || hasIngredientEmoji(line) || SERVINGS_HEADER_RE.test(line)) {
          state = "ZUTATEN";
          result.other.push(line);
          continue;
        }

        // Werbe-/Introzeilen ("30 Tage – 30 Rezepte | …") sind keine Zutaten
        if (isPromoLine(line)) {
          result.other.push(line);
          continue;
        }

        // Wenn die Zeile wie eine Zutat aussieht (z.B. mit Mengenangabe / Bullets)
        if (looksLikeIngredient(line) >= 2 || /^[-•*+~]\s*\d/.test(line)) {
          state = "ZUTATEN";
          result.ingredients.push(line);
        ingredientGroups.push(currentGroup);
          continue;
        }

        // Sonst ist es ein Marketing-Hook / Beschreibungstext
        result.other.push(line);
        continue;
      }

      if (state === "ZUTATEN") {
        // Expliziter Zubereitungs-Marker (z.B. "Zubereitung:", "Anleitung:", 👩‍🍳)
        const isExplicitStepMarker =
          isStepMarkerHeading(line) || (hasStepEmoji(line) && line.length < 25 && !/\d/.test(line));

        if (isExplicitStepMarker) {
          state = "ZUBEREITUNG";
          hasExplicitStepMarker = true;
          continue;
        }

        if (vocab.ingredientMarkers.some((m) => normalizeHeader(line) === m)) {
          continue;
        }

        // Portionszeilen (z. B. "Für 4 Stück:") gehören nicht in die Zutatenliste
        if (SERVINGS_HEADER_RE.test(line)) {
          result.other.push(line);
          continue;
        }

        // Sub-Abschnitt (z.B. "Für die Soße:") – wird zur Gruppe, nicht zur Zutat.
        // Nur **reine** Überschriften: „Gewürze: Salz, Pfeffer" enthält Zutaten
        // und bleibt deshalb eine Zutatenzeile (gemessen: sonst fehlen die Gewürze).
        if (isSubIngredientHeader(line) && isPureGroupHeader(line)) {
          currentGroup = cleanGroupTitle(line);
          continue;
        }

        const withoutBullet = line.replace(/^[-•*]\s*/, "").trim();
        if (/^\(\([\s\S]+\)\)$/.test(withoutBullet)) {
          result.other.push(line);
          continue;
        }
        if (/^\([\s\S]+\)$/.test(withoutBullet) && result.ingredients.length > 0) {
          result.ingredients[result.ingredients.length - 1] += ` ${withoutBullet}`;
          continue;
        }

        // Berechne das 2-von-3 Signal-Bündel für Übergang zu ZUBEREITUNG
        const s1 = hasVerbOrSequenceStart(line);
        const s2 = hasSentenceStructure(line);
        const s3 = hasStepNumbering(line);

        const signalsMet = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0);

        // Zeit-/Temperaturhinweise sind Anweisungen, keine Zutaten
        // ("⏰ 3 bis 5 Minuten Mikrowelle ~ 700 W"), außer die Zeile ist klar eine Zutat.
        const isTimeOrTempHint =
          /\b(?:mikrowelle|backofen|umluft|ober-\/unterhitze|o\/u-hitze|vorgeheizt)\b/i.test(line) &&
          looksLikeIngredient(line) < 3;

        if (signalsMet >= 2 || isTimeOrTempHint) {
          // Übergang zu ZUBEREITUNG ausgelöst!
          state = "ZUBEREITUNG";
          result.steps.push(line);
          continue;
        }

        // Zeile mit **eigener** Menge ist eine neue Zutat, keine Fortsetzung:
        // „150 g Quark" + „ca. 200 ml Milch" wurde sonst zu „Quark ca. 200 ml Milch"
        // verschmolzen, und „250 g gewürfelten Speck" + „Halben Bund Lauch oder
        // 1 Stange Porree" ebenso (beides an echten Captions gemessen).
        // `startsWithOwnQuantity` erkennt Ziffer+Einheit, Zahlwort+Einheit
        // („Halben Bund") und Einheit+Name („Bund Petersilie") über die zentrale
        // Einheitenliste. Eine Zeile, die nur aus Menge und Einheit besteht
        // („200 g" unter „Mehl"), gehört weiterhin zur Zeile darüber.
        const hasOwnAmount = startsWithOwnQuantity(line);

        // Check if it's a continuation line (short, no bullet or number at start)
        if (
          !startsNewItem(line) &&
          !hasOwnAmount &&
          !line.endsWith(":") &&
          !hasStepEmoji(line) &&
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
          !startsNewItem(line) &&
          !hasOwnAmount &&
          /^[a-zäöü]/.test(line) &&
          !line.endsWith(":") &&
          !hasStepEmoji(line) &&
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
        ingredientGroups.push(currentGroup);
        continue;
      }

      if (state === "ZUBEREITUNG") {
        // Notiz-/Alternativzeilen ("( erhältlich bei … )", "alternativ 25g Ofen Chips")
        // beschreiben die vorherige Zutat – sie sind kein Zubereitungsschritt.
        if (isNoteLine(line)) {
          if (result.ingredients.length > 0) {
            result.ingredients[result.ingredients.length - 1] += ` ${line}`;
          } else {
            result.other.push(line);
          }
          continue;
        }

        // Falls wir eine Sub-Überschrift finden (z.B. Zubereitung Füllung), geht's wieder in die Zutaten!
        if (isSubIngredientHeader(line)) {
          state = "ZUTATEN";
          if (isPureGroupHeader(line)) {
            currentGroup = cleanGroupTitle(line);
            continue;
          }
        }

        // Wenn ein neuer Rezept-Block beginnt (z.B. englische Übersetzung), abbrechen
        const cleanLower = normalizeHeader(line);
        const isNewRecipe = 
          vocab.ingredientMarkers.some((m) => cleanLower === m || cleanLower === m + " english" || cleanLower === m + " deutsch") ||
          vocab.stepMarkers.some((m) => cleanLower === m || cleanLower === m + " english" || cleanLower === m + " deutsch");
        
        if (isNewRecipe && result.steps.length > 1) {
          state = "SONSTIGES";
          result.other.push(line);
          continue;
        }

        // Überspringe explizite Zubereitungs-Überschriften, die fälschlicherweise als Schritt gewertet würden
        if (isStepMarkerHeading(line) && line.split(" ").length <= 3) {
          continue;
        }

        // Wenn wir nicht durch einen expliziten Zubereitungs-Marker hier gelandet sind,
        // und die Zeile eindeutig wie eine Zutat aussieht: Zurück zu ZUTATEN!
        if (!hasExplicitStepMarker) {
          const isStepPrefix = /^\d+[.)]?$/.test(line) || hasStepNumbering(line);
          const isIng =
            !isStepPrefix &&
            !hasVerbOrSequenceStart(line) &&
            (looksLikeIngredient(line) >= 2 ||
              (/^[-•*]\s*\d/.test(line) && looksLikeIngredient(line) >= 1) ||
              // Aufgezählte Zeile ohne Kochverb bleibt ein Listeneintrag,
              // auch wenn sie nach einem Temperaturhinweis steht ("❌ Yummy Drops").
              (startsNewItem(line) && !/[.!?]\s*$/.test(line)));
          if (isIng) {
            state = "ZUTATEN";
            result.ingredients.push(line);
            ingredientGroups.push(currentGroup);
            continue;
          }
        }

        // Überschrift, aufgezählte Zutaten-Nennung (Schicht-Liste) oder
        // Footer-/Linkzeile → kein Schritt
        if (
          isCreditOrLinkLine(line) ||
          looksLikeHeading(line, lines[i + 1]) ||
          isStepLeadIn(line, lines.slice(i + 1, i + 3)) ||
          isListItemWithoutVerb(line)
        ) {
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
    const suspiciousSteps = result.steps.filter(
      (s) => looksLikeIngredient(s) >= 2 && !hasVerbOrSequenceStart(s) && !hasStepNumbering(s),
    );
    // Zutaten, die eigentlich Nährwerte, Portionsangaben oder Überschriften sind,
    // sind ein starkes Signal dafür, dass diese Strategie daneben liegt.
    const suspiciousIngredients = result.ingredients.filter(
      (i) =>
        isNutritionLine(i) ||
        /^(?:pro|je)\s+portion\b/i.test(i) ||
        /^(?:zutaten|zubereitung|anleitung|nährwerte)\b/i.test(i.replace(/^[^\p{L}]+/u, "").trim()),
    );

    if (suspiciousSteps.length > 0 || suspiciousIngredients.length > 0) {
      result.confidence = Math.max(
        0.1,
        0.85 - suspiciousSteps.length * 0.15 - suspiciousIngredients.length * 0.2,
      );
    } else if (result.ingredients.length > 0 && result.steps.length > 0) {
      result.confidence = 0.85;
    } else if (result.ingredients.length > 0) {
      result.confidence = 0.55;
    } else {
      result.confidence = 0.2;
    }

    return result;
  },
};



