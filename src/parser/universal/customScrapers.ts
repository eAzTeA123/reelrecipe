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
 * Registry of custom site-specific scrapers.
 * Host matching supports domains and subdomains.
 */
export const CUSTOM_SCRAPERS: Record<string, CustomScraperFn> = {
  "chefkoch.de": scrapeChefkoch,
  "essen-und-trinken.de": scrapeEssenUndTrinken,
  "kuechengoetter.de": scrapeKuechengoetter,
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
