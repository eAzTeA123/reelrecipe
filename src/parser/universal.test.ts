import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  parse_recipe,
  detectInputType,
  parseIsoDurationToMinutes,
  flattenInstructions,
  flattenIngredients,
  detectBlockedPage,
  mergeRecipeFields,
  hasSiteScraperForUrl,
} from "./universal";
import { scrapeRezeptwelt } from "./universal/customScrapers";
import { toWebRecipeResponse } from "./universal/toWebRecipe";
import { generateSyntheticCaption } from "./universal/syntheticCaption";
import { runRecipeBenchmark } from "./universal/benchmarkRunner";
import { parseRecipe as captionParser } from "./index";

describe("Universal Recipe Parser - Unit Tests", () => {
  it("detects input types accurately", () => {
    expect(detectInputType("https://www.chefkoch.de/rezepte/123")).toBe("url");
    expect(detectInputType("http://example.com/food?id=1")).toBe("url");
    expect(
      detectInputType("<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>")
    ).toBe("html");
    expect(
      detectInputType("<div class=\"recipe\"><h2>Zutaten</h2><p>500g Mehl</p></div>")
    ).toBe("html");
    expect(
      detectInputType("Leckerer Kuchen\nZutaten:\n200 g Mehl\nZubereitung:\nBacken.")
    ).toBe("caption");
  });

  it("normalizes ISO-8601 durations into minutes", () => {
    expect(parseIsoDurationToMinutes("PT30M")).toBe(30);
    expect(parseIsoDurationToMinutes("PT1H")).toBe(60);
    expect(parseIsoDurationToMinutes("PT1H30M")).toBe(90);
    expect(parseIsoDurationToMinutes("P0DT1H45M")).toBe(105);
    expect(parseIsoDurationToMinutes("PT45S")).toBe(1);
    expect(parseIsoDurationToMinutes("invalid")).toBeUndefined();
  });

  it("flattens instructions from string, array, HowToStep, and HowToSection", () => {
    const rawSteps = [
      "Step 1: Prep",
      { "@type": "HowToStep", text: "Step 2: Cook" },
      {
        "@type": "HowToSection",
        itemListElement: [
          { "@type": "HowToStep", text: "Step 3a: Sauce" },
          { "@type": "HowToStep", text: "Step 3b: Simmer" },
        ],
      },
    ];
    const flattened = flattenInstructions(rawSteps);
    expect(flattened).toEqual([
      "Step 1: Prep",
      "Step 2: Cook",
      "Step 3a: Sauce",
      "Step 3b: Simmer",
    ]);
  });

  it("flattens ingredients properly", () => {
    const raw = ["200 g flour", { text: "2 eggs" }, ["1 cup milk", "pinch of salt"]];
    expect(flattenIngredients(raw)).toEqual([
      "200 g flour",
      "2 eggs",
      "1 cup milk",
      "pinch of salt",
    ]);
  });

  it("detects blocked, login, and paywall pages", () => {
    expect(detectBlockedPage("").isBlocked).toBe(true);
    expect(
      detectBlockedPage("<html><body><h1>Anmeldung erforderlich</h1><p>Bitte loggen Sie sich ein.</p></body></html>").status
    ).toBe("login_required");
    expect(
      detectBlockedPage("<html><body><h1>Exklusiv für Abonnenten</h1><p>Paywall text</p></body></html>").status
    ).toBe("paywall");
    expect(
      detectBlockedPage("<html><head><title>Just a moment...</title></head><body>cf-browser-verification</body></html>").status
    ).toBe("blocked");
  });

  it("checks dynamic site-scrapers and custom scrapers", () => {
    // allrecipes.com is registered in installed recipe-scrapers
    expect(hasSiteScraperForUrl("https://www.allrecipes.com/recipe/123/test")).toBe(true);
    // chefkoch.de is registered in our custom site-scrapers
    expect(hasSiteScraperForUrl("https://www.chefkoch.de/rezepte/123/test")).toBe(true);
    // unknown domain has no scraper
    expect(hasSiteScraperForUrl("https://www.unbekannte-rezepte-seite-xyz.de/123")).toBe(false);
  });

  it("merges fields per-field with correct source and confidence", () => {
    const merged = mergeRecipeFields(
      {
        hasScraper: true,
        title: "Scraper Title",
        ingredients: ["200 g flour", "2 eggs"],
      },
      {
        hasSchema: true,
        instructions: ["Mix ingredients", "Bake at 180C"],
        servings: 4,
      },
      null
    );

    expect(merged.titel.value).toBe("Scraper Title");
    expect(merged.titel.source).toBe("site-scraper");
    expect(merged.titel.confidence).toBeGreaterThan(0.9);

    expect(merged.zutaten.value).toEqual(["200 g flour", "2 eggs"]);
    expect(merged.zutaten.source).toBe("site-scraper");

    expect(merged.zubereitung.value).toEqual(["Mix ingredients", "Bake at 180C"]);
    expect(merged.zubereitung.source).toBe("schema");
    expect(merged.zubereitung.confidence).toBeGreaterThan(0.85);

    expect(merged.portionen.value).toBe(4);
    expect(merged.portionen.source).toBe("schema");
    expect(merged.isHighConfidence).toBe(true);
  });

  it("parses plain text caption with existing parser and assigns source=heuristik", async () => {
    const caption = `Creamy Garlic Chicken
für 2 Portionen | 25 Minuten

Zutaten:
500 g Hähnchenbrust
2 Eier
200 ml Sahne

Zubereitung:
1. Hähnchen schneiden und anbraten.
2. Sahne und Parmesan dazugeben.
3. 10 Minuten köcheln lassen.`;
    const result = await parse_recipe(caption);
    expect(result.status).toBe("success");
    expect(result.recipe).toBeDefined();
    expect(result.recipe!.titel.value).toBe("Creamy Garlic Chicken");
    expect(result.recipe!.titel.source).toBe("heuristik");
    expect(result.recipe!.zutaten.source).toBe("heuristik");
    expect(result.recipe!.zubereitung.source).toBe("heuristik");
    expect(result.recipe!.zutaten.value.length).toBe(3);
    expect(result.recipe!.zubereitung.value.length).toBe(3);
  });
});

describe("Synthetic Caption Generator & Caption Parser Benchmarking", () => {
  const sample = {
    titel: "Käsespätzle",
    zutaten: ["400 g Spätzlemehl", "4 Eier", "100 ml Wasser", "200 g Bergkäse", "2 Zwiebeln"],
    zubereitung: [
      "Teig schlagen bis er Blasen wirft.",
      "Spätzle ins kochende Wasser schaben.",
      "Mit geriebenem Bergkäse und Röstzwiebeln schichten.",
    ],
  };

  it("evaluates caption parser across synthetic styles", () => {
    const styles = [
      "markers",
      "no_markers",
      "continuous_text",
      "emojis",
      "newlines_sparse",
      "social_media",
    ] as const;

    for (const style of styles) {
      const syn = generateSyntheticCaption(sample, style);
      expect(syn.length).toBeGreaterThan(20);
      const res = captionParser(syn);
      // Ensure it produces a valid parsed recipe without crashing
      if (res) {
        expect(res.ingredients.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("Recipe Parser Multi-Site Benchmark", () => {
  it("runs the full multi-site benchmark runner against offline fixtures", async () => {
    const { results, summary } = await runRecipeBenchmark();
    console.log(summary);
    expect(results.length).toBeGreaterThanOrEqual(10);
    
    // Ensure all critical fixtures pass or are correctly recognized
    const passOrBlocked = results.filter((r) => r.passed);
    expect(passOrBlocked.length).toBe(results.length);
  });
});

/**
 * rezeptwelt.de (Thermomix®-Community).
 *
 * Diese Seite liefert **kein JSON-LD** (gemessen: 0 Blöcke), sondern nur
 * Microdata. Vorher lief sie durch den generischen Pfad; Titel, Zutaten und
 * Zubereitung kamen falsch oder gar nicht an. Der Test hält die drei Dinge
 * fest, die ein eigener Scraper löst:
 *
 * 1. Titel aus `meta[itemprop="name"]` („Spinat Risotto") statt der `<title>`-
 *    Zeile, die Autor, Kategorie und „Thermomix®" anhängt.
 * 2. Zutaten aus `li[itemprop="recipeIngredient"]`, deren Betrag, Einheit und
 *    Name in getrennten `<span>`-Elementen stehen.
 * 3. Zubereitung: **jeder Absatz ist ein Schritt.** Vorher landete die ganze
 *    Anleitung als ein Klumpen im Rezept.
 */
describe("rezeptwelt.de", () => {
  const url =
    "https://www.rezeptwelt.de/hauptgerichte-mit-gemuese-rezepte/spinat-risotto/899ild5b-c6243-476130-cfcd2-he8bv9kb";
  const html = readFileSync(
    path.join(process.cwd(), "tests/fixtures/recipes/rezeptwelt/recipe.html"),
    "utf8",
  );

  it("ist als eigene Seite registriert", () => {
    expect(hasSiteScraperForUrl(url)).toBe(true);
  });

  it("liest Titel, Zutaten, Zubereitung, Zeiten und Bild", () => {
    const result = scrapeRezeptwelt(html);
    expect(result?.title).toBe("Spinat Risotto");
    expect(result?.ingredients).toHaveLength(8);
    expect(result?.ingredients?.[0]).toBe("150 g Parmesan, ggf. weniger");
    expect(result?.ingredients?.[4]).toBe("350 g frischer Spinat, oder TK Spinat geht auch");
    expect(result?.instructions).toHaveLength(7);
    expect(result?.instructions?.[1]).toBe("Olivenöl zugeben und 3 Min./100°/Stufe 1 dünsten.");
    expect(result?.times).toEqual({ prep: 15, total: 15 });
    expect(result?.image).toContain("spinat-risotto.jpg");
    // `"portions":0` heißt „keine Angabe" – daraus darf keine 0 werden.
    expect(result?.servings).toBeUndefined();
  });

  it("übersetzt Thermomix-Symbole und lässt versteckten Text weg", () => {
    const joined = (scrapeRezeptwelt(html)?.instructions ?? []).join(" ");
    // Symbol „Mixtopf geschlossen" wird zu „Mixtopf", sonst fehlt das Wort im Satz
    expect(joined).toContain("Parmesan in den Mixtopf geben");
    // Einstellungen bleiben in Thermomix-Schreibweise zusammen
    expect(joined).toContain("100°/Linkslauf/Stufe 1");
    // Verschachtelte Elemente dürfen Zahlen nicht zerreißen („5 0 g")
    expect(joined).toContain("50 g vom geriebenen Parmesan");
    // Der versteckte Doppeltext zum Symbol darf nicht im Rezept landen
    expect(joined).not.toContain("Mixtopf geschlossen");
    expect(joined).not.toContain("d-none");
  });

  it("liefert die Absätze als einzelne Schritte, nicht als Sammelblock", () => {
    const instructions = scrapeRezeptwelt(html)?.instructions ?? [];
    // Die Seite liefert die Anleitung zusätzlich als Liste im HowToStep-Umschlag.
    // Ohne dessen Ausschluss kam die komplette Anleitung als ein Schritt.
    expect(instructions).toHaveLength(7);
    expect(instructions[0]).toBe(
      "Parmesan in den Mixtopf geben, 10 Sek./Stufe 10 zerkleinern, umfüllen und Mixtopf spülen. Zwiebel in den Mixtopf geben und 3 Sek./Stufe 5 zerkleinern.",
    );
    expect(instructions[1]).toBe("Olivenöl zugeben und 3 Min./100°/Stufe 1 dünsten.");
  });

  it("liest die Tipps (itemprop=recipeHint) als Beschreibung", () => {
    const description = scrapeRezeptwelt(html)?.description ?? "";
    // Mehrere Tipps werden aufgezählt, damit sie lesbar bleiben
    expect(description.startsWith("Tipps: ")).toBe(true);
    expect(description).toContain("durch Gemüsebrühe erstezen");
    expect(description).toContain("Tiefkühl-Spinat reichen uns 600ml Flüssigkeit");
    expect(description).toContain("Parmesan-, Öl- und Flüssigkeitsmenge anpassen");
    // Die Überschrift „Tipp" selbst ist keine Zutat und kein Tipp-Text
    expect(description).not.toBe("Tipp");
  });

  it("kennzeichnet einen einzelnen Tipp als Tipp", () => {
    // Fallback-Prüfung ohne zweites Fixture: zwei der drei Tipp-Absätze entfernen
    const onlyOne = html.replace(/<p>Beim verwenden von Tiefkühl-Spinat[\s\S]*?<\/p>/, "").replace(/<p>Viele mögen es[\s\S]*?<\/p>/, "");
    const description = scrapeRezeptwelt(onlyOne)?.description ?? "";
    expect(description.startsWith("Tipp: Wer keinen Weißwein")).toBe(true);
  });

  it("reicht die Tipps bis in die Beschreibung des Imports durch", async () => {
    const parsed = await parse_recipe(html, url);
    expect(parsed.status).toBe("success");
    // Der Seiten-Scraper hat Vorrang vor einer SEO-Beschreibung aus dem Schema
    expect(parsed.recipe?.sonstiges.source).toBe("site-scraper");
    expect(parsed.recipe?.sonstiges.value[0]).toContain("Tiefkühl-Spinat");

    const web = toWebRecipeResponse(parsed, url);
    expect(web.status).toBe("success");
    expect(web.recipe?.description).toContain("Tiefkühl-Spinat reichen uns 600ml Flüssigkeit");
  });
});

/**
 * rezeptwelt.de **mit Abschnitten** („Teig", „Belag, klassisch").
 *
 * Eigene Fixture, weil diese Seite anders aufgebaut ist als das Spinat-Risotto:
 * - Zutaten: Abschnitts-Überschriften stehen als eigene `<li>` in der Liste.
 * - Betrag, Einheit und Name kleben in getrennten Spans ohne Leerzeichen
 *   („30" + " g" + "Sahne or Kondensmilch").
 * - Die Anleitung steht in Listen innerhalb eines HowToStep-Umschlags; die
 *   Absätze sind nur die Abschnitts-Überschriften.
 * - „¼ TL" (Unicode-Bruch) muss als 0,25 TL ankommen.
 */
describe("rezeptwelt.de mit Abschnitten", () => {
  const url =
    "https://www.rezeptwelt.de/backen-herzhaft-rezepte/flammkuchen-knusprig/9exnygje-e2d56-724631-cfcd2-6ylvtrr7";
  const html = readFileSync(
    path.join(process.cwd(), "tests/fixtures/recipes/rezeptwelt-flammkuchen/recipe.html"),
    "utf8",
  );

  it("überspringt Abschnitts-Überschriften in der Zutatenliste", () => {
    const ingredients = scrapeRezeptwelt(html)?.ingredients ?? [];
    expect(ingredients).toHaveLength(12);
    expect(ingredients).not.toContain("Teig");
    expect(ingredients).not.toContain("Belag, klassisch");
  });

  it("verbindet Betrag, Einheit und Name mit Leerzeichen", () => {
    const ingredients = scrapeRezeptwelt(html)?.ingredients ?? [];
    expect(ingredients[0]).toBe("220 g Mehl");
    // Ohne die Leerzeichen-Regel klebte hier „30 gSahne or Kondensmilch" zusammen
    expect(ingredients).toContain("30 g Sahne or Kondensmilch");
    expect(ingredients).toContain("200 g Crème fraîche, or Schmand");
  });

  it("liest die Schritte aus den Listen und stellt die Überschrift davor", () => {
    const instructions = scrapeRezeptwelt(html)?.instructions ?? [];
    expect(instructions).toHaveLength(17);
    // Ein <li> ohne Blockkinder, mit der Überschrift des Abschnitts davor
    expect(instructions[0]).toContain("Teig: Alle Teigzutaten in den Mixtopf geben");
    expect(instructions[3]).toContain("Belag, klassisch: Zwiebeln in den Mixtopf geben");
    // Reine Überschriften dürfen keine eigenen Schritte sein
    expect(instructions).not.toContain("Teig:");
    expect(instructions).not.toContain("Belagvarianten:");
  });

  it("wandelt den Unicode-Bruch in eine Menge um und liefert keine Überschriften als Zutaten", async () => {
    const parsed = await parse_recipe(html, url);
    expect(parsed.status).toBe("success");
    const ingredients = parsed.recipe?.structuredIngredients ?? [];
    const salt = ingredients.find((ingredient) => ingredient.name === "Salz" && ingredient.unit === "TL");
    expect(salt?.amount).toBe(0.25);
    expect(ingredients.map((ingredient) => ingredient.name)).not.toContain("Teig");
  });
});
