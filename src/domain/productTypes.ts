/**
 * Produkt-, Preis- und Nährwerttypen für die Einkaufsschätzung.
 * Datenquellen: Open Food Facts (Produkte, Nährwerte) und Open Prices (von
 * Nutzern gemeldete Kassenbon-/Preisschild-Preise). Keine erfundenen Werte:
 * fehlt eine Information, bleibt das Feld leer.
 */

export type RetailerId =
  | "lidl"
  | "aldi_sued"
  | "aldi_nord"
  | "rewe"
  | "edeka"
  | "kaufland"
  | "penny"
  | "netto";

export type RetailerFilter = RetailerId | "all";

/**
 * Status je Händler. Aktuell gibt es keinen direkten Händler-Adapter;
 * alle Preise stammen aus Open Prices ("partial").
 */
export type RetailerStatus =
  | "supported"
  | "partial"
  | "unavailable"
  | "blocked"
  | "requires_store"
  | "requires_auth"
  | "unknown";

export interface RetailerInfo {
  id: RetailerId;
  name: string;
  status: RetailerStatus;
}

/** Nährwerte je 100 g bzw. 100 ml */
export interface Nutrition100 {
  kcal?: number;
  protein?: number;
  carbohydrates?: number;
  sugar?: number;
  fat?: number;
  saturatedFat?: number;
  fiber?: number;
  salt?: number;
}

export type QuantityKind = "mass" | "volume" | "count";

export interface PackageSize {
  /** Menge in g, ml oder Stück */
  amount: number;
  kind: QuantityKind;
}

export interface ProductCandidate {
  ean: string;
  name: string;
  brand?: string;
  package?: PackageSize;
  nutrition?: Nutrition100;
}

export interface PricedProductCandidate {
  product: ProductCandidate;
  prices: ObservedPrice[];
}

export type PriceUnitBasis = "package" | "kilogram" | "unit";
export type PriceType = "PRODUCT" | "CATEGORY" | "SIMILAR_PRODUCT" | "ESTIMATE";

/**
 * Richtwert ohne Marktbeobachtung ("Schätzung"). Bewusst kein ObservedPrice:
 * es gibt keinen Kassenbon, keine Filiale und kein Datum. Die UI muss diesen
 * Wert immer als Schätzung kennzeichnen.
 */
export interface ReferenceEstimate {
  /** Anzeigename der Warengruppe, z. B. "Gemüse" */
  group: string;
  price: number;
  basis: PriceUnitBasis;
  /** Herkunftshinweis für die Details */
  source: string;
}

export interface ObservedPrice {
  ean?: string;
  categoryTag?: string;
  productId?: number;
  price: number;
  currency: "EUR";
  basis: PriceUnitBasis;
  priceType: PriceType;
  confidence: number;
  discounted: boolean;
  regularPrice?: number;
  /** Datum der Beobachtung (Kassenbon/Preisschild), ISO yyyy-mm-dd */
  date: string;
  retrievedAt: string;
  validFrom?: string;
  validUntil?: string;
  retailerId?: RetailerId;
  storeName: string;
  city?: string;
  region?: string;
  /** Filialpreis, niemals bundesweit gültig */
  scope: "store_specific";
  source: "open-prices";
}

export type EstimateItemStatus = "priced" | "estimated" | "no_price" | "no_product" | "pantry";

export interface EstimateItem {
  id: string;
  ingredientName: string;
  status: EstimateItemStatus;
  product?: { ean: string; name: string; brand?: string; package?: PackageSize };
  categoryTag?: string;
  matchConfidence?: number;
  price?: ObservedPrice;
  /** Gesetzt, wenn kein Marktpreis existiert und ein Richtwert einspringt */
  estimate?: ReferenceEstimate;
  packagesNeeded?: number;
  /** Tatsächlicher Kassenbetrag (ganze Packungen) */
  shoppingCost?: number;
  /** Anteil der Packung, der im Rezept verbraucht wird; leer, wenn Menge nicht vergleichbar */
  ingredientCost?: number;
  amountUnclear?: boolean;
  /** Nährwertbeitrag dieser Zutat (absolut), nur bei sicherer Zuordnung und bekannter Masse */
  nutrition?: Nutrition100;
}

export interface NutritionSummary {
  total: Nutrition100;
  /** Anzahl Zutaten, die in die Nährwertsumme eingeflossen sind */
  coveredCount: number;
  /** Anzahl berücksichtigter (nicht Vorrat-)Zutaten */
  consideredCount: number;
}

export interface ShoppingEstimate {
  retailer: RetailerFilter;
  items: EstimateItem[];
  shoppingTotal: number;
  /** Nur gesetzt, wenn für alle bepreisten Zutaten ein Anteil berechenbar war */
  ingredientValueTotal?: number;
  pricedCount: number;
  /** Zutaten, die nur über einen Richtwert geschätzt sind */
  estimatedCount: number;
  /** Zutaten ohne Vorrat-Grundzutaten */
  consideredCount: number;
  pantryCount: number;
  discountedCount: number;
  oldestPriceDate?: string;
  newestPriceDate?: string;
  nutrition: NutritionSummary;
  sources: {
    products: "ok" | "error";
    prices: "ok" | "error";
  };
  generatedAt: string;
}
