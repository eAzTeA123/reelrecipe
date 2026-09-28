import * as cheerio from "cheerio";
import type { RecipeTimes } from "./types";

export interface SchemaExtractionResult {
  hasSchema: boolean;
  sourceType?: "json-ld" | "microdata" | "rdfa";
  title?: string;
  ingredients?: string[];
  instructions?: string[];
  image?: string;
  servings?: number;
  times?: RecipeTimes;
  description?: string;
  rawType?: string;
}

/**
 * Normalizes an ISO-8601 duration string (e.g. PT30M, PT1H, PT1H30M, P0Y0M0DT0H45M0S)
 * into minutes (integer).
 */
export function parseIsoDurationToMinutes(durationStr: string): number | undefined {
  if (!durationStr || typeof durationStr !== "string") return undefined;
  const str = durationStr.trim().toUpperCase();
  if (!str.startsWith("P")) {
    // Sometimes people put raw integers or "30 mins" in schema
    const numMatch = str.match(/^(\d+)\s*(?:MIN|M)?$/);
    if (numMatch) return parseInt(numMatch[1], 10);
    return undefined;
  }

  // Regex matching ISO 8601 Duration: P[n]Y[n]M[n]DT[n]H[n]M[n]S
  const match = str.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
  );
  if (!match) return undefined;

  const days = parseInt(match[1] || "0", 10);
  const hours = parseInt(match[2] || "0", 10);
  const minutes = parseInt(match[3] || "0", 10);
  const seconds = parseInt(match[4] || "0", 10);

  const total = days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60);
  return total > 0 ? total : undefined;
}

/**
 * Clean HTML tags & unescape entities from string.
 */
export function cleanHtmlText(text: string): string {
  if (!text) return "";
  return text
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

/**
 * Normalizes recipeInstructions from JSON-LD/Microdata into a flat string array.
 * Handles:
 * - string
 * - array of strings
 * - HowToStep ({ text or name })
 * - HowToSection ({ itemListElement: HowToStep[] })
 * - nested mixtures
 */
export function flattenInstructions(raw: unknown): string[] {
  if (!raw) return [];
  const results: string[] = [];

  function recurse(node: unknown) {
    if (!node) return;
    if (typeof node === "string") {
      const cleaned = cleanHtmlText(node);
      if (cleaned) {
        // If it contains newlines or numbered steps, split if appropriate
        if (cleaned.includes("\n")) {
          const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          results.push(...lines);
        } else {
          results.push(cleaned);
        }
      }
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        recurse(item);
      }
      return;
    }

    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const type = String(obj["@type"] || obj["type"] || "");

      // If HowToSection, drill into itemListElement
      if (type.includes("HowToSection") || obj.itemListElement) {
        // If section has a name, we can optionally keep or drill down
        if (obj.itemListElement) {
          recurse(obj.itemListElement);
        }
        return;
      }

      // If HowToStep
      if (type.includes("HowToStep") || obj.text || obj.itemListElement) {
        if (obj.text && typeof obj.text === "string") {
          const cleaned = cleanHtmlText(obj.text);
          if (cleaned) results.push(cleaned);
        } else if (obj.name && typeof obj.name === "string" && !obj.itemListElement) {
          const cleaned = cleanHtmlText(obj.name);
          if (cleaned) results.push(cleaned);
        } else if (obj.itemListElement) {
          recurse(obj.itemListElement);
        }
        return;
      }

      // Fallback for generic objects with text or name
      if (typeof obj.text === "string") {
        const cleaned = cleanHtmlText(obj.text);
        if (cleaned) results.push(cleaned);
      } else if (typeof obj.name === "string") {
        const cleaned = cleanHtmlText(obj.name);
        if (cleaned) results.push(cleaned);
      }
    }
  }

  recurse(raw);
  return results;
}

/**
 * Normalizes recipeIngredient from JSON-LD / Microdata into a string array.
 */
export function flattenIngredients(raw: unknown): string[] {
  if (!raw) return [];
  const results: string[] = [];

  function recurse(node: unknown) {
    if (!node) return;
    if (typeof node === "string") {
      const cleaned = cleanHtmlText(node);
      if (cleaned) results.push(cleaned);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        recurse(item);
      }
      return;
    }
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      if (typeof obj.text === "string") {
        const cleaned = cleanHtmlText(obj.text);
        if (cleaned) results.push(cleaned);
      } else if (typeof obj.name === "string") {
        const cleaned = cleanHtmlText(obj.name);
        if (cleaned) results.push(cleaned);
      }
    }
  }

  recurse(raw);
  return results;
}

/**
 * Extracts image URL from JSON-LD image field (which can be string, array, or ImageObject).
 */
export function extractImageUrl(
  raw: unknown,
  resolveRef?: (id: string) => Record<string, unknown> | undefined,
  depth = 0,
): string | undefined {
  if (!raw || depth > 3) return undefined;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw.length > 0) {
    return extractImageUrl(raw[0], resolveRef, depth + 1);
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.url === "string" && obj.url.trim()) return obj.url.trim();
    if (typeof obj.contentUrl === "string" && obj.contentUrl.trim()) return obj.contentUrl.trim();
    // Verweis auf einen anderen Knoten im @graph (z. B. Chefkoch: {"@id": "…#primaryimage"})
    if (typeof obj["@id"] === "string" && resolveRef) {
      const target = resolveRef(obj["@id"]);
      if (target && target !== obj) return extractImageUrl(target, resolveRef, depth + 1);
    }
  }
  return undefined;
}

/** Sammelt alle Knoten mit @id, um Verweise innerhalb von JSON-LD aufzulösen */
export function collectJsonLdIds(node: unknown, out = new Map<string, Record<string, unknown>>()) {
  if (Array.isArray(node)) {
    for (const n of node) collectJsonLdIds(n, out);
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj["@id"] === "string" && Object.keys(obj).length > 1) out.set(obj["@id"], obj);
    if (obj["@graph"]) collectJsonLdIds(obj["@graph"], out);
  }
  return out;
}

/**
 * Extracts servings integer from recipeYield.
 */
export function extractServings(raw: unknown): number | undefined {
  if (!raw) return undefined;
  if (typeof raw === "number" && raw > 0) return Math.round(raw);
  if (Array.isArray(raw) && raw.length > 0) {
    return extractServings(raw[0]);
  }
  if (typeof raw === "string") {
    const m = raw.match(/\d+/);
    if (m) return parseInt(m[0], 10);
  }
  return undefined;
}

/**
 * Recursively searches JSON-LD objects for Recipe type (supports @graph, arrays, nested).
 */
export function findRecipeInJsonLd(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
    return null;
  }

  const obj = node as Record<string, unknown>;

  // Check @type or type
  const typeVal = obj["@type"] || obj["type"];
  if (typeVal) {
    const types = Array.isArray(typeVal) ? typeVal.map(String) : [String(typeVal)];
    if (types.some((t) => t.toLowerCase() === "recipe" || t.toLowerCase().endsWith("/recipe"))) {
      return obj;
    }
  }

  // Check @graph
  if (obj["@graph"] && Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"]) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
  }

  return null;
}

/**
 * 1. Extract JSON-LD
 */
export function extractJsonLd(html: string): SchemaExtractionResult | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]').toArray();

  for (const script of scripts) {
    const content = $(script).html();
    if (!content) continue;

    try {
      const parsed = JSON.parse(content);
      const recipeObj = findRecipeInJsonLd(parsed);
      if (!recipeObj) continue;

      const title =
        typeof recipeObj.name === "string"
          ? cleanHtmlText(recipeObj.name)
          : typeof recipeObj.headline === "string"
          ? cleanHtmlText(recipeObj.headline)
          : undefined;

      const ingredients = flattenIngredients(
        recipeObj.recipeIngredient || recipeObj.ingredients
      );
      const instructions = flattenInstructions(
        recipeObj.recipeInstructions || recipeObj.instructions
      );
      const ids = collectJsonLdIds(parsed);
      const image = extractImageUrl(recipeObj.image, (id) => ids.get(id));
      const servings = extractServings(recipeObj.recipeYield || recipeObj.yield);

      const times: RecipeTimes = {};
      const pt = parseIsoDurationToMinutes(String(recipeObj.prepTime || ""));
      if (pt) times.prep = pt;
      const ct = parseIsoDurationToMinutes(String(recipeObj.cookTime || ""));
      if (ct) times.cook = ct;
      const tt = parseIsoDurationToMinutes(String(recipeObj.totalTime || ""));
      if (tt) times.total = tt;

      const description =
        typeof recipeObj.description === "string"
          ? cleanHtmlText(recipeObj.description)
          : undefined;

      return {
        hasSchema: true,
        sourceType: "json-ld",
        title: title || undefined,
        ingredients: ingredients.length > 0 ? ingredients : undefined,
        instructions: instructions.length > 0 ? instructions : undefined,
        image,
        servings,
        times: Object.keys(times).length > 0 ? times : undefined,
        description,
        rawType: String(recipeObj["@type"] || "Recipe"),
      };
    } catch {
      // ignore JSON parse error in malformed script tag
    }
  }

  return null;
}

/**
 * 2. Extract Microdata (itemscope itemtype="http://schema.org/Recipe")
 */
export function extractMicrodata(html: string): SchemaExtractionResult | null {
  const $ = cheerio.load(html);
  const recipeContainer = $('[itemscope][itemtype*="schema.org/Recipe"]').first();
  if (recipeContainer.length === 0) return null;

  // Title
  let title = recipeContainer.find('[itemprop="name"]').first().text();
  if (!title) {
    title = recipeContainer.find('[itemprop="headline"]').first().text();
  }
  title = cleanHtmlText(title);

  // Ingredients
  const ingredients: string[] = [];
  recipeContainer.find('[itemprop="recipeIngredient"], [itemprop="ingredients"]').each((_, el) => {
    const text = cleanHtmlText($(el).text());
    if (text) ingredients.push(text);
  });

  // Instructions
  const instructions: string[] = [];
  recipeContainer.find('[itemprop="recipeInstructions"]').each((_, el) => {
    // If it contains HowToStep or HowToSection
    const steps = $(el).find('[itemprop="itemListElement"], [itemtype*="HowToStep"]');
    if (steps.length > 0) {
      steps.each((_, stepEl) => {
        const stepText = cleanHtmlText($(stepEl).text());
        if (stepText) instructions.push(stepText);
      });
    } else {
      const text = cleanHtmlText($(el).text());
      if (text) instructions.push(text);
    }
  });

  // Image
  const image = recipeContainer.find('[itemprop="image"]').attr("src") ||
    recipeContainer.find('[itemprop="image"]').attr("href") ||
    recipeContainer.find('[itemprop="image"]').attr("content");

  // Servings
  const yieldText = recipeContainer.find('[itemprop="recipeYield"]').text() ||
    recipeContainer.find('[itemprop="recipeYield"]').attr("content");
  const servings = extractServings(yieldText);

  // Times
  const times: RecipeTimes = {};
  const prepDuration = recipeContainer.find('[itemprop="prepTime"]').attr("content") ||
    recipeContainer.find('[itemprop="prepTime"]').text();
  const pt = parseIsoDurationToMinutes(prepDuration);
  if (pt) times.prep = pt;

  const cookDuration = recipeContainer.find('[itemprop="cookTime"]').attr("content") ||
    recipeContainer.find('[itemprop="cookTime"]').text();
  const ct = parseIsoDurationToMinutes(cookDuration);
  if (ct) times.cook = ct;

  const totalDuration = recipeContainer.find('[itemprop="totalTime"]').attr("content") ||
    recipeContainer.find('[itemprop="totalTime"]').text();
  const tt = parseIsoDurationToMinutes(totalDuration);
  if (tt) times.total = tt;

  return {
    hasSchema: true,
    sourceType: "microdata",
    title: title || undefined,
    ingredients: ingredients.length > 0 ? ingredients : undefined,
    instructions: instructions.length > 0 ? instructions : undefined,
    image: image || undefined,
    servings,
    times: Object.keys(times).length > 0 ? times : undefined,
  };
}

/**
 * 3. Extract RDFa (vocab="http://schema.org/" typeof="Recipe")
 */
export function extractRdfa(html: string): SchemaExtractionResult | null {
  const $ = cheerio.load(html);
  const recipeContainer = $('[typeof*="Recipe"], [typeof*="recipe"]').first();
  if (recipeContainer.length === 0) return null;

  let title = recipeContainer.find('[property*="name"]').first().text();
  title = cleanHtmlText(title);

  const ingredients: string[] = [];
  recipeContainer.find('[property*="recipeIngredient"], [property*="ingredients"]').each((_, el) => {
    const text = cleanHtmlText($(el).text());
    if (text) ingredients.push(text);
  });

  const instructions: string[] = [];
  recipeContainer.find('[property*="recipeInstructions"]').each((_, el) => {
    const text = cleanHtmlText($(el).text());
    if (text) instructions.push(text);
  });

  const image = recipeContainer.find('[property*="image"]').attr("src") ||
    recipeContainer.find('[property*="image"]').attr("content");

  const yieldText = recipeContainer.find('[property*="recipeYield"]').text() ||
    recipeContainer.find('[property*="recipeYield"]').attr("content");
  const servings = extractServings(yieldText);

  return {
    hasSchema: true,
    sourceType: "rdfa",
    title: title || undefined,
    ingredients: ingredients.length > 0 ? ingredients : undefined,
    instructions: instructions.length > 0 ? instructions : undefined,
    image: image || undefined,
    servings,
  };
}

/**
 * Cascade: JSON-LD -> Microdata -> RDFa
 */
export function extractStructuredData(html: string): SchemaExtractionResult | null {
  const jsonLd = extractJsonLd(html);
  if (jsonLd && (jsonLd.ingredients || jsonLd.instructions || jsonLd.title)) {
    return jsonLd;
  }

  const microdata = extractMicrodata(html);
  if (microdata && (microdata.ingredients || microdata.instructions || microdata.title)) {
    return microdata;
  }

  const rdfa = extractRdfa(html);
  if (rdfa && (rdfa.ingredients || rdfa.instructions || rdfa.title)) {
    return rdfa;
  }

  return jsonLd || microdata || rdfa || null;
}
