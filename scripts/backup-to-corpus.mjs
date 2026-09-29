#!/usr/bin/env node
/**
 * Überführt ein App-Backup in Corpus-Fixtures für den Parser.
 *
 * Aufruf:
 *   node scripts/backup-to-corpus.mjs <pfad-zum-backup.json> [--dry]
 *
 * Warum: Der Parser wird an echten Captions gemessen. Die gespeicherte Fassung
 * aus der eigenen Bibliothek ist die beste verfügbare "Wahrheit" – sie ist aber
 * von Hand bearbeitet. Deshalb gilt:
 *   - `expected` = gespeicherte Fassung
 *   - offensichtliche Fremdkörper (Promo/CTA, Gruppen-Überschriften) fliegen
 *     heraus, weil sie Fehler sind, die wir gerade beheben wollen – jede
 *     Entfernung wird im Feld `notes` festgehalten (nachvollziehbar).
 *   - ein unbrauchbarer gespeicherter Titel wird zu `title: null`
 *     (Konvention des Corpus: "die Caption enthält keinen Titel").
 *
 * Es werden nur Rezepte mit `sourceCaption` übernommen. Vorhandene Fixtures
 * werden nie überschrieben (neue IDs beginnen mit "lib-").
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/**
 * Eigener Ordner für Fixtures aus der eigenen Bibliothek: so bleibt der
 * bestehende Corpus-Test grün, bis die neue Gruppe die Schwellen erfüllt.
 */
const outArg = process.argv.find((a) => a.startsWith("--out="));
const FIXTURE_DIR = outArg
  ? join(here, "..", outArg.slice("--out=".length))
  : join(here, "..", "src", "parser", "corpus", "fixtures-user");

const backupPath = process.argv[2];
const dryRun = process.argv.includes("--dry");
if (!backupPath) {
  console.error("Aufruf: node scripts/backup-to-corpus.mjs <backup.json> [--dry]");
  process.exit(2);
}

/** Zeilen, die keine Zutat und kein Schritt sind (Fehler, die wir beheben). */
const JUNK = [
  /folgt uns/i,
  /folge mir/i,
  /folgt mir/i,
  /gerne für mehr/i,
  /speichern\s*&\s* nachmachen/i,
  /^perfekt für/i,
  /^probiert es aus/i,
  /link in bio/i,
  /rabattcode/i,
  // Werbe-/Code-Zeilen, die in echten Bibliotheken als Zutat landen
  /code\s+\w+\s+(?:sparen|gibt)/i,
  /\bsparen\b/i,
  /@[\w.]+\.(?:de|com|at|ch)/i,
  /cookbook/i,
  /kommentier/i,
  /discount/i,
  /^anzeige$/i,
  /^werbung$/i,
  /^\W*mit dem code/i,
  /^mahlzeit\b/i,
];
/** Gespeicherte Titel, die keine Titel sind. */
const BAD_TITLES = [
  /^zutaten:?$/i,
  /^zubereitung:?$/i,
  /^nährwerte:?$/i,
  /^portionen:?$/i,
  /^mengenangaben:?$/i,
  /^neues rezept$/i,
  /^rezept$/i,
];
/**
 * Marketingsatz als gespeicherter Titel ("Wenn's schnell gehen muss, …",
 * "Ich teste jede Woche …"). Das ist die vom Nutzer übernommene Parser-Schwäche
 * – als Erwartung würde sie jeden Titel-Fix bestrafen.
 */
const TITLE_SENTENCE = /\b(?:ich|wir|du|dir|dich|wenn|falls|folge|folgt|speichere|teste|probiert|schau|check|save)\b/i;
function isHeadlineTitle(title) {
  const t = (title || "").trim();
  if (!t) return false;
  if (t.length > 40 && TITLE_SENTENCE.test(t)) return true;
  return t.length > 60;
}
/** Struktur-/Überschriftenzeilen, die keine Zutaten sind. */
const HEADING = [
  /^(?:für|for)\s+(?:den|die|das|demn|dem|der|the)\b/i,
  /^(?:zutaten|zubereitung|gewürze|gewuerze|belag|topping|sauce|soße|dressing|marinade|füllung|frosting|teig|crunch|dip|salat|burger|kategorien)\b:?$/i,
  /:$/,
];
/**
 * Rezepte, deren gespeicherte Schrittzahl nicht aus der Caption stammt
 * (Anleitung von Hand ergänzt) – die Schrittzahl wird dann nicht bewertet.
 */
const STEPS_UNRELIABLE = {
  "lib-dd0-4wriewb": "Die Caption enthält keine Anleitung; die Schritte wurden von Hand ergänzt.",
};

const isJunk = (text) => JUNK.some((re) => re.test(text.trim()));
const isHeading = (text) => HEADING.some((re) => re.test(text.trim()));
const isBadTitle = (title) => !title || BAD_TITLES.some((re) => re.test(title.trim())) || isHeadlineTitle(title);

/** Caption wirkt englisch → die gespeicherte Fassung ist evtl. übersetzt. */
const GERMAN_HINT = /\b(?:und|der|die|das|mit|für|von|zutaten|zubereitung|minuten|backen|g|ml|el|tl)\b/i;
function looksEnglish(caption) {
  const head = caption.slice(0, 400);
  const english = (head.match(/\b(?:the|and|with|for|you|your|this|add|cook|minutes|salt|pepper|chicken|cream)\b/gi) || []).length;
  const german = (head.match(/\b(?:und|der|die|das|mit|für|von|zutaten|zubereitung|minuten)\b/gi) || []).length;
  return english >= 3 && german === 0;
}

function shortcodeFrom(url) {
  const match = typeof url === "string" ? url.match(/\/(?:reel|p|tv|video)\/([A-Za-z0-9_-]+)/) : null;
  return match?.[1]?.toLowerCase();
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[c])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

const backup = JSON.parse(readFileSync(backupPath, "utf-8"));
const recipes = Array.isArray(backup.recipes) ? backup.recipes : [];
if (!existsSync(FIXTURE_DIR)) mkdirSync(FIXTURE_DIR, { recursive: true });
const existing = new Set(
  existsSync(FIXTURE_DIR) ? readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".json")) : [],
);

let written = 0;
let skipped = 0;
const report = [];

recipes.forEach((recipe, index) => {
  const caption = typeof recipe.sourceCaption === "string" ? recipe.sourceCaption.trim() : "";
  if (!caption) {
    skipped++;
    return;
  }

  const notes = [];
  const storedTitle = typeof recipe.title === "string" ? recipe.title.trim() : "";
  let title = storedTitle;
  if (isBadTitle(storedTitle)) {
    title = null;
    notes.push(`Gespeicherter Titel war „${storedTitle || "(leer)"}" – als "kein Titel" gewertet.`);
  }

  const droppedIngredients = [];
  const ingredients = (recipe.ingredients || [])
    .filter((ing) => typeof ing?.name === "string" && ing.name.trim())
    .filter((ing) => {
      const name = ing.name.trim();
      if (isJunk(name) || isHeading(name)) {
        droppedIngredients.push(name);
        return false;
      }
      return true;
    })
    .map((ing) => ({
      amount: typeof ing.amount === "number" ? ing.amount : null,
      unit: typeof ing.unit === "string" && ing.unit.trim() ? ing.unit.trim() : null,
      name: ing.name.trim(),
    }));
  if (droppedIngredients.length > 0) {
    notes.push(`Aus den Zutaten entfernt (Werbung/Überschrift): ${droppedIngredients.join(" | ")}`);
  }

  const droppedSteps = [];
  const steps = (recipe.steps || [])
    .map((step) => (typeof step?.instruction === "string" ? step.instruction.trim() : ""))
    .filter(Boolean)
    .filter((text) => {
      if (isJunk(text)) {
        droppedSteps.push(text);
        return false;
      }
      return true;
    });
  if (droppedSteps.length > 0) {
    notes.push(`Aus den Schritten entfernt (Promo/Outro): ${droppedSteps.map((s) => s.slice(0, 60)).join(" | ")}`);
  }

  const shortcode = shortcodeFrom(recipe.sourceUrl) ?? `nr${index + 1}`;
  const id = `lib-${shortcode}`;
  const fileName = `${id}.json`;
  if (existing.has(fileName)) {
    skipped++;
    report.push(`  übersprungen (existiert): ${fileName}`);
    return;
  }

  // Sprachen-Gate: Bei englischer Caption ist die gespeicherte Fassung die
  // Anzeige-Übersetzung und damit keine gültige Wahrheit für den Parser.
  let exclude;
  if (looksEnglish(caption)) {
    exclude = "Caption ist englisch – die gespeicherte Fassung ist die übersetzte Anzeige-Fassung.";
    notes.push(exclude);
  } else if (ingredients.some((i) => /[a-z]{3,}/.test(i.name) && !GERMAN_HINT.test(i.name) && /\b(?:the|and|with|chicken|cheese|oil|salt|butter)\b/i.test(i.name))) {
    exclude = "Gespeicherte Zutaten enthalten englische Namen (Übersetzung) – keine gültige Wahrheit.";
    notes.push(exclude);
  }

  const fixture = {
    id,
    source: typeof recipe.sourceUrl === "string" && recipe.sourceUrl ? recipe.sourceUrl : "nutzer-backup",
    account: "eigene-bibliothek",
    language: "de",
    style: "real-instagram-nutzerfassung",
    caption,
    expected: {
      title,
      servings: typeof recipe.servings === "number" && recipe.servings > 0 ? recipe.servings : null,
      ingredients,
      stepsCount: steps.length,
    },
    ...(exclude ? { exclude } : {}),
    ...(STEPS_UNRELIABLE[id] ? { stepsUnreliable: STEPS_UNRELIABLE[id] } : {}),
    notes: [
      "Aus dem eigenen Backup übernommen: expected = gespeicherte Bibliotheksfassung (von Hand geprüft/gekürzt).",
      `Kennung der Vorlage: ${slug(storedTitle) || "ohne-titel"}`,
      ...notes,
    ].join(" "),
  };

  if (!dryRun) {
    writeFileSync(join(FIXTURE_DIR, fileName), `${JSON.stringify(fixture, null, 2)}\n`, "utf-8");
  }
  written++;
  report.push(
    `  ${dryRun ? "(dry)" : "neu"} ${fileName.padEnd(26)} Zutaten ${String(ingredients.length).padStart(2)} | Schritte ${String(steps.length).padStart(2)}${title ? "" : " | Titel: keiner"}`,
  );
});

console.log(`Backup: ${backupPath}`);
console.log(`Rezepte gesamt: ${recipes.length} · mit Caption: ${recipes.length - skipped} · neu geschrieben: ${written}`);
report.forEach((line) => console.log(line));
