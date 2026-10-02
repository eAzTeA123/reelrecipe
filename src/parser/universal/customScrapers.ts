import * as cheerio from "cheerio";
import type { RecipeTimes } from "./types";
import { cleanHtmlText, extractJsonLd } from "./structuredData";

/** Entfernt Tags, fügt aber an Tags Leerzeichen ein, damit Inline-Spans nicht kleben */
function cleanHtmlTextWithSpacing(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bereinigt Chefkoch-typische Formatierungsfehler in Zutatenzeilen */
function normalizeChefkochIngredient(line: string): string {
  return (
    line
      // Chilischote(n)frische → Chilischote(n), frische
      .replace(/(\(n\))([a-zäöüß])/i, "$1, $2")
      // Rigatonioder Penne → Rigatoni oder Penne
      .replace(/(\p{L})(oder\s)/gu, "$1 $2")
      // Sahne200 ml → Sahne 200 ml
      .replace(/(\p{L}{2,})(\d)/gu, "$1 $2")
      // Cherrytomate(n)400 g falsch? eher selten, aber vorsichtshalber
      .replace(/(\))(\d)/g, "$1 $2")
      // n.B. → n. B.
      .replace(/\bn\s*\.?\s*B\s*\./gi, "n. B.")
  );
}

export interface CustomScraperResult {
  title?: string;
  ingredients?: string[];
  instructions?: string[];
  image?: string;
  servings?: number;
  times?: RecipeTimes;
  description?: string;
}

export type CustomScraperFn = (html: string, url: string) => Promise<CustomScraperResult | null> | CustomScraperResult | null;

/**
 * 1. Dedicated Chefkoch.de Scraper
 * Combines Chefkoch's rich JSON-LD (in @graph) and DOM elements
 * (table.ingredients, .ds-recipe-info, etc.) for maximum precision.
 */
export function scrapeChefkoch(html: string): CustomScraperResult | null {
  const $ = cheerio.load(html);

  // A. Check for JSON-LD first
  const jsonLd = extractJsonLd(html);

  let title = jsonLd?.title;
  let ingredients = jsonLd?.ingredients;
  let instructions = jsonLd?.instructions;
  let image = jsonLd?.image;
  let servings = jsonLd?.servings;
  let times = jsonLd?.times;

  // B. Fallback/Augment with Chefkoch DOM selectors
  // Title: Chefkoch hängt im JSON-LD den Autor an ("Toast Hawaii von acigrand"),
  // die Seitenüberschrift ist sauber – daher bevorzugt.
  const h1 = cleanHtmlText($("h1.recipe-title, h1.ds-heading-primary, h1").first().text());
  if (h1) title = h1;
  else if (title) title = title.replace(/\s+von\s+\S+$/i, "");

  if (!image) {
    image = $('meta[property="og:image"]').attr("content") || undefined;
  }

  // Chefkoch's DOM ingredient table preserves amounts & units better than JSON-LD strings.
  const domIngredients: string[] = [];
  $("table.ingredients tr, table.in-recipe-ingredients tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const qty = cleanHtmlTextWithSpacing($(tds[0]).html());
      const name = cleanHtmlTextWithSpacing($(tds[1]).html());
      if (name) {
        domIngredients.push(qty ? `${qty} ${name}` : name);
      }
    } else if (tds.length === 1) {
      const line = cleanHtmlTextWithSpacing($(tds[0]).html());
      if (line) domIngredients.push(line);
    }
  });
  if (domIngredients.length > 0) {
    ingredients = domIngredients.map(normalizeChefkochIngredient);
  }

  // Instructions from Chefkoch's ds-box / recipe-text
  if (!instructions || instructions.length === 0) {
    const list: string[] = [];
    $("article.recipe-instructions, div.ds-box").each((_, box) => {
      // Find instruction text inside
      const text = $(box).text().trim();
      if (
        text.length > 20 &&
        !text.includes("Zutaten") &&
        !text.includes("Kommentare")
      ) {
        const parts = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        list.push(...parts);
      }
    });
    if (list.length > 0) instructions = list;
  }

  // Servings from input or text
  if (!servings) {
    const servingsInput = $('input[name="portionen"], input[name="servings"], .recipe-servings input').attr("value");
    if (servingsInput) {
      servings = parseInt(servingsInput, 10) || undefined;
    }
  }

  // Times from .recipe-preptime / .ds-recipe-info
  if (!times) {
    const preptimeText = $(".recipe-preptime, .ds-recipe-info").text();
    if (preptimeText) {
      const match = preptimeText.match(/(\d+)\s*Min/i);
      if (match) {
        times = { total: parseInt(match[1], 10) };
      }
    }
  }

  // Image from picture / img
  if (!image) {
    const imgUrl = $("picture img.recipe-image, .ds-recipe-image img").attr("src");
    if (imgUrl) image = imgUrl;
  }

  if (title || (ingredients && ingredients.length > 0)) {
    return {
      title,
      ingredients,
      instructions,
      image,
      servings,
      times,
    };
  }

  return null;
}

/**
 * 2. Dedicated Essen & Trinken Scraper
 * Handles JSON-LD and clean section structure
 */
export function scrapeEssenUndTrinken(html: string): CustomScraperResult | null {
  const $ = cheerio.load(html);
  const jsonLd = extractJsonLd(html);

  let title = jsonLd?.title;
  let ingredients = jsonLd?.ingredients;
  let instructions = jsonLd?.instructions;
  const image = jsonLd?.image;
  const servings = jsonLd?.servings;
  const times = jsonLd?.times;

  if (!title) {
    title = cleanHtmlText($("h1").first().text());
  }

  if (!ingredients || ingredients.length === 0) {
    const list: string[] = [];
    $(".recipe-ingredients li, .ingredients li").each((_, li) => {
      const line = cleanHtmlText($(li).text());
      if (line) list.push(line);
    });
    if (list.length > 0) ingredients = list;
  }

  if (!instructions || instructions.length === 0) {
    const list: string[] = [];
    $(".recipe-steps li, .preparation-step").each((_, el) => {
      const line = cleanHtmlText($(el).text());
      if (line) list.push(line);
    });
    if (list.length > 0) instructions = list;
  }

  if (title || (ingredients && ingredients.length > 0)) {
    return {
      title,
      ingredients,
      instructions,
      image,
      servings,
      times,
    };
  }

  return null;
}

/**
 * 3. Dedicated Küchengötter Scraper
 */
export function scrapeKuechengoetter(html: string): CustomScraperResult | null {
  const jsonLd = extractJsonLd(html);
  if (jsonLd) {
    return {
      title: jsonLd.title,
      ingredients: jsonLd.ingredients,
      instructions: jsonLd.instructions,
      image: jsonLd.image,
      servings: jsonLd.servings,
      times: jsonLd.times,
    };
  }
  return null;
}

/**
 * 4. rezeptwelt.de (Thermomix®-Community)
 *
 * Warum ein eigener Scraper: Die Seite liefert **kein JSON-LD** (gemessen: 0
 * Blöcke) – der generische Pfad hat deshalb nur geraten. Sie zeichnet aber
 * sauber mit Microdata aus:
 *
 * - `meta[itemprop="name"]` → Rezeptname („Spinat Risotto"); die `<title>`-Zeile
 *   hängt Autor, Kategorie und „Thermomix®" an und ist als Titel unbrauchbar.
 * - `li[itemprop="recipeIngredient"]` → Zutaten. Betrag, Einheit und Name stehen
 *   in **getrennten** `<span>`-Elementen („150" + " g" + " Parmesan, " +
 *   "ggf. weniger") und müssen ohne Trennzeichen verbunden werden.
 * - `[itemprop="recipeInstructions"]` → Zubereitung. Ein Abschnitt enthält
 *   **mehrere** `<p>`; jeder Absatz ist ein eigener Schritt. Ohne diese Trennung
 *   landet die ganze Anleitung als ein Klumpen im Rezept.
 *
 * Thermomix-Eigenheit: Einstellungen wie „Mixtopf geschlossen" oder „Linkslauf"
 * stehen als Symbolbild **plus verstecktem Text** (`b.tmrc-custom-buttons-name`,
 * Bootstrap-Klasse `d-none`). Unbehandelt bleibt entweder eine Lücke im Satz
 * („Parmesan in den geben") oder doppelter Text. Deshalb wird das Symbol durch
 * sein sichtbares Wort ersetzt.
 */
const REZEPTWELT_SYMBOLS: Record<string, string> = {
  "mixtopf geschlossen": "Mixtopf",
  "mixtopf offen": "Mixtopf",
  linkslauf: "Linkslauf",
  rühren: "Rühren",
  ruehren: "Rühren",
  sanft: "Sanft",
  softmodus: "Sanft",
  waage: "",
  deckel: "",
  timer: "",
};

/** Text eines rezeptwelt-Knotens: Symbole ersetzt, versteckte Texte entfernt. */
function rezeptweltText(html: string | null | undefined): string {
  if (!html) return "";
  const $ = cheerio.load(`<div id="rezeptwelt-root">${html}</div>`);
  const $root = $("#rezeptwelt-root");
  // Versteckter Doppeltext zum Symbol
  $root.find("b.tmrc-custom-buttons-name").remove();
  // Symbol durch sein Wort ersetzen (mit Leerzeichen, damit nichts klebt)
  $root.find("img.tmrc-icons").each((_, element) => {
    const $icon = $(element);
    const label = ($icon.attr("title") ?? $icon.attr("alt") ?? "").trim();
    const replacement = REZEPTWELT_SYMBOLS[label.toLowerCase()] ?? label;
    $icon.replaceWith(replacement ? ` ${replacement} ` : " ");
  });
  $root.find("br").replaceWith(" ");
  // `.text()` statt Tag-für-Tag-Ersetzung: Die Seite teilt Zahlen in
  // verschachtelte Elemente („5" + „0 g") – mit einem Leerzeichen je Tag würde
  // daraus „5 0 g". `\s` erfasst auch das geschützte Leerzeichen (&nbsp;).
  return $root
    .text()
    .replace(/\s+/g, " ")
    // Thermomix-Schreibweise zusammenziehen: „100°/ Linkslauf/Stufe 1" → „100°/Linkslauf/Stufe 1"
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

export function scrapeRezeptwelt(html: string): CustomScraperResult | null {
  const $ = cheerio.load(html);

  const title =
    ($('meta[itemprop="name"]').attr("content") ?? "").trim() ||
    ($('meta[property="og:title"]').attr("content") ?? "").trim() ||
    ($("h1 a[title]").first().attr("title") ?? "").trim() ||
    cleanHtmlText($("h1").first().text()) ||
    undefined;

  /**
   * Zutaten: Betrag, Einheit und Name stehen in getrennten `<span>`-Elementen.
   * Beim Verbinden muss ein Leerzeichen eingefügt werden, wenn zwei Teile sonst
   * zusammenkleben – die Seite liefert „30" + " g" + "Sahne or Kondensmilch",
   * woraus ohne Regel „30 gSahne or Kondensmilch" wurde (gemessen).
   *
   * Abschnitts-Überschriften innerhalb der Liste („Teig", „Belag, klassisch")
   * sind keine Zutaten: Sie haben genau einen Span, keine Ziffer und passen auf
   * die Überschriftwörter. Die App kennt keine Zutatengruppen, deshalb werden
   * sie übersprungen.
   */
  const REZEPTWELT_GROUP_RE =
    /^(?:teig|boden|belag|füllung|fuellung|guss|glasur|topping|sauce|soße|sosse|dressing|streusel|creme|crème|kräuter|kraeuter|gewürze|gewuerze|zutaten|für den|fuer den|für die|für das|sonstiges)\b/i;

  const ingredients: string[] = [];
  $('li[itemprop="recipeIngredient"]').each((_, element) => {
    const $item = $(element);
    const spans = $item
      .find("span")
      .toArray()
      .map((span) => $(span).text());
    const raw = spans.length > 0 ? spans : [$item.text()];
    const joined = raw.reduce((acc, part) => {
      if (!acc) return part;
      const needsSpace = /[\p{L}\d]$/u.test(acc) && /^[\p{L}\d]/u.test(part);
      return acc + (needsSpace ? " " : "") + part;
    }, "");
    const text = cleanHtmlTextWithSpacing(joined);
    if (!text) return;
    const isGroupHeader =
      spans.length === 1 && !/\d/.test(text) && (REZEPTWELT_GROUP_RE.test(text) || /:\s*$/.test(text));
    if (isGroupHeader) return;
    ingredients.push(text);
  });

  /**
   * Zubereitung: Abschnitts-Überschriften stehen in `<p>` (fett, mit
   * Doppelpunkt), die eigentlichen Schritte in `<ul>`/`<ol>`-Listen. Vorher
   * wurden nur die `<p>` gelesen – dadurch bestand das Rezept ausschließlich aus
   * Überschriften („Teig:", „Edelvariante:") und die Anleitung fehlte.
   * Jetzt bekommt jeder Listenschritt seine Überschrift als Präfix, genau wie
   * die Seite selbst es in `meta[itemprop="name"]` tut („Teig: Alle …").
   */
  const instructions: string[] = [];
  const seen = new Set<string>();
  const pushStep = (text: string) => {
    if (text.length < 3 || seen.has(text)) return;
    // Manche Seiten liefern die Anleitung zweimal: sichtbar als <p>-Absätze und
    // zusätzlich (versteckt) als <li>-Liste, deren Einträge abgeschnitten sind
    // („… Olivenöl "). Ein gemeinsamer Anfang mit einem bereits erfassten Schritt
    // verrät das Teil-Duplikat.
    const MIN_SHARED = 40;
    const duplicate = instructions.some((existing) => {
      const shared = Math.min(existing.length, text.length);
      return shared >= MIN_SHARED && existing.slice(0, shared) === text.slice(0, shared);
    });
    if (duplicate) return;
    seen.add(text);
    instructions.push(text);
  };

  $('[itemprop="recipeInstructions"]').each((_, element) => {
    const $section = $(element);
    let heading = "";
    $section.find("p, li").each((__, node) => {
      const $node = $(node);
      const tag = String($node.prop("tagName") ?? "").toLowerCase();
      const text = rezeptweltText($node.html());
      if (!text) return;
      if (tag === "li") {
        // Ein <li>, das Blockelemente (p/ul/ol) oder weitere <li> enthält, ist der
        // Umschlag des Abschnitts (HowToStep um die eigentliche Anleitung) – kein
        // eigener Schritt. Sonst entsteht ein Sammelblock mit der ganzen Anleitung
        // und die Einzelschritte fehlen (gemessen auf beiden Seiten).
        if ($node.find("li, p, ul, ol").length > 0) return;
        pushStep(heading ? `${heading}: ${text}` : text);
        return;
      }
      // Überschrift nur, wenn sie auf einen Doppelpunkt endet. Absätze wie
      // „Backtemperatur: 250° Backzeit: ca. 20 Min." sind Hinweise, keine Titel.
      if (/:\s*$/.test(text)) {
        heading = text.replace(/:\s*$/, "").trim();
        return;
      }
      pushStep(text);
    });
  });

  const image =
    ($('meta[property="og:image"]').attr("content") ?? "").trim() ||
    ($("img.recipe-main-image").first().attr("src") ?? "").trim() ||
    undefined;

  // Tipps: rezeptwelt zeichnet sie mit `itemprop="recipeHint"` aus (schema.org)
  // und stellt sie unter die Überschrift „Tipp". Sie sind weder Zutat noch
  // Schritt, gehören aber ins Rezept – die App zeigt sie als Beschreibung.
  const hints: string[] = [];
  const collectHints = (selector: string) => {
    $(selector).each((_, element) => {
      const text = rezeptweltText($(element).html());
      if (text.length > 2 && !hints.includes(text)) hints.push(text);
    });
  };
  collectHints('[itemprop="recipeHint"] p, [itemprop="recipeHint"] li');
  if (hints.length === 0) {
    // Rückfall für Rezepte, die nur den Container mit Überschrift nutzen
    collectHints("div.tips p, div.tips li");
  }
  const description =
    hints.length === 0
      ? undefined
      : hints.length === 1
        ? `Tipp: ${hints[0]}`
        : `Tipps: ${hints.map((hint) => `• ${hint}`).join(" ")}`;

  // Zeiten und Portionen stehen in einem JS-Datenblock der Seite:
  // {"recipe_name":"Spinat Risotto","preparation_time_min":15,"total_time_min":15,"portions":0,…}
  const prep = Number(html.match(/"preparation_time_min"\s*:\s*(\d+)/)?.[1]);
  const total = Number(html.match(/"total_time_min"\s*:\s*(\d+)/)?.[1]);
  const portions = Number(html.match(/"portions"\s*:\s*(\d+)/)?.[1]);
  const times: RecipeTimes = {};
  if (Number.isFinite(prep) && prep > 0) times.prep = prep;
  if (Number.isFinite(total) && total > 0) times.total = total;

  if (!title && ingredients.length === 0 && instructions.length === 0) return null;

  return {
    title,
    ingredients: ingredients.length > 0 ? ingredients : undefined,
    instructions: instructions.length > 0 ? instructions : undefined,
    image,
    description,
    // `portions: 0` heißt „keine Angabe" – dann lieber nichts setzen als 0.
    servings: Number.isFinite(portions) && portions > 0 ? portions : undefined,
    times: Object.keys(times).length > 0 ? times : undefined,
  };
}

/**
 * Registry of custom site-specific scrapers.
 * Host matching supports domains and subdomains.
 */
export const CUSTOM_SCRAPERS: Record<string, CustomScraperFn> = {
  "chefkoch.de": scrapeChefkoch,
  "essen-und-trinken.de": scrapeEssenUndTrinken,
  "kuechengoetter.de": scrapeKuechengoetter,
  "rezeptwelt.de": scrapeRezeptwelt,
};

/**
 * Checks whether a custom site-specific scraper is registered for this host.
 */
export function getCustomScraperForUrl(urlStr: string): CustomScraperFn | null {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    for (const [key, fn] of Object.entries(CUSTOM_SCRAPERS)) {
      if (host === key || host.endsWith("." + key)) {
        return fn;
      }
    }
  } catch {
    // not a valid URL
  }
  return null;
}
