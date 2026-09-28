import type { Nutrition100, ObservedPrice, ProductCandidate } from "@/domain/productTypes";
import { parsePackageSize } from "./matching";
import { detectRetailer } from "./retailers";
import { TtlCache } from "./cache";

const USER_AGENT = "ReelRecipe/0.1 (private Rezept-App; lokale Nutzung)";
const TIMEOUT_MS = 8000;
const OFF_SEARCH_URL = "https://search.openfoodfacts.org/search";
const OPEN_PRICES_URL = "https://prices.openfoodfacts.org/api/v1/prices";
/** Preise älter als ein Jahr werden nicht verwendet */
const MAX_PRICE_AGE_DAYS = 365;
const MAX_PRICE_PAGES = 3;

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} für ${new URL(url).host}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function num(v: unknown, digits = 1): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Number(v.toFixed(digits)) : undefined;
}

/** Normalisiert einen Open-Food-Facts-Suchtreffer */
export function normalizeOffHit(hit: Record<string, unknown>): ProductCandidate | null {
  const ean = typeof hit.code === "string" ? hit.code : "";
  const name = String(hit.product_name_de || hit.product_name || "").trim();
  if (!ean || !name) return null;
  const n = (hit.nutriments as Record<string, unknown>) ?? {};
  const nutrition: Nutrition100 = {
    kcal: num(n["energy-kcal_100g"], 0),
    protein: num(n["proteins_100g"]),
    carbohydrates: num(n["carbohydrates_100g"]),
    sugar: num(n["sugars_100g"]),
    fat: num(n["fat_100g"]),
    saturatedFat: num(n["saturated-fat_100g"]),
    fiber: num(n["fiber_100g"]),
    salt: num(n["salt_100g"], 2),
  };
  const hasNutrition = Object.values(nutrition).some((v) => v !== undefined);
  const brands = Array.isArray(hit.brands) ? hit.brands.join(", ") : typeof hit.brands === "string" ? hit.brands : undefined;
  return {
    ean,
    name,
    brand: brands?.split(",")[0]?.trim() || undefined,
    package: parsePackageSize(
      typeof hit.quantity === "string" ? hit.quantity : undefined,
      hit.product_quantity as number | string | undefined,
      typeof hit.product_quantity_unit === "string" ? hit.product_quantity_unit : undefined,
    ),
    nutrition: hasNutrition ? nutrition : undefined,
  };
}

/** Normalisiert einen Open-Prices-Eintrag; nur Preise aus Deutschland in EUR */
export function normalizeOpenPrice(raw: Record<string, unknown>, now = new Date()): ObservedPrice | null {
  const location = (raw.location as Record<string, unknown>) ?? {};
  if (location.osm_address_country_code !== "DE") return null;
  if (raw.currency !== "EUR") return null;
  const price = typeof raw.price === "number" ? raw.price : NaN;
  const ean = typeof raw.product_code === "string" ? raw.product_code : "";
  const date = typeof raw.date === "string" ? raw.date : "";
  if (!ean || !date || !Number.isFinite(price) || price <= 0) return null;
  const ageDays = (now.getTime() - new Date(date).getTime()) / 86_400_000;
  if (!(ageDays <= MAX_PRICE_AGE_DAYS)) return null;
  const pricePer = raw.price_per;
  return {
    ean,
    price,
    currency: "EUR",
    basis: pricePer === "KILOGRAM" ? "kilogram" : pricePer === "UNIT" && raw.type === "CATEGORY" ? "unit" : "package",
    discounted: raw.price_is_discounted === true,
    regularPrice: typeof raw.price_without_discount === "number" ? raw.price_without_discount : undefined,
    date,
    retailerId: detectRetailer(location.osm_brand as string | null, location.osm_name as string | null),
    storeName: String(location.osm_name || location.osm_brand || "Unbekannte Filiale"),
    city: typeof location.osm_address_city === "string" ? location.osm_address_city : undefined,
    scope: "store_specific",
    source: "open-prices",
  };
}

const productCache = new TtlCache<ProductCandidate[]>(24 * 3600_000);
const priceCache = new TtlCache<ObservedPrice[]>(6 * 3600_000, 5000);

/** Produktsuche in Open Food Facts (nur in Deutschland verkaufte Produkte) */
export async function searchProducts(term: string): Promise<ProductCandidate[]> {
  const key = term.toLowerCase();
  return productCache.getOrLoad(key, async () => {
    const params = new URLSearchParams({
      q: `${term} countries_tags:"en:germany"`,
      langs: "de",
      page_size: "48",
      fields: "code,product_name,product_name_de,brands,quantity,product_quantity,product_quantity_unit,nutriments",
    });
    const data = (await fetchJson(`${OFF_SEARCH_URL}?${params}`)) as { hits?: Record<string, unknown>[] };
    return (data.hits ?? []).map(normalizeOffHit).filter((p): p is ProductCandidate => p !== null);
  });
}

/** Holt gemeldete Preise für mehrere EANs gebündelt (max. 50 je Anfrage) */
export async function fetchPrices(eans: string[]): Promise<Map<string, ObservedPrice[]>> {
  const result = new Map<string, ObservedPrice[]>();
  const missing: string[] = [];
  for (const ean of new Set(eans)) {
    const hit = priceCache.get(ean);
    if (hit) result.set(ean, hit);
    else missing.push(ean);
  }
  const since = new Date(Date.now() - MAX_PRICE_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);
  for (let i = 0; i < missing.length; i += 50) {
    const chunk = missing.slice(i, i + 50);
    const grouped = new Map<string, ObservedPrice[]>(chunk.map((e) => [e, []]));
    // Beliebte Produkte haben viele Preise aus anderen Euro-Ländern; bis zu 3 Seiten lesen,
    // damit deutsche Preise nicht verdrängt werden.
    for (let page = 1; page <= MAX_PRICE_PAGES; page++) {
      const params = new URLSearchParams({
        product_code__in: chunk.join(","),
        currency: "EUR",
        date__gte: since,
        order_by: "-date",
        size: "100",
        page: String(page),
      });
      const data = (await fetchJson(`${OPEN_PRICES_URL}?${params}`)) as { items?: Record<string, unknown>[]; pages?: number };
      for (const raw of data.items ?? []) {
        const p = normalizeOpenPrice(raw);
        if (p) grouped.get(p.ean)?.push(p);
      }
      if (!data.pages || page >= data.pages) break;
    }
    for (const [ean, list] of grouped) {
      priceCache.set(ean, list);
      result.set(ean, list);
    }
  }
  return result;
}
