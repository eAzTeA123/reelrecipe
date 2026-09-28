import type {
  ParseRecipeResult,
  UniversalRecipeExtraction,
} from "./types";
import { detectInputType } from "./detector";
import { fetchHtmlSafely } from "./fetcher";
import { detectBlockedPage } from "./pageClassifier";
import { extractWithSiteScraper, hasSiteScraperForUrl } from "./siteScraper";
import { extractStructuredData } from "./structuredData";
import { extractVisibleText } from "./visibleText";
import { mergeRecipeFields } from "./merger";
import { parseRecipe as captionParser } from "../index";
import * as cheerio from "cheerio";

/** og:image / twitter:image als letzte Bildquelle; relative Pfade werden aufgelöst */
export function extractOgImage(html: string, baseUrl?: string): string | undefined {
  const $ = cheerio.load(html);
  const raw =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[property="og:image:url"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content");
  if (!raw?.trim()) return undefined;
  try {
    const url = new URL(raw.trim(), baseUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export * from "./types";
export { detectInputType } from "./detector";
export { fetchHtmlSafely, validateUrlForSSRF } from "./fetcher";
export { detectBlockedPage } from "./pageClassifier";
export { extractWithSiteScraper, hasSiteScraperForUrl } from "./siteScraper";
export { getCustomScraperForUrl, CUSTOM_SCRAPERS } from "./customScrapers";
export {
  extractStructuredData,
  extractJsonLd,
  extractMicrodata,
  extractRdfa,
  parseIsoDurationToMinutes,
  flattenInstructions,
  flattenIngredients,
} from "./structuredData";
export { extractVisibleText } from "./visibleText";
export { mergeRecipeFields, calculateFieldConfidence } from "./merger";

/**
 * Universal recipe parser function:
 * Accepts URL, raw HTML, or plain text / caption.
 * Optionally accepts a contextUrl when raw HTML is provided from a known URL.
 * Returns consistent UniversalRecipeExtraction with per-field source and confidence.
 */
export async function parse_recipe(input: string, contextUrl?: string): Promise<ParseRecipeResult> {
  const trace: string[] = [];
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      status: "not_a_recipe",
      error: "Eingabe ist leer.",
      trace: ["[1] Leere Eingabe übergeben."],
    };
  }

  // Stufe 1: Eingabetyp erkennen
  const inputType = detectInputType(trimmed);
  trace.push(`[1] Input erkannt: ${inputType}`);

  let html: string | null = null;
  let sourceUrl: string | undefined = contextUrl;

  // Stufe 2: URL abrufen (falls URL)
  if (inputType === "url") {
    sourceUrl = trimmed;
    try {
      trace.push(`[2] Rufe URL ab: ${sourceUrl}`);
      const fetchRes = await fetchHtmlSafely(sourceUrl);
      html = fetchRes.html;
      sourceUrl = fetchRes.finalUrl;
      trace.push(`[2] HTML erfolgreich abgerufen (${html.length} Zeichen)`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      trace.push(`[2] Fehler beim Abrufen: ${errMsg}`);
      return {
        status: "fetch_error",
        error: errMsg,
        trace,
      };
    }
  } else if (inputType === "html") {
    html = trimmed;
  }

  // Stufe 2.5: Blockierte/Paywall/Login-Seiten prüfen
  if (html) {
    const blockCheck = detectBlockedPage(html);
    if (blockCheck.isBlocked) {
      trace.push(`[!] Seite blockiert/nicht verfügbar: ${blockCheck.status} (${blockCheck.reason})`);
      return {
        status: blockCheck.status,
        error: blockCheck.reason,
        trace,
      };
    }
  }

  // Stufe 3: Site-spezifischer Scraper (wenn URL vorhanden)
  let scraperResult = null;
  if (sourceUrl && html) {
    const hasScraper = hasSiteScraperForUrl(sourceUrl);
    if (hasScraper) {
      trace.push(`[3] Site-Scraper gefunden für Host: ${new URL(sourceUrl).hostname}`);
      scraperResult = await extractWithSiteScraper(html, sourceUrl);
      if (scraperResult.hasScraper) {
        trace.push(
          `[3] Scraper extrahiert: Titel=${Boolean(scraperResult.title)}, Zutaten=${scraperResult.ingredients?.length ?? 0}, Schritte=${scraperResult.instructions?.length ?? 0}`
        );
      }
    } else {
      trace.push(`[3] Kein Site-Scraper für Host in recipe-scrapers registriert.`);
    }
  }

  // Stufe 4: Generische strukturierte Daten (JSON-LD, Microdata, RDFa)
  let schemaResult = null;
  if (html) {
    schemaResult = extractStructuredData(html);
    if (schemaResult && schemaResult.hasSchema) {
      trace.push(
        `[4] Strukturierte Daten (${schemaResult.sourceType}): Titel=${Boolean(schemaResult.title)}, Zutaten=${schemaResult.ingredients?.length ?? 0}, Schritte=${schemaResult.instructions?.length ?? 0}`
      );
    } else {
      trace.push(`[4] Keine strukturierten Daten (JSON-LD/Microdata/RDFa) gefunden.`);
    }
  }

  // Stufe 5: Heuristik / Sichtbarer Text & bestehender Caption-Parser
  let heuristicResult = null;
  const textToParse = html ? extractVisibleText(html) : trimmed;

  if (textToParse) {
    trace.push(`[5] Heuristischer Caption-Parser gestartet (${textToParse.length} Zeichen Text)`);
    heuristicResult = captionParser(textToParse);
    if (heuristicResult) {
      trace.push(
        `[5] Heuristik extrahiert: Titel=${heuristicResult.title}, Zutaten=${heuristicResult.ingredients.length}, Schritte=${heuristicResult.steps.length}`
      );
    } else {
      trace.push(`[5] Heuristik konnte kein Rezept erkennen.`);
    }
  }

  // Stufe 6: Feldweises Merging & Confidence
  trace.push(`[6] Führe feldweises Merging durch.`);
  const recipe: UniversalRecipeExtraction = mergeRecipeFields(
    scraperResult,
    schemaResult,
    heuristicResult,
    sourceUrl,
    html ? extractOgImage(html, sourceUrl) : undefined
  );

  // Stufe 7: Validierung
  if (recipe.zutaten.value.length === 0 && recipe.zubereitung.value.length === 0) {
    trace.push(`[7] Validierung: FAIL (Weder Zutaten noch Zubereitung gefunden).`);
    return {
      status: "not_a_recipe",
      error: "Keine Zutaten oder Zubereitungsschritte gefunden.",
      trace,
    };
  }

  trace.push(
    `[7] Validierung: PASS (Zutaten: ${recipe.zutaten.value.length}, Schritte: ${recipe.zubereitung.value.length}, Confidence: ${recipe.overallConfidence})`
  );

  return {
    status: "success",
    recipe,
    trace,
  };
}
