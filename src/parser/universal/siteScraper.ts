import { getScraper, scrapers } from "recipe-scrapers";
import type { RecipeTimes } from "./types";
import { getCustomScraperForUrl } from "./customScrapers";

export interface ScraperExtractionResult {
  hasScraper: boolean;
  host?: string;
  title?: string;
  ingredients?: string[];
  instructions?: string[];
  image?: string;
  servings?: number;
  times?: RecipeTimes;
  /** Zusatztext (bei rezeptwelt.de die Tipps aus `itemprop="recipeHint"`) */
  description?: string;
  error?: string;
}

/**
 * Checks whether the given URL has a site-specific scraper:
 * 1. Checks our custom site-scrapers registry (e.g. chefkoch.de, essen-und-trinken.de)
 * 2. Dynamically checks registered scrapers in installed `recipe-scrapers`
 */
export function hasSiteScraperForUrl(urlStr: string): boolean {
  if (getCustomScraperForUrl(urlStr)) {
    return true;
  }

  try {
    const url = new URL(urlStr);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    
    // Check against registered scrapers object
    if (scrapers && typeof scrapers === "object") {
      if (host in scrapers) return true;
      // Also check subdomains if applicable
      for (const registeredHost of Object.keys(scrapers)) {
        if (host === registeredHost || host.endsWith("." + registeredHost)) {
          return true;
        }
      }
    }

    // Secondary dynamic check: getScraper(url, { wildMode: false })
    const ScraperCls = getScraper(urlStr, { wildMode: false });
    return Boolean(ScraperCls);
  } catch {
    return false;
  }
}

/**
 * Extracts fields using the dynamic site-scraper or custom scraper if available.
 * Extracts per-field so that a missing field (e.g. author or description)
 * does NOT fail the entire scraper.
 */
export async function extractWithSiteScraper(
  html: string,
  urlStr: string
): Promise<ScraperExtractionResult> {
  const customScraper = getCustomScraperForUrl(urlStr);
  if (customScraper) {
    try {
      const url = new URL(urlStr);
      const customRes = await customScraper(html, urlStr);
      if (customRes) {
        return {
          hasScraper: true,
          host: url.hostname,
          title: customRes.title,
          ingredients: customRes.ingredients,
          instructions: customRes.instructions,
          image: customRes.image,
          servings: customRes.servings,
          times: customRes.times,
          description: customRes.description,
        };
      }
    } catch (err) {
      return {
        hasScraper: true,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (!hasSiteScraperForUrl(urlStr)) {
    return { hasScraper: false };
  }

  try {
    const ScraperCls = getScraper(urlStr, { wildMode: false });
    if (!ScraperCls) {
      return { hasScraper: false };
    }

    const scraper = new ScraperCls(html, urlStr);
    const url = new URL(urlStr);
    const host = url.hostname;

    // Extract title
    let title: string | undefined;
    try {
      const t = await scraper.extract("title");
      if (typeof t === "string" && t.trim()) {
        title = t.trim();
      }
    } catch {
      // ignore
    }

    // Extract ingredients
    let ingredients: string[] | undefined;
    try {
      const ings = await scraper.extract("ingredients");
      if (Array.isArray(ings)) {
        const list: string[] = [];
        for (const group of ings) {
          if (group && typeof group === "object" && Array.isArray((group as { items?: unknown[] }).items)) {
            for (const item of (group as { items: { value?: string }[] }).items) {
              if (item && typeof item.value === "string" && item.value.trim()) {
                list.push(item.value.trim());
              }
            }
          }
        }
        if (list.length > 0) ingredients = list;
      }
    } catch {
      // ignore
    }

    // Extract instructions
    let instructions: string[] | undefined;
    try {
      const insts = await scraper.extract("instructions");
      if (Array.isArray(insts)) {
        const list: string[] = [];
        for (const group of insts) {
          if (group && typeof group === "object" && Array.isArray((group as { items?: unknown[] }).items)) {
            for (const item of (group as { items: { value?: string }[] }).items) {
              if (item && typeof item.value === "string" && item.value.trim()) {
                list.push(item.value.trim());
              }
            }
          }
        }
        if (list.length > 0) instructions = list;
      }
    } catch {
      // ignore
    }

    // Extract image
    let image: string | undefined;
    try {
      const img = await scraper.extract("image");
      if (typeof img === "string" && img.trim()) {
        image = img.trim();
      }
    } catch {
      // ignore
    }

    // Extract yields / servings
    let servings: number | undefined;
    try {
      const y = await scraper.extract("yields");
      if (typeof y === "string") {
        const match = y.match(/\d+/);
        if (match) servings = parseInt(match[0], 10);
      } else if (typeof y === "number") {
        servings = y;
      }
    } catch {
      // ignore
    }

    // Extract times
    const times: RecipeTimes = {};
    try {
      const pt = await scraper.extract("prepTime");
      if (typeof pt === "number" && pt > 0) times.prep = pt;
    } catch {}

    try {
      const ct = await scraper.extract("cookTime");
      if (typeof ct === "number" && ct > 0) times.cook = ct;
    } catch {}

    try {
      const tt = await scraper.extract("totalTime");
      if (typeof tt === "number" && tt > 0) times.total = tt;
    } catch {}

    return {
      hasScraper: true,
      host,
      title,
      ingredients,
      instructions,
      image,
      servings,
      times: Object.keys(times).length > 0 ? times : undefined,
    };
  } catch (err) {
    return {
      hasScraper: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
