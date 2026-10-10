import type { Ingredient, ParsedRecipe } from "@/domain/types";
import { splitLines } from "./normalize";
import {
  parseIngredientLine,
  toIngredient,
  expandIngredientLine,
  stripMultiplierHeaders,
} from "./ingredient";
import { makeSteps } from "./steps";
import { deriveIngredientsFromSteps } from "./deriveIngredients";
import { parseServings, parseTimes, pickTitle, cleanTitle, isPlausibleTitle, extractTitleFromHeadline } from "./meta";
import { ensembleStrategy, ALL_STRATEGIES } from "./strategies/ensemble";
import { markerBasedStrategy } from "./strategies/markerBased";
import { lineStateMachineStrategy } from "./strategies/lineStateMachine";
import { sentenceStateMachineStrategy } from "./strategies/sentenceStateMachine";

export { splitLines } from "./normalize";
export { parseIngredientLine } from "./ingredient";
export { parseAmountString } from "./quantity";
export { UNIT_LABELS, canonicalUnit } from "./units";
export {
  ensembleStrategy,
  markerBasedStrategy,
  lineStateMachineStrategy,
  sentenceStateMachineStrategy,
  ALL_STRATEGIES,
};

/**
 * Inkrement bei jeder wesentlichen Parser-Änderung.
 *
 * **Wichtig:** Diese Zahl ist der Auslöser für die Neu-Einlese-Migration
 * (`data/local/migrationService.ts`): Beim App-Start werden alle Rezepte mit
 * `parserVersion < PARSER_VERSION` aus ihrer gespeicherten Caption neu geparst –
 * über den schützenden Merge, eigene Änderungen bleiben also erhalten
 * (Rückmeldung als Toast in `MigrationRunner`).
 *
 * Version 25: Nummerierte Anweisungen sind unantastbar (1, 2, 7 wurden in
 * marker_based verworfen - Rezept 12 hatte 5 statt 7 Schritte), Pfeil-/Zeitangaben
 * haengen am Schritt darueber, Strukturzeilen sind in den Strategien keine Schritte
 * mehr, kurze Komma-Aufzaehlungen werden geteilt und Klammer-Listen bleiben
 * zusammen (Klammer-Zusatz wird Notiz).
 *
 * Version 24: Befunde der redaktionellen Pruefung aller 45 Rezepte: Instagram-
 * Resttext wird aus Schritten entfernt (auch 'Alle 21Kommentare ansehen'), nackte
 * Ueberschriftenwoerter sind keine Schritte, Zutaten-Phantome aus Anleitungstext
 * (Handlungs-/Einleitungsworte) entfallen, Abschnittsangaben mit englischem oder
 * besitzanzeigendem Artikel sind Ueberschriften, und Backofenangaben mit Verb in
 * der Mitte gelten als Anweisung.
 *
 * Version 23: Typografische Apostrophe werden vereinheitlicht (SO GEHT'S wurde
 * sonst nicht als Anleitung erkannt - das Rezept hatte KEINE Schritte).
 * Gruppenwoerter werden ohne Bindestrich/Leerzeichen verglichen (FRISCHKAESE-GUSS
 * stand als Zutat in der Liste) und die Gruppenzuordnung ignoriert Listenzeichen
 * (Bullet), sodass TEIG bei '- 500 g Mehl' nicht mehr verloren ging.
 *
 * Version 22: Naehrwertzeilen im englischen Meal-Prep-Stil (481 Calories,
 * 43g Protein) sind keine Zutaten mehr, ebenso Etiketten mit Klammerzahl
 * (The Best Buff Chicken Subs (makes 12):). Dazu holt der Import die Caption aus
 * der Embed-Seite, weil og:description abgeschnitten ist.
 *
 * Version 21: Zutaten bleiben getrennt. Kurze Zeilen ohne eigenes Mengenwort
 * wurden vorher **jede** an die Zeile darueber gehaengt - dadurch verschmolzen echte
 * Zutaten (gemeldet: italienische Kraeuter + Salz & Pfeffer + frische Petersilie).
 * Ausserdem: Etiketten (Chicken:, Icing:, Ofen:) und Backofenangaben sind keine
 * Zutaten mehr, ganze Kochsaetze wandern in die Schritte, Alternativ-Angaben
 * (z. B. Gouda) werden Notiz statt Zutat, und eine reine Aufzaehlung ohne Mengen
 * (Salz Pfeffer, Knoblauchpulver, Paprika) wird geteilt. Der Merge legt eine Zutat
 * nach einem Gruppenwechsel nicht mehr doppelt an.
 *
 * Version 20: Abschnitts-Ueberschriften in Zutatenlisten (Teig, Belag, FUELLUNG)
 * sind keine Zutaten mehr, sondern landen im neuen Feld Ingredient.group - Namen
 * wie 'Salz FUELLUNG' entstehen damit nicht mehr. Zeilen, die Ueberschrift und
 * Zutaten mischen (Gewuerze: Salz, Pfeffer), bleiben Zutatenzeilen. Ausserdem:
 * fremde Akzente (Creme fraiche) werden erkannt, und gleiche Zutaten in
 * verschiedenen Gruppen fasst der Merge nicht mehr zusammen.
 *
 * Version 19: Eine Zeile mit **eigener** Menge ohne Ziffer ist eine neue Zutat,
 * keine Fortsetzung der Zeile darüber – „Halben Bund Lauch oder 1 Stange Porree"
 * wurde sonst an „250 g gewürfelten Speck" gehängt (gemeldeter Fall). Ebenso
 * zählen Zeilen, die mit einer Einheit beginnen („Bund Petersilie").
 *
 * Version 18: Unicode-Brüche auch in einzelnen Zutatenzeilen („¼ TL" kam vom
 * Seiten-Scraper und blieb ohne Menge), und rezeptwelt-Seiten mit Abschnitten
 * („Teig", „Belag") – Überschriften sind keine Zutaten, und die Anleitung steht
 * in den Listen, nicht in den Absätzen.
 */
export const PARSER_VERSION = 25;

import {
  isSectionHeader as isSectionHeaderLine,
  isPureGroupHeader,
  isTemperatureLine,
  isEquipmentLine,
  isTemperatureInstruction,
  isLabelLine,
  cleanGroupTitle,
} from "./lineFacts";

function isSectionHeader(l: string): boolean {
  return isSectionHeaderLine(l);
}

/**
 * Gruppen je Zutatenzeile direkt aus der Caption lesen.
 *
 * Nötig, weil die Ensemble-Pipeline je nach Text eine andere Strategie wählt und
 * nur die Zustandsmaschine Gruppen liefert. Diese Zuordnung ist unabhängig davon:
 * Sie läuft einmal über die Zeilen, merkt sich die letzte Überschrift und ordnet
 * jede Zeile ihrer Gruppe zu (Schlüssel: die Zeile selbst).
 */
/**
 * Zeilenschlüssel für den Gruppenvergleich: ohne Listenzeichen, Emojis und
 * Groß-/Kleinschreibung (siehe `groupByLine`).
 */
function groupKey(value: string): string {
  return value
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/^[\s\-*+~#>\u2022\u2705\u2611\uFE0F]+/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function groupByLine(caption: string): Map<string, string> {
  const map = new Map<string, string>();
  let current: string | undefined;
  for (const line of splitLines(caption)) {
    // Nur reine Überschriften wechseln die Gruppe; „Gewürze: Salz, Pfeffer" ist
    // eine Zutatenzeile und darf die folgende Zeile nicht umbenennen.
    if (isPureGroupHeader(line)) {
      current = cleanGroupTitle(line);
      continue;
    }
    if (current) map.set(groupKey(line), current);
  }
  return map;
}

export function parseRecipe(caption: string): ParsedRecipe | null {
  const lines = splitLines(caption);
  if (lines.length === 0) return null;

  // Nutze die Hybrid-Ensemble-Pipeline
  const raw = ensembleStrategy.parse(caption);
  const groupsFromCaption = groupByLine(caption);

  /*
   * Zutatenzeilen wandern mit ihrer **Gruppe** durch die Aufbereitung. Die Gruppe
   * kommt index-gleich aus der Strategie (siehe `strategies/types.ts`) oder – wenn
   * die gewählte Strategie keine kennt – aus der Caption selbst.
   * `expandIngredientLine` kann eine Zeile in mehrere Zutaten zerlegen; alle
   * erben dieselbe Gruppe.
   */
  const linesWithGroups = raw.ingredients.map((line, index) => ({
    line,
    group: raw.ingredientGroups?.[index] ?? groupsFromCaption.get(groupKey(line)),
  }));
  const keepLines = new Set(stripMultiplierHeaders(linesWithGroups.map((entry) => entry.line)));

  const ingredients: Ingredient[] = [];
  // Backofen-Anweisungen mit Verb werden zu Schritten (siehe unten)
  const instructionLines: string[] = [];
  for (const entry of linesWithGroups) {
    if (!keepLines.has(entry.line)) continue;
    /*
     * Abschnitts-Überschriften sind Gruppen, keine Zutaten. Die Zustandsmaschine
     * liefert reine Überschriften schon nicht mehr; andere Strategien tun es noch.
     * Zeilen, die Überschrift **und** Zutaten enthalten („Gewürze: Salz, Pfeffer"),
     * bleiben Zutatenzeilen – sonst gingen diese Zutaten verloren.
     */
    if (isPureGroupHeader(entry.line)) continue;
    /*
     * Backofenangabe MIT Handlungsverb ("Preheat oven to 180C / 360F") ist eine
     * Anleitung, keine Einstellung. Zentral hier, weil je nach Caption eine andere
     * Strategie gewinnt und nur die Zustandsmaschine das sonst kennen wuerde.
     * Solche Zeilen stehen praktisch immer vor dem ersten Arbeitsschritt.
     */
    if (isTemperatureInstruction(entry.line)) {
      instructionLines.push(entry.line);
      continue;
    }

    // Backofen-/Herdangabe ist eine Einstellung, keine Zutat
    if (isTemperatureLine(entry.line)) continue;
    // Gefaessgroesse (24 oz Bowl size) ist Ausstattung, keine Zutat
    if (isEquipmentLine(entry.line)) continue;
    // Etikett ohne Zutatwort (z.B. The Best Buff Chicken Subs) gehoert nicht in die Liste
    if (isLabelLine(entry.line)) continue;
    for (const variant of expandIngredientLine(entry.line)) {
      const parsed = parseIngredientLine(variant);
      if (!parsed) continue;
      ingredients.push({ ...toIngredient(parsed), group: entry.group });
    }
  }

  /*
   * Hinweis zur Dubletten-Regel: Der Parser bleibt hier **faithful** und fasst
   * nichts zusammen (sonst verliert die Korpus-Messung Recall, weil die Messlatte
   * den gespeicherten Bestand mit Dubletten abbildet – gemessen: F1 0,982 →
   * 0,976). Zusammengefasst wird erst beim Speichern/Migrieren, und zwar
   * gruppenbewusst: identische Zeilen derselben Gruppe ja, dieselbe Zutat in
   * Teig/Füllung/Guss nein (`data/local/parseMerge.ts`, `entryKeyWithGroup`).
   */
  const steps = makeSteps([...instructionLines, ...raw.steps]);

  if (ingredients.length === 0 && steps.length === 0) {
    return null;
  }

  // Zutaten, die nur in der Anleitung genannt sind, ergänzen (Einkaufsliste!)
  ingredients.push(
    ...deriveIngredientsFromSteps(
      steps.map((s) => s.instruction),
      ingredients,
    ),
  );

  const meta = parseTimes(lines);
  let title =
    raw.title && !isSectionHeader(raw.title) && isPlausibleTitle(raw.title)
      ? cleanTitle(raw.title)
      : "";

  if (!title || title.length < 3) {
    const picked = pickTitle(lines, isSectionHeader);
    title = picked ? cleanTitle(picked) : "";
  }

  // Marketing-Headlines als letzte Chance vor dem Zutaten-Fallback.
  // Fenster bewusst größer als 3 Zeilen: Captions beginnen oft mit
  // "ZUM REZEPT ⬇️ / . / ." und der echte Titel steht erst darunter.
  if (!title || title.length < 3) {
    for (const line of lines.slice(0, 10)) {
      const derived = extractTitleFromHeadline(line);
      if (derived) {
        title = derived;
        break;
      }
    }
  }

  if (!title || title.length < 3) {
    // Letzter Ausweg: die erste Zutat – aber nur, wenn sie als Titel taugt.
    // Sonst wurde aus einer durchgesickerten Überschrift ("Zutaten") oder einer
    // Werbezeile der Rezeptname.
    const candidate = ingredients[0]?.name.replace(/\s*\(.*?\)/g, "").trim() ?? "";
    if (candidate.length >= 3 && !isSectionHeader(candidate) && isPlausibleTitle(candidate)) {
      title = candidate;
    }
  }

  title = title || "Neues Rezept";

  return {
    title: title || "Neues Rezept",
    servings: parseServings(lines),
    prepTime: meta.prepTime,
    cookTime: meta.cookTime,
    ingredients,
    steps,
  };
}










