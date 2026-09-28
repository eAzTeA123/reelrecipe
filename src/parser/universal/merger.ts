import type {
  ExtractionSource,
  FieldWithMetadata,
  UniversalRecipeExtraction,
  RecipeTimes,
} from "./types";
import type { ScraperExtractionResult } from "./siteScraper";
import type { SchemaExtractionResult } from "./structuredData";
import type { ParsedRecipe, Ingredient, RecipeStep } from "@/domain/types";
import { parseIngredientLine, toIngredient, expandIngredientLine } from "../ingredient";
import { makeSteps } from "../steps";

/**
 * Calculates a deterministic confidence score (0.0 to 1.0) based on source,
 * content quality, structure, and completeness.
 */
export function calculateFieldConfidence<T>(
  field: "titel" | "zutaten" | "zubereitung" | "bild" | "zeiten" | "portionen" | "sonstiges",
  value: T,
  source: ExtractionSource
): number {
  if (value === undefined || value === null) return 0.0;
  if (Array.isArray(value) && value.length === 0) return 0.0;
  if (typeof value === "string" && value.trim() === "") return 0.0;

  switch (source) {
    case "site-scraper": {
      // Dedicated site scrapers have the highest baseline confidence
      if (field === "titel") return 0.98;
      if (field === "zutaten") {
        const len = Array.isArray(value) ? value.length : 0;
        return len >= 3 ? 0.98 : 0.90;
      }
      if (field === "zubereitung") {
        const len = Array.isArray(value) ? value.length : 0;
        return len >= 2 ? 0.97 : 0.88;
      }
      if (field === "bild") return 0.95;
      if (field === "portionen") return 0.95;
      if (field === "zeiten") return 0.94;
      return 0.90;
    }

    case "schema": {
      // JSON-LD / Microdata / RDFa
      if (field === "titel") return 0.95;
      if (field === "zutaten") {
        const len = Array.isArray(value) ? value.length : 0;
        return len >= 3 ? 0.95 : 0.85;
      }
      if (field === "zubereitung") {
        const len = Array.isArray(value) ? value.length : 0;
        return len >= 2 ? 0.93 : 0.82;
      }
      if (field === "bild") return 0.91;
      if (field === "portionen") return 0.90;
      if (field === "zeiten") return 0.89;
      return 0.85;
    }

    case "heuristik": {
      // Caption Parser / Text heuristics
      if (field === "titel") {
        const str = String(value);
        if (str === "Neues Rezept" || str.length <= 3) return 0.40;
        return 0.75;
      }
      if (field === "zutaten") {
        const len = Array.isArray(value) ? value.length : 0;
        if (len >= 4) return 0.80;
        if (len >= 1) return 0.65;
        return 0.20;
      }
      if (field === "zubereitung") {
        const len = Array.isArray(value) ? value.length : 0;
        if (len >= 3) return 0.80;
        if (len >= 1) return 0.65;
        return 0.20;
      }
      if (field === "portionen") return 0.65;
      if (field === "zeiten") return 0.70;
      if (field === "bild") return 0.50;
      return 0.60;
    }
  }
}

/**
 * Merges fields using the deterministic cascade:
 * site-scraper -> schema -> heuristik
 * Each field is evaluated individually. A later stage never overwrites
 * an already populated good field from an earlier stage.
 */
export function mergeRecipeFields(
  scraperResult: ScraperExtractionResult | null,
  schemaResult: SchemaExtractionResult | null,
  heuristicResult: ParsedRecipe | null,
  sourceUrl?: string,
  /** Vorschaubild der Seite (og:image), nur wenn keine strukturierte Quelle ein Bild liefert */
  fallbackImage?: string
): UniversalRecipeExtraction {
  // 1. Titel
  let titelVal = "Neues Rezept";
  let titelSrc: ExtractionSource = "heuristik";
  if (scraperResult?.title && scraperResult.title.length > 2) {
    titelVal = scraperResult.title;
    titelSrc = "site-scraper";
  } else if (schemaResult?.title && schemaResult.title.length > 2) {
    titelVal = schemaResult.title;
    titelSrc = "schema";
  } else if (heuristicResult?.title && heuristicResult.title !== "Neues Rezept") {
    titelVal = heuristicResult.title;
    titelSrc = "heuristik";
  } else if (heuristicResult?.title) {
    titelVal = heuristicResult.title;
    titelSrc = "heuristik";
  }
  const titel: FieldWithMetadata<string> = {
    value: titelVal,
    source: titelSrc,
    confidence: calculateFieldConfidence("titel", titelVal, titelSrc),
  };

  // 2. Zutaten
  let zutatenVal: string[] = [];
  let zutatenSrc: ExtractionSource = "heuristik";
  if (scraperResult?.ingredients && scraperResult.ingredients.length > 0) {
    zutatenVal = scraperResult.ingredients;
    zutatenSrc = "site-scraper";
  } else if (schemaResult?.ingredients && schemaResult.ingredients.length > 0) {
    zutatenVal = schemaResult.ingredients;
    zutatenSrc = "schema";
  } else if (heuristicResult?.ingredients && heuristicResult.ingredients.length > 0) {
    // Reconstruct raw lines or use name/amount/unit
    zutatenVal = heuristicResult.ingredients.map((i) => {
      const parts: string[] = [];
      if (i.amount) parts.push(String(i.amount));
      if (i.unit) parts.push(i.unit);
      parts.push(i.name);
      return parts.join(" ").trim();
    });
    zutatenSrc = "heuristik";
  }
  const zutaten: FieldWithMetadata<string[]> = {
    value: zutatenVal,
    source: zutatenSrc,
    confidence: calculateFieldConfidence("zutaten", zutatenVal, zutatenSrc),
  };

  // 3. Zubereitung
  let zubereitungVal: string[] = [];
  let zubereitungSrc: ExtractionSource = "heuristik";
  if (scraperResult?.instructions && scraperResult.instructions.length > 0) {
    zubereitungVal = scraperResult.instructions;
    zubereitungSrc = "site-scraper";
  } else if (schemaResult?.instructions && schemaResult.instructions.length > 0) {
    zubereitungVal = schemaResult.instructions;
    zubereitungSrc = "schema";
  } else if (heuristicResult?.steps && heuristicResult.steps.length > 0) {
    zubereitungVal = heuristicResult.steps.map((s) => s.instruction);
    zubereitungSrc = "heuristik";
  }
  const zubereitung: FieldWithMetadata<string[]> = {
    value: zubereitungVal,
    source: zubereitungSrc,
    confidence: calculateFieldConfidence("zubereitung", zubereitungVal, zubereitungSrc),
  };

  // 4. Sonstiges (Description / Notes)
  const sonstigesList: string[] = [];
  let sonstigesSrc: ExtractionSource = "heuristik";
  if (schemaResult?.description) {
    sonstigesList.push(schemaResult.description);
    sonstigesSrc = "schema";
  }
  const sonstiges: FieldWithMetadata<string[]> = {
    value: sonstigesList,
    source: sonstigesSrc,
    confidence: calculateFieldConfidence("sonstiges", sonstigesList, sonstigesSrc),
  };

  // 5. Bild
  let bildVal: string | undefined;
  let bildSrc: ExtractionSource = "heuristik";
  if (scraperResult?.image) {
    bildVal = scraperResult.image;
    bildSrc = "site-scraper";
  } else if (schemaResult?.image) {
    bildVal = schemaResult.image;
    bildSrc = "schema";
  } else if (fallbackImage) {
    bildVal = fallbackImage;
    bildSrc = "heuristik";
  }
  const bild: FieldWithMetadata<string | undefined> = {
    value: bildVal,
    source: bildSrc,
    confidence: calculateFieldConfidence("bild", bildVal, bildSrc),
  };

  // 6. Zeiten
  let zeitenVal: RecipeTimes = {};
  let zeitenSrc: ExtractionSource = "heuristik";
  if (scraperResult?.times && Object.keys(scraperResult.times).length > 0) {
    zeitenVal = scraperResult.times;
    zeitenSrc = "site-scraper";
  } else if (schemaResult?.times && Object.keys(schemaResult.times).length > 0) {
    zeitenVal = schemaResult.times;
    zeitenSrc = "schema";
  } else if (heuristicResult && (heuristicResult.prepTime || heuristicResult.cookTime)) {
    zeitenVal = {
      prep: heuristicResult.prepTime,
      cook: heuristicResult.cookTime,
      total:
        heuristicResult.prepTime && heuristicResult.cookTime
          ? heuristicResult.prepTime + heuristicResult.cookTime
          : heuristicResult.prepTime || heuristicResult.cookTime,
    };
    zeitenSrc = "heuristik";
  }
  const zeiten: FieldWithMetadata<RecipeTimes> = {
    value: zeitenVal,
    source: zeitenSrc,
    confidence: calculateFieldConfidence("zeiten", zeitenVal, zeitenSrc),
  };

  // 7. Portionen
  let portionenVal: number | undefined;
  let portionenSrc: ExtractionSource = "heuristik";
  if (scraperResult?.servings && scraperResult.servings > 0) {
    portionenVal = scraperResult.servings;
    portionenSrc = "site-scraper";
  } else if (schemaResult?.servings && schemaResult.servings > 0) {
    portionenVal = schemaResult.servings;
    portionenSrc = "schema";
  } else if (heuristicResult?.servings && heuristicResult.servings > 0) {
    portionenVal = heuristicResult.servings;
    portionenSrc = "heuristik";
  }
  const portionen: FieldWithMetadata<number | undefined> = {
    value: portionenVal,
    source: portionenSrc,
    confidence: calculateFieldConfidence("portionen", portionenVal, portionenSrc),
  };

  // Map to structured ingredients and steps for internal app compatibility
  let structuredIngredients: Ingredient[] = [];
  if (heuristicResult && zutatenSrc === "heuristik") {
    structuredIngredients = heuristicResult.ingredients;
  } else {
    structuredIngredients = zutatenVal
      .flatMap(expandIngredientLine)
      .map(parseIngredientLine)
      .filter((i): i is NonNullable<typeof i> => i !== null)
      .map(toIngredient);
  }

  let structuredSteps: RecipeStep[] = [];
  if (heuristicResult && zubereitungSrc === "heuristik") {
    structuredSteps = heuristicResult.steps;
  } else {
    structuredSteps = makeSteps(zubereitungVal);
  }

  // Determine overall confidence
  const weights = [
    titel.confidence * 0.15,
    zutaten.confidence * 0.40,
    zubereitung.confidence * 0.35,
    (portionen.confidence || 0.5) * 0.05,
    (zeiten.confidence || 0.5) * 0.05,
  ];
  const overallConfidence = Math.min(
    1.0,
    parseFloat(weights.reduce((a, b) => a + b, 0).toFixed(2))
  );

  // High confidence rule (section 10):
  // zutaten.length > 0 AND zubereitung.length > 0
  const isHighConfidence =
    zutatenVal.length > 0 &&
    zubereitungVal.length > 0 &&
    overallConfidence >= 0.70;

  return {
    titel,
    zutaten,
    zubereitung,
    sonstiges,
    bild,
    zeiten,
    portionen,
    structuredIngredients,
    structuredSteps,
    overallConfidence,
    isHighConfidence,
    sourceUrl,
  };
}
