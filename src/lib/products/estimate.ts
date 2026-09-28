import type {
  EstimateItem,
  Nutrition100,
  ObservedPrice,
  ProductCandidate,
  RetailerFilter,
  ShoppingEstimate,
} from "@/domain/productTypes";
import {
  MATCH_THRESHOLD,
  addNutrition,
  computeCost,
  isPantryIngredient,
  scaleNutrition,
  scoreProductName,
  searchTermFor,
  toBaseQuantity,
} from "./matching";
import { mapLimit } from "./cache";

export interface EstimateIngredient {
  id: string;
  name: string;
  amount?: number;
  unit?: string;
}

export interface EstimateDeps {
  searchProducts: (term: string) => Promise<ProductCandidate[]>;
  fetchPrices: (eans: string[]) => Promise<Map<string, ObservedPrice[]>>;
}

/** Maximal so viele Kandidaten je Zutat werden auf Preise geprüft */
const MAX_CANDIDATES = 20;

interface Matched {
  ing: EstimateIngredient;
  pantry: boolean;
  candidates: { product: ProductCandidate; score: number }[];
}

function pickPrice(
  ing: EstimateIngredient,
  candidates: { product: ProductCandidate; score: number }[],
  prices: Map<string, ObservedPrice[]>,
  retailer: RetailerFilter,
) {
  const need = toBaseQuantity(ing.amount, ing.unit);
  let best:
    | { product: ProductCandidate; score: number; price: ObservedPrice; cost: ReturnType<typeof computeCost> }
    | undefined;
  for (const c of candidates) {
    for (const p of prices.get(c.product.ean) ?? []) {
      if (retailer !== "all" && p.retailerId !== retailer) continue;
      const cost = computeCost(need, c.product.package, p.price, p.basis);
      if (
        !best ||
        cost.shoppingCost < best.cost.shoppingCost ||
        (cost.shoppingCost === best.cost.shoppingCost && p.date > best.price.date)
      ) {
        best = { product: c.product, score: c.score, price: p, cost };
      }
    }
  }
  return best;
}

/**
 * Schätzt Einkaufswert und Nährwerte aus echten Datenquellen.
 * Fehlende Daten werden als solche gekennzeichnet, nie ergänzt.
 */
export async function estimateShopping(
  ingredients: EstimateIngredient[],
  retailer: RetailerFilter,
  deps: EstimateDeps,
): Promise<ShoppingEstimate> {
  let productsOk = true;
  let pricesOk = true;

  const matched: Matched[] = await mapLimit(ingredients, 3, async (ing) => {
    if (isPantryIngredient(ing.name)) return { ing, pantry: true, candidates: [] };
    const term = searchTermFor(ing.name);
    if (!term) return { ing, pantry: false, candidates: [] };
    try {
      const products = await deps.searchProducts(term);
      const candidates = products
        .map((product) => ({ product, score: scoreProductName(ing.name, product.name) }))
        .filter((c) => c.score >= MATCH_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_CANDIDATES);
      return { ing, pantry: false, candidates };
    } catch (e) {
      console.warn("Produktsuche fehlgeschlagen", term, e);
      productsOk = false;
      return { ing, pantry: false, candidates: [] };
    }
  });

  let prices = new Map<string, ObservedPrice[]>();
  const eans = matched.flatMap((m) => m.candidates.map((c) => c.product.ean));
  if (eans.length > 0) {
    try {
      prices = await deps.fetchPrices(eans);
    } catch (e) {
      console.warn("Preisabfrage fehlgeschlagen", e);
      pricesOk = false;
    }
  }

  let nutritionTotal: Nutrition100 = {};
  let nutritionCovered = 0;

  const items: EstimateItem[] = matched.map(({ ing, pantry, candidates }) => {
    if (pantry) return { id: ing.id, ingredientName: ing.name, status: "pantry" };

    const need = toBaseQuantity(ing.amount, ing.unit);
    const nutritionSource = candidates.find((c) => c.product.nutrition);
    let nutrition: Nutrition100 | undefined;
    if (nutritionSource?.product.nutrition && need && need.kind !== "count") {
      nutrition = scaleNutrition(nutritionSource.product.nutrition, need.amount);
      nutritionTotal = addNutrition(nutritionTotal, nutrition);
      nutritionCovered++;
    }

    const best = pickPrice(ing, candidates, prices, retailer);
    if (best) {
      return {
        id: ing.id,
        ingredientName: ing.name,
        status: "priced",
        product: { ean: best.product.ean, name: best.product.name, brand: best.product.brand, package: best.product.package },
        matchConfidence: best.score,
        price: best.price,
        packagesNeeded: best.cost.packagesNeeded,
        shoppingCost: best.cost.shoppingCost,
        ingredientCost: best.cost.ingredientCost,
        amountUnclear: best.cost.amountUnclear,
        nutrition,
      };
    }
    const top = candidates[0];
    return {
      id: ing.id,
      ingredientName: ing.name,
      status: top ? "no_price" : "no_product",
      product: top ? { ean: top.product.ean, name: top.product.name, brand: top.product.brand, package: top.product.package } : undefined,
      matchConfidence: top?.score,
      nutrition,
    };
  });

  const priced = items.filter((i) => i.status === "priced");
  const round = (n: number) => Math.round(n * 100) / 100;
  const shoppingTotal = round(priced.reduce((s, i) => s + (i.shoppingCost ?? 0), 0));
  const allHaveValue = priced.length > 0 && priced.every((i) => i.ingredientCost !== undefined);
  const dates = priced.map((i) => i.price!.date).sort();
  const pantryCount = items.filter((i) => i.status === "pantry").length;

  return {
    retailer,
    items,
    shoppingTotal,
    ingredientValueTotal: allHaveValue ? round(priced.reduce((s, i) => s + (i.ingredientCost ?? 0), 0)) : undefined,
    pricedCount: priced.length,
    consideredCount: items.length - pantryCount,
    pantryCount,
    discountedCount: priced.filter((i) => i.price?.discounted).length,
    oldestPriceDate: dates[0],
    newestPriceDate: dates[dates.length - 1],
    nutrition: { total: nutritionTotal, coveredCount: nutritionCovered, consideredCount: items.length - pantryCount },
    sources: { products: productsOk ? "ok" : "error", prices: pricesOk ? "ok" : "error" },
    generatedAt: new Date().toISOString(),
  };
}
