import { NextResponse } from "next/server";
import type { RetailerFilter } from "@/domain/productTypes";
import { estimateShopping, type EstimateIngredient } from "@/lib/products/estimate";
import { fetchCategoryPrices, fetchPrices, fetchSimilarProductPrices, searchProducts, searchProductsInCategory } from "@/lib/products/sources";
import { RETAILERS } from "@/lib/products/retailers";

const MAX_INGREDIENTS = 40;
const RETAILER_IDS = new Set<string>(["all", ...RETAILERS.map((r) => r.id)]);

function parseIngredients(v: unknown): EstimateIngredient[] | null {
  if (!Array.isArray(v) || v.length > MAX_INGREDIENTS) return null;
  const out: EstimateIngredient[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.name !== "string") return null;
    const name = r.name.trim().slice(0, 120);
    if (!name) continue;
    const notes = typeof r.notes === "string" ? r.notes.trim().slice(0, 120) : undefined;
    const amount = typeof r.amount === "number" && Number.isFinite(r.amount) && r.amount > 0 ? r.amount : undefined;
    const unit = typeof r.unit === "string" ? r.unit.slice(0, 20) : undefined;
    out.push({ id: r.id.slice(0, 80), name, notes, amount, unit });
  }
  return out;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const ingredients = parseIngredients(body.ingredients);
  const retailer = typeof body.retailer === "string" && RETAILER_IDS.has(body.retailer) ? (body.retailer as RetailerFilter) : null;
  if (!ingredients || !retailer) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    const estimate = await estimateShopping(ingredients, retailer, {
      searchProducts,
      fetchPrices,
      fetchCategoryPrices,
      fetchSimilarProductPrices,
      searchProductsInCategory,
    });
    return NextResponse.json(estimate);
  } catch (e) {
    console.error("Einkaufsschätzung fehlgeschlagen", e);
    return NextResponse.json({ error: "estimate_failed" }, { status: 502 });
  }
}

