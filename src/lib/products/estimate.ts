import type {
  EstimateItem,
  Nutrition100,
  ObservedPrice,
  PricedProductCandidate,
  PriceType,
  ProductCandidate,
  ReferenceEstimate,
  RetailerFilter,
  ShoppingEstimate,
} from "@/domain/productTypes";
import {
  EXACT_PRODUCT_THRESHOLD,
  MATCH_THRESHOLD,
  addNutrition,
  categoryTagFor,
  computeCategoryCost,
  computeCost,
  isPantryIngredient,
  scaleNutrition,
  scoreProductName,
  searchTermsFor,
  toBaseQuantity,
} from "./matching";
import { mapLimit } from "./cache";
import { resolveCategory } from "./categories";
import { ESTIMATE_SOURCE, REFERENCE_PRICES } from "./referencePrices";

export interface EstimateIngredient {
  id: string;
  name: string;
  notes?: string;
  amount?: number;
  unit?: string;
}

export interface EstimateDeps {
  searchProducts: (term: string) => Promise<ProductCandidate[]>;
  fetchPrices: (eans: string[]) => Promise<Map<string, ObservedPrice[]>>;
  fetchCategoryPrices?: (categoryTags: string[]) => Promise<Map<string, ObservedPrice[]>>;
  fetchSimilarProductPrices?: (term: string) => Promise<PricedProductCandidate[]>;
}

const MAX_EXACT_CANDIDATES = 20;
const MAX_SIMILAR_CANDIDATES = 8;
const SIMILAR_MAX_CONFIDENCE = 0.94;

type ScoredProduct = { product: ProductCandidate; score: number };

interface Matched {
  ing: EstimateIngredient;
  pantry: boolean;
  categoryTag?: string;
  exact: ScoredProduct[];
  similar: ScoredProduct[];
}

interface PickedPrice {
  product?: ProductCandidate;
  categoryTag?: string;
  score: number;
  price?: ObservedPrice;
  /** Richtwert, wenn kein Marktpreis existiert */
  estimate?: ReferenceEstimate;
  cost: ReturnType<typeof computeCost>;
}

function supportsRetailer(price: ObservedPrice, retailer: RetailerFilter): boolean {
  return retailer === "all" || price.retailerId === retailer;
}

function pickProductPrice(
  ing: EstimateIngredient,
  candidates: ScoredProduct[],
  prices: Map<string, ObservedPrice[]>,
  retailer: RetailerFilter,
  priceType: Extract<PriceType, "PRODUCT" | "SIMILAR_PRODUCT">,
): PickedPrice | undefined {
  const need = toBaseQuantity(ing.amount, ing.unit);
  let best: PickedPrice | undefined;
  for (const candidate of candidates) {
    for (const observed of prices.get(candidate.product.ean) ?? []) {
      if (!supportsRetailer(observed, retailer)) continue;
      const price = { ...observed, priceType, confidence: candidate.score };
      const cost = computeCost(need, candidate.product.package, price.price, price.basis);
      if (
        !best ||
        candidate.score > best.score ||
        (candidate.score === best.score && price.date > (best.price?.date ?? "")) ||
        (candidate.score === best.score &&
          price.date === (best.price?.date ?? "") &&
          (cost.shoppingCost ?? Number.POSITIVE_INFINITY) < (best.cost.shoppingCost ?? Number.POSITIVE_INFINITY))
      ) {
        best = { product: candidate.product, score: candidate.score, price, cost };
      }
    }
  }
  return best;
}

function pickCategoryPrice(
  ing: EstimateIngredient,
  categoryTag: string | undefined,
  prices: Map<string, ObservedPrice[]>,
  retailer: RetailerFilter,
): PickedPrice | undefined {
  if (!categoryTag) return undefined;
  const need = toBaseQuantity(ing.amount, ing.unit);
  let best: PickedPrice | undefined;
  for (const price of prices.get(categoryTag) ?? []) {
    if (!supportsRetailer(price, retailer)) continue;
    const cost = computeCategoryCost(need, price.price, price.basis);
    if (!best || price.confidence > best.score || (price.confidence === best.score && price.date > (best.price?.date ?? ""))) {
      best = { categoryTag, score: price.confidence, price, cost };
    }
  }
  return best;
}

/**
 * Preispriorität: exaktes Produkt (hochwertige EAN-Kandidaten), danach ein
 * verifizierter OFF-Kategoriepreis für Rohware, danach eine sichere ähnliche
 * Produktvariante. Innerhalb einer Klasse zählen Match-Qualität und Aktualität
 * vor dem Preis. Fehlende Daten werden nie durch Schätzwerte ersetzt.
 */
export async function estimateShopping(
  ingredients: EstimateIngredient[],
  retailer: RetailerFilter,
  deps: EstimateDeps,
): Promise<ShoppingEstimate> {
  let productsOk = true;
  let pricesOk = true;

  const matched: Matched[] = await mapLimit(ingredients, 3, async (ing) => {
    if (isPantryIngredient(ing.name)) return { ing, pantry: true, exact: [], similar: [] };
    const terms = searchTermsFor(ing.name, ing.notes);
    const byEan = new Map<string, ProductCandidate>();
    const searches = await mapLimit(terms, 2, async (term) => {
      try {
        return await deps.searchProducts(term);
      } catch (e) {
        console.warn("Produktsuche fehlgeschlagen", term, e);
        productsOk = false;
        return [];
      }
    });
    for (const products of searches) {
      for (const product of products) byEan.set(product.ean, product);
    }
    const candidates = [...byEan.values()]
      .map((product) => ({ product, score: scoreProductName(ing.name, product.name, ing.notes) }))
      .filter((candidate) => candidate.score >= MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score);
    return {
      ing,
      pantry: false,
      categoryTag: categoryTagFor(ing.name, ing.notes),
      exact: candidates.filter((candidate) => candidate.score >= EXACT_PRODUCT_THRESHOLD).slice(0, MAX_EXACT_CANDIDATES),
      similar: candidates
        .filter((candidate) => candidate.score < EXACT_PRODUCT_THRESHOLD)
        .slice(0, MAX_SIMILAR_CANDIDATES),
    };
  });

  let productPrices = new Map<string, ObservedPrice[]>();
  const eans = [...new Set(matched.flatMap((item) => [...item.exact, ...item.similar].map((candidate) => candidate.product.ean)))];
  if (eans.length > 0) {
    try {
      productPrices = await deps.fetchPrices(eans);
    } catch (e) {
      console.warn("Preisabfrage fehlgeschlagen", e);
      pricesOk = false;
    }
  }

  const exactPicks = new Map<string, PickedPrice>();
  for (const item of matched) {
    const picked = pickProductPrice(item.ing, item.exact, productPrices, retailer, "PRODUCT");
    if (picked) exactPicks.set(item.ing.id, picked);
  }

  let categoryPrices = new Map<string, ObservedPrice[]>();
  const categoryTags = [...new Set(matched.filter((item) => !exactPicks.has(item.ing.id)).map((item) => item.categoryTag).filter((tag): tag is string => Boolean(tag)))];
  if (categoryTags.length > 0 && deps.fetchCategoryPrices) {
    try {
      categoryPrices = await deps.fetchCategoryPrices(categoryTags);
    } catch (e) {
      console.warn("Kategoriepreisabfrage fehlgeschlagen", e);
      pricesOk = false;
    }
  }

  const categoryPicks = new Map<string, PickedPrice>();
  const similarPicks = new Map<string, PickedPrice>();
  for (const item of matched) {
    if (exactPicks.has(item.ing.id)) continue;
    const category = pickCategoryPrice(item.ing, item.categoryTag, categoryPrices, retailer);
    if (category) {
      categoryPicks.set(item.ing.id, category);
      continue;
    }
    const similar = pickProductPrice(item.ing, item.similar, productPrices, retailer, "SIMILAR_PRODUCT");
    if (similar) similarPicks.set(item.ing.id, similar);
  }

  const unresolved = matched.filter(
    (item) => !item.pantry && !exactPicks.has(item.ing.id) && !categoryPicks.has(item.ing.id) && !similarPicks.has(item.ing.id),
  );
  if (deps.fetchSimilarProductPrices) {
    await mapLimit(unresolved, 3, async (item) => {
      const normalizedTerm = searchTermsFor(item.ing.name, item.ing.notes)[0];
      if (!normalizedTerm) return;
      const term = normalizedTerm.replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase());
      try {
        const found = await deps.fetchSimilarProductPrices!(term);
        const candidates = found
          .map(({ product }) => ({
            product,
            score: Math.min(SIMILAR_MAX_CONFIDENCE, scoreProductName(item.ing.name, product.name, item.ing.notes)),
          }))
          .filter((candidate) => candidate.score >= MATCH_THRESHOLD)
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_SIMILAR_CANDIDATES);
        const prices = new Map(found.map(({ product, prices: list }) => [product.ean, list]));
        const picked = pickProductPrice(item.ing, candidates, prices, retailer, "SIMILAR_PRODUCT");
        if (picked) similarPicks.set(item.ing.id, picked);
      } catch (e) {
        console.warn("Ähnlicher Produktpreis fehlgeschlagen", term, e);
        pricesOk = false;
      }
    });
  }

  // Letzte Stufe: Richtwert je Warengruppe. Ohne sie blieben Zutaten ohne
  // Marktpreis komplett ohne Angabe ("kein Preis") – das war in der Praxis die
  // Mehrheit, weil Open Prices nur einen kleinen Teil der Produkte abdeckt.
  const estimatedPicks = new Map<string, PickedPrice>();
  for (const item of matched) {
    if (item.pantry) continue;
    if (exactPicks.has(item.ing.id) || categoryPicks.has(item.ing.id) || similarPicks.has(item.ing.id)) continue;
    const group = resolveCategory(item.ing.name, item.ing.notes)?.group ?? "sonstiges";
    const reference = REFERENCE_PRICES[group];
    const need = toBaseQuantity(item.ing.amount, item.ing.unit);
    const basis: "kilogram" | "unit" = reference.basis;
    const cost = computeCost(need, undefined, reference.price, basis);
    estimatedPicks.set(item.ing.id, {
      score: 0,
      price: undefined,
      estimate: { group: reference.label, price: reference.price, basis, source: ESTIMATE_SOURCE },
      cost,
    });
  }

  let nutritionTotal: Nutrition100 = {};
  let nutritionCovered = 0;

  const items: EstimateItem[] = matched.map(({ ing, pantry, categoryTag, exact, similar }) => {
    if (pantry) return { id: ing.id, ingredientName: ing.name, status: "pantry" };

    const candidates = [...exact, ...similar];
    const need = toBaseQuantity(ing.amount, ing.unit);
    const nutritionSource = candidates.find((candidate) => candidate.product.nutrition);
    let nutrition: Nutrition100 | undefined;
    if (nutritionSource?.product.nutrition && need && need.kind !== "count") {
      nutrition = scaleNutrition(nutritionSource.product.nutrition, need.amount);
      nutritionTotal = addNutrition(nutritionTotal, nutrition);
      nutritionCovered++;
    }

    const best =
      exactPicks.get(ing.id) ??
      categoryPicks.get(ing.id) ??
      similarPicks.get(ing.id) ??
      estimatedPicks.get(ing.id);
    if (best) {
      const estimated = Boolean(best.estimate);
      return {
        id: ing.id,
        ingredientName: ing.name,
        status: estimated ? "estimated" : "priced",
        product: best.product
          ? { ean: best.product.ean, name: best.product.name, brand: best.product.brand, package: best.product.package }
          : undefined,
        categoryTag: best.categoryTag,
        matchConfidence: best.score,
        price: best.price,
        estimate: best.estimate,
        packagesNeeded: best.cost.packagesNeeded,
        shoppingCost: best.cost.shoppingCost,
        ingredientCost: best.cost.ingredientCost,
        amountUnclear: best.cost.amountUnclear,
        nutrition,
      } satisfies EstimateItem;
    }
    const top = candidates[0];
    return {
      id: ing.id,
      ingredientName: ing.name,
      status: top || categoryTag ? "no_price" : "no_product",
      product: top ? { ean: top.product.ean, name: top.product.name, brand: top.product.brand, package: top.product.package } : undefined,
      categoryTag,
      matchConfidence: top?.score,
      nutrition,
    } satisfies EstimateItem;
  });

  const priced = items.filter((item) => item.status === "priced");
  const round = (n: number) => Math.round(n * 100) / 100;
  // Geschätzte Richtwerte zählen zum Einkaufswert, aber getrennt ausgewiesen
  const costed = items.filter((item) => item.status === "priced" || item.status === "estimated");
  const shoppingTotal = round(costed.reduce((sum, item) => sum + (item.shoppingCost ?? 0), 0));
  const allHaveValue = costed.length > 0 && costed.every((item) => item.ingredientCost !== undefined);
  const dates = priced.map((item) => item.price!.date).sort();
  const pantryCount = items.filter((item) => item.status === "pantry").length;

  return {
    retailer,
    items,
    shoppingTotal,
    ingredientValueTotal: allHaveValue ? round(costed.reduce((sum, item) => sum + (item.ingredientCost ?? 0), 0)) : undefined,
    pricedCount: priced.length,
    estimatedCount: items.filter((item) => item.status === "estimated").length,
    consideredCount: items.length - pantryCount,
    pantryCount,
    discountedCount: priced.filter((item) => item.price?.discounted).length,
    oldestPriceDate: dates[0],
    newestPriceDate: dates[dates.length - 1],
    nutrition: { total: nutritionTotal, coveredCount: nutritionCovered, consideredCount: items.length - pantryCount },
    sources: { products: productsOk ? "ok" : "error", prices: pricesOk ? "ok" : "error" },
    generatedAt: new Date().toISOString(),
  };
}

