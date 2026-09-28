import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { ObservedPrice, ProductCandidate } from "@/domain/productTypes";
import {
  computeCost,
  isPantryIngredient,
  parsePackageSize,
  scoreProductName,
  searchTermFor,
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
  const ingredients = [
    { id: "a", name: "Hähnchenbrust", amount: 350, unit: "g" },
    { id: "b", name: "Hähnchenbrühe", amount: 200, unit: "ml" },
    { id: "c", name: "Salz" },
    { id: "d", name: "Safranfäden", amount: 1 },
  ];

  it("wählt den günstigsten echten Preis und kennzeichnet Lücken", async () => {
    const r = await estimateShopping(ingredients, "all", deps);
    const byId = Object.fromEntries(r.items.map((i) => [i.id, i]));
    expect(byId.a.status).toBe("priced");
    expect(byId.a.price?.retailerId).toBe("netto");
    expect(byId.a.shoppingCost).toBe(4.79);
    // Brühe darf nie den Hähnchenfilet-Preis bekommen
    expect(byId.b.status).toBe("no_price");
    expect(byId.b.product?.name).toBe("Hähnchenbrühe klar");
    expect(byId.b.shoppingCost).toBeUndefined();
    expect(byId.c.status).toBe("pantry");
    expect(byId.d.status).toBe("no_product");
    expect(r.pricedCount).toBe(1);
    expect(r.consideredCount).toBe(3);
    expect(r.shoppingTotal).toBe(4.79);
    expect(r.discountedCount).toBe(1);
    expect(r.nutrition.coveredCount).toBe(1);
    expect(Math.round(r.nutrition.total.protein!)).toBe(77);
  });

  it("filtert nach Händler und liefert sonst ehrlich keinen Preis", async () => {
    const aldi = await estimateShopping(ingredients, "aldi_nord", deps);
    expect(aldi.items.find((i) => i.id === "a")?.shoppingCost).toBe(5.99);
    const rewe = await estimateShopping(ingredients, "rewe", deps);
    expect(rewe.items.find((i) => i.id === "a")?.status).toBe("no_price");
    expect(rewe.shoppingTotal).toBe(0);
    expect(rewe.pricedCount).toBe(0);
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
