import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { ObservedPrice, ProductCandidate } from "@/domain/productTypes";
import {
  categoryTagFor,
  computeCategoryCost,
  computeCost,
  isPantryIngredient,
  parsePackageSize,
  scoreProductName,
  searchTermFor,
  searchTermsFor,
  toBaseQuantity,
  MATCH_THRESHOLD,
} from "./matching";
import { normalizeOffHit, normalizeOpenPrice } from "./sources";
import { detectRetailer } from "./retailers";
import { estimateShopping } from "./estimate";

const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/fixtures/products", name), "utf-8"));

const NOW = new Date("2026-09-28T12:00:00Z");

describe("Produkt-Matching (streng, Komposita)", () => {
  const ok = (ing: string, prod: string) => expect(scoreProductName(ing, prod)).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  const no = (ing: string, prod: string) => expect(scoreProductName(ing, prod)).toBeLessThan(MATCH_THRESHOLD);

  it("erkennt gleiche Zutaten und Varianten", () => {
    ok("Hähnchenbrust", "Hähnchenbrustfilet Teilstück");
    ok("Spaghetti", "Spaghetti No. 5");
    ok("Zwiebel", "Zwiebeln gelb");
    ok("Knoblauchzehen", "Knoblauch");
    ok("Tomaten", "Kirschtomaten");
    ok("Milch", "Vollmilch 3,5%");
    ok("3 frische Eier", "Eier Bodenhaltung");
  });

  it("lehnt Regression-Fälle aus dem Audit ab", () => {
    no("Hähnchenbrühe", "Hähnchenbrustfilet Teilstücke");
    no("Tomatenmark", "Kirschtomaten Schale");
    no("Butterschmalz", "Deutsche Markenbutter");
    no("Paprikapulver edelsüß", "Paprika rot");
    no("Knoblauchpulver", "Knoblauch weiß Netz");
    no("Paprika", "Paprika Chips");
    no("Spaghetti", "Spaghetti mit Tomatensauce");
    no("Butter", "Erdnussbutter");
    // Live-Befund: Aufschnitt statt Rohware
    no("Hähnchenbrust", "Hähnchenbrust Scheiben");
    ok("Käse in Scheiben", "Gouda Käse Scheiben");
  });

  it("markiert Vorrat-Grundzutaten und bildet Suchbegriffe", () => {
    expect(isPantryIngredient("Salz")).toBe(true);
    expect(isPantryIngredient("etwas Wasser")).toBe(true);
    expect(isPantryIngredient("Salzstangen")).toBe(false);
    expect(searchTermFor("2 große rote Paprika")).toBe("paprika");
  });

  it("bildet mehrere mengenunabhängige Suchvarianten für uneinheitliche Quellen", () => {
    expect(searchTermsFor("Knoblauchzehen")).toEqual(["knoblauchzehen", "knoblauch"]);
    expect(searchTermsFor("Tomaten", "passierte")).toEqual(["tomaten passierte", "tomaten"]);
    expect(searchTermsFor("Rigatoni", "oder Penne")).toContain("penne");
    expect(searchTermsFor("Parmesan")).toContain("parmigiano reggiano");
    expect(categoryTagFor("Zwiebeln")).toBe("en:onions");
    // "passierte" ist eine eigene Produktkategorie (Passata) – vorher undefined
    expect(categoryTagFor("Tomaten", "passierte")).toBe("en:tomato-pastes");
  });

  it("erkennt Katalognamen, aber lehnt eine andere Produktform ab", () => {
    ok("Parmesan", "Parmigiano Reggiano DOP");
    ok("Sahne", "Schlagsahne 30 %");
    no("Sahne", "Saure Sahne");
    no("Knoblauchzehen", "Eingelegter Knoblauch");
    no("Basilikum", "Basilikum getrocknet");
    no("Chilischoten", "Chili con Carne");
    no("Chilischoten", "Gefüllte grüne Peperoni");
    no("Cherrytomaten", "Tomaten geschält Kirschtomaten");
    no("Rigatoni", "Vollkorn Penne");
    expect(scoreProductName("Tomaten", "Passierte Tomaten", "passierte")).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
    expect(scoreProductName("Tomaten", "Cherrytomaten", "passierte")).toBeLessThan(MATCH_THRESHOLD);
  });
});

describe("Mengen, Packungen und Kosten", () => {
  it("parst Packungsgrößen", () => {
    expect(parsePackageSize("600g")).toEqual({ amount: 600, kind: "mass" });
    expect(parsePackageSize("4 x 125 g")).toEqual({ amount: 500, kind: "mass" });
    expect(parsePackageSize("1 l")).toEqual({ amount: 1000, kind: "volume" });
    expect(parsePackageSize("10 Stück")).toEqual({ amount: 10, kind: "count" });
    expect(parsePackageSize(undefined, 250, "g")).toEqual({ amount: 250, kind: "mass" });
    expect(parsePackageSize("Packung")).toBeUndefined();
  });

  it("trennt Einkaufswert und Zutatenwert (350 g aus 600 g)", () => {
    const r = computeCost(toBaseQuantity(350, "g"), { amount: 600, kind: "mass" }, 5.99);
    expect(r).toEqual({ packagesNeeded: 1, shoppingCost: 5.99, ingredientCost: 3.49, amountUnclear: false });
  });

  it("kauft mehrere Packungen, wenn nötig", () => {
    const r = computeCost(toBaseQuantity(750, "g"), { amount: 500, kind: "mass" }, 1.2);
    expect(r.packagesNeeded).toBe(2);
    expect(r.shoppingCost).toBe(2.4);
  });

  it("erfindet keinen Anteil bei nicht vergleichbaren Einheiten (2 Paprika vs. 500 g)", () => {
    const r = computeCost(toBaseQuantity(2, undefined), { amount: 500, kind: "mass" }, 1.49);
    expect(r.amountUnclear).toBe(true);
    expect(r.ingredientCost).toBeUndefined();
    expect(r.shoppingCost).toBe(1.49);
  });

  it("rechnet Kilopreise anteilig", () => {
    const r = computeCost(toBaseQuantity(250, "g"), undefined, 3.99, "kilogram");
    expect(r.shoppingCost).toBe(1);
  });

  it("erfindet für Stück gegen Kategorie-Kilopreis keine Kosten", () => {
    const r = computeCategoryCost(toBaseQuantity(2, undefined), 9.9, "kilogram");
    expect(r.shoppingCost).toBeUndefined();
    expect(r.ingredientCost).toBeUndefined();
    expect(r.amountUnclear).toBe(true);
  });
});

describe("Normalisierung der echten API-Formate", () => {
  it("normalisiert Open-Food-Facts-Treffer", () => {
    const hits = fixture("off-search-haehnchenbrustfilet.json").hits.map(normalizeOffHit);
    expect(hits[1]).toMatchObject({
      ean: "4061458010627",
      name: "Hähnchenbrustfilet",
      brand: "Meine Metzgerei",
      package: { amount: 600, kind: "mass" },
      nutrition: { kcal: 102, protein: 22 },
    });
    expect(hits[2].nutrition).toBeUndefined();
  });

  it("verwendet nur deutsche, höchstens ein Jahr alte Preise und erkennt den Händler", () => {
    const prices = fixture("open-prices-items.json").items.map((r: Record<string, unknown>) => normalizeOpenPrice(r, NOW));
    expect(prices[0]).toMatchObject({ price: 5.99, retailerId: "aldi_nord", scope: "store_specific", date: "2026-09-12" });
    expect(prices[1]).toMatchObject({ discounted: true, regularPrice: 5.99, retailerId: "netto" });
    expect(prices[2]).toBeNull(); // Frankreich
    expect(prices[3]).toBeNull(); // älter als ein Jahr
  });

  it("normalisiert Kategoriepreise ohne erfundene EAN", () => {
    const price = normalizeOpenPrice({
      type: "CATEGORY",
      product_code: null,
      category_tag: "en:onions",
      price: 2.49,
      price_per: "KILOGRAM",
      price_is_discounted: false,
      currency: "EUR",
      date: "2026-09-20",
      location: { osm_name: "Edeka", osm_brand: "EDEKA", osm_address_city: "Berlin", osm_address_country_code: "DE" },
    }, NOW);
    expect(price).toMatchObject({
      ean: undefined,
      categoryTag: "en:onions",
      priceType: "CATEGORY",
      basis: "kilogram",
      confidence: 0.74,
      retailerId: "edeka",
    });
  });

  it("ordnet Filialen Händlern zu", () => {
    expect(detectRetailer("ALDI SÜD", "Aldi")).toBe("aldi_sued");
    expect(detectRetailer(null, "E-Center Müller")).toBe("edeka");
    expect(detectRetailer(null, "Netto City")).toBe("netto");
    expect(detectRetailer(null, "Wochenmarkt")).toBeUndefined();
  });
});

describe("Einkaufsschätzung (offline, injizierte Quellen)", () => {
  const products: ProductCandidate[] = fixture("off-search-haehnchenbrustfilet.json")
    .hits.map(normalizeOffHit)
    .filter(Boolean);
  const priceList: ObservedPrice[] = fixture("open-prices-items.json")
    .items.map((r: Record<string, unknown>) => normalizeOpenPrice(r, NOW))
    .filter(Boolean);
  const deps = {
    searchProducts: async (term: string) => (term.startsWith("hähnchen") ? products : []),
    fetchPrices: async (eans: string[]) => {
      const m = new Map<string, ObservedPrice[]>();
      for (const e of eans) m.set(e, priceList.filter((p) => p.ean === e));
      return m;
    },
  };
  const observed = (overrides: Partial<ObservedPrice> = {}): ObservedPrice => ({
    ean: "4000000000000",
    price: 1.49,
    currency: "EUR",
    basis: "package",
    priceType: "PRODUCT",
    confidence: 1,
    discounted: false,
    date: "2026-09-20",
    retrievedAt: "2026-09-28T12:00:00.000Z",
    storeName: "Testmarkt",
    scope: "store_specific",
    source: "open-prices",
    ...overrides,
  });
  const ingredients = [
    { id: "a", name: "Hähnchenbrust", amount: 350, unit: "g" },
    { id: "b", name: "Hähnchenbrühe", amount: 200, unit: "ml" },
    { id: "c", name: "Salz" },
    { id: "d", name: "Safranfäden", amount: 1 },
  ];

  it("priorisiert bei gleicher Match-Qualität den aktuelleren ähnlichen Produktpreis", async () => {
    const r = await estimateShopping(ingredients, "all", deps);
    const byId = Object.fromEntries(r.items.map((i) => [i.id, i]));
    expect(byId.a.status).toBe("priced");
    expect(byId.a.price?.retailerId).toBe("aldi_nord");
    expect(byId.a.price?.priceType).toBe("SIMILAR_PRODUCT");
    expect(byId.a.shoppingCost).toBe(5.99);
    // Brühe darf nie den Hähnchenfilet-Preis bekommen: statt "kein Preis" jetzt
    // ein klar gekennzeichneter Richtwert (kein erfundener Marktpreis!)
    expect(byId.b.status).toBe("estimated");
    expect(byId.b.price).toBeUndefined();
    expect(byId.b.estimate?.source).toContain("Schätzung");
    // …und zwar als Brühe, nicht als Fleisch (Vorher: 12,90 €/kg Hähnchen)
    expect(byId.b.estimate?.group).toBe("Brühe & Fond");
    expect(byId.b.shoppingCost).toBeGreaterThan(0);
    expect(byId.c.status).toBe("pantry");
    expect(byId.d.status).toBe("estimated");
    expect(r.pricedCount).toBe(1);
    expect(r.estimatedCount).toBe(2);
    expect(r.consideredCount).toBe(3);
    expect(r.shoppingTotal).toBeGreaterThan(5.99);
    expect(r.discountedCount).toBe(0);
    expect(r.nutrition.coveredCount).toBe(1);
    expect(Math.round(r.nutrition.total.protein!)).toBe(77);
  });

  it("filtert nach Händler und liefert sonst ehrlich keinen Preis", async () => {
    const aldi = await estimateShopping(ingredients, "aldi_nord", deps);
    expect(aldi.items.find((i) => i.id === "a")?.shoppingCost).toBe(5.99);
    const rewe = await estimateShopping(ingredients, "rewe", deps);
    const item = rewe.items.find((i) => i.id === "a");
    // Kein Marktpreis bei diesem Händler → Richtwert, aber niemals ein Fake-Preis
    expect(item?.status).toBe("estimated");
    expect(item?.price).toBeUndefined();
    expect(item?.estimate).toBeDefined();
    expect(rewe.pricedCount).toBe(0);
    expect(rewe.estimatedCount).toBeGreaterThan(0);
  });

  it("verwendet den Preis einer zweiten hochwertigen EAN als PRODUCT", async () => {
    const candidates: ProductCandidate[] = [
      { ean: "ean-a", name: "Parmesan" },
      { ean: "ean-b", name: "Parmesan 24 Monate gereift" },
    ];
    const r = await estimateShopping([{ id: "p", name: "Parmesan" }], "all", {
      searchProducts: async () => candidates,
      fetchPrices: async () => new Map([
        ["ean-a", []],
        ["ean-b", [observed({ ean: "ean-b", price: 2.99 })]],
      ]),
    });
    expect(r.items[0]).toMatchObject({ status: "priced", product: { ean: "ean-b" }, price: { priceType: "PRODUCT", ean: "ean-b" } });
  });

  it("verwendet für Rohware einen CATEGORY-Preis vor ähnlichen Produkten", async () => {
    const similar: ProductCandidate = { ean: "onion-product", name: "Zwiebeln gelb" };
    const categoryPrice = observed({
      ean: undefined,
      categoryTag: "en:onions",
      price: 2.49,
      basis: "kilogram",
      priceType: "CATEGORY",
      confidence: 0.74,
    });
    const r = await estimateShopping([{ id: "o", name: "Zwiebeln", amount: 200, unit: "g" }], "all", {
      searchProducts: async () => [similar],
      fetchPrices: async () => new Map([[similar.ean, []]]),
      fetchCategoryPrices: async () => new Map([["en:onions", [categoryPrice]]]),
    });
    expect(r.items[0]).toMatchObject({
      status: "priced",
      categoryTag: "en:onions",
      product: undefined,
      price: { priceType: "CATEGORY", categoryTag: "en:onions" },
      ingredientCost: 0.5,
      shoppingCost: 0.5,
    });
  });

  it("kennzeichnet eine sichere ähnliche Produktvariante als SIMILAR_PRODUCT", async () => {
    const exact: ProductCandidate = { ean: "chicken-a", name: "Hähnchenbrust" };
    const similar: ProductCandidate = { ean: "chicken-b", name: "Hähnchenbrustfilet" };
    const r = await estimateShopping([{ id: "h", name: "Hähnchenbrust", amount: 350, unit: "g" }], "all", {
      searchProducts: async () => [exact],
      fetchPrices: async () => new Map([[exact.ean, []]]),
      fetchSimilarProductPrices: async () => [{
        product: similar,
        prices: [observed({ ean: similar.ean, price: 4.49 })],
      }],
    });
    expect(r.items[0]).toMatchObject({
      status: "priced",
      product: { ean: "chicken-b" },
      price: { priceType: "SIMILAR_PRODUCT", ean: "chicken-b" },
      matchConfidence: 0.92,
    });
  });

  it("liefert für unbekannte Zutaten einen gekennzeichneten Richtwert statt 0 Euro", async () => {
    const r = await estimateShopping([{ id: "x", name: "Unbekannte Wunderknolle" }], "all", {
      searchProducts: async () => [],
      fetchPrices: async () => new Map(),
      fetchCategoryPrices: async () => new Map(),
    });
    // Nichts erfunden: kein Marktpreis, aber ein transparent markierter Richtwert
    expect(r.items[0].status).toBe("estimated");
    expect(r.items[0].price).toBeUndefined();
    expect(r.items[0].estimate?.source).toContain("Schätzung");
    expect(r.items[0].shoppingCost).toBeGreaterThan(0);
    expect(r.shoppingTotal).toBeGreaterThan(0);
    expect(r.estimatedCount).toBe(1);
  });

  it("sucht auch bei null Treffern mit Synonymen und allgemeineren Begriffen weiter", async () => {
    const searched: string[] = [];
    const parmesan: ProductCandidate = { ean: "8000000000001", name: "Parmigiano Reggiano DOP" };
    const r = await estimateShopping([{ id: "p", name: "Parmesan", amount: 50, unit: "g" }], "all", {
      searchProducts: async (term) => {
        searched.push(term);
        return term === "parmigiano reggiano" ? [parmesan] : [];
      },
      fetchPrices: async () => new Map([[parmesan.ean, [{
        ean: parmesan.ean,
        price: 3.49,
        currency: "EUR",
        basis: "package",
        priceType: "PRODUCT",
        confidence: 1,
        discounted: false,
        date: "2026-09-01",
        retrievedAt: "2026-09-28T12:00:00.000Z",
        storeName: "Testmarkt",
        scope: "store_specific",
        source: "open-prices",
      }]]]),
    });
    expect(searched).toContain("parmesan");
    expect(searched).toContain("parmigiano reggiano");
    expect(r.items[0].status).toBe("priced");
    expect(r.items[0].product?.name).toBe("Parmigiano Reggiano DOP");
  });

  it("meldet Quellfehler, statt Werte zu erfinden", async () => {
    const r = await estimateShopping(ingredients, "all", {
      searchProducts: async () => {
        throw new Error("timeout");
      },
      fetchPrices: deps.fetchPrices,
    });
    expect(r.sources.products).toBe("error");
    expect(r.pricedCount).toBe(0);
  });
});
