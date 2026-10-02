import { describe, expect, it } from "vitest";
import type { Recipe } from "@/domain/types";
import { PARSER_VERSION } from "@/parser";
import type { WebRecipeResponse } from "@/parser/universal/toWebRecipe";
import {
  isRefreshableUrl,
  planRefresh,
  refreshRecipes,
  summarizeRefresh,
  type ParsedForRefresh,
} from "./refreshRecipes";

const REZEPTWELT_URL =
  "https://www.rezeptwelt.de/hauptgerichte-mit-gemuese-rezepte/spinat-risotto/899ild5b-c6243-476130-cfcd2-he8bv9kb";

function recipe(over: Partial<Recipe> = {}): Recipe {
  return {
    id: "r1",
    title: "Spinat Risotto",
    ingredients: [
      { id: "i1", amount: 1, unit: "Stück", name: "Zwiebel" },
      { id: "i2", amount: 20, unit: "g", name: "Butter" },
    ],
    steps: [
      { id: "s1", order: 1, instruction: "Zwiebel zerkleinern." },
      { id: "s2", order: 2, instruction: "Reis dünsten." },
    ],
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

const parsed: ParsedForRefresh = {
  title: "Spinat Risotto",
  ingredients: [
    { id: "p1", amount: 1, unit: "Stück", name: "Zwiebel" },
    { id: "p2", amount: 20, unit: "g", name: "Butter" },
  ],
  steps: [
    { id: "ps1", order: 1, instruction: "Zwiebel zerkleinern." },
    { id: "ps2", order: 2, instruction: "Reis dünsten." },
  ],
  description: "Tipps: • Wer keinen Weißwein darf, nimmt Gemüsebrühe.",
};

describe("isRefreshableUrl", () => {
  it("erkennt rezeptwelt-Links, auch mit www und Unterdomain", () => {
    expect(isRefreshableUrl(REZEPTWELT_URL)).toBe(true);
    expect(isRefreshableUrl("https://rezeptwelt.de/rezept/abc")).toBe(true);
    expect(isRefreshableUrl("https://m.rezeptwelt.de/rezept/abc")).toBe(true);
  });

  it("lehnt andere Seiten und Unsinn ab", () => {
    expect(isRefreshableUrl("https://www.chefkoch.de/rezepte/123/Toast.html")).toBe(false);
    expect(isRefreshableUrl("https://www.instagram.com/p/xyz/")).toBe(false);
    expect(isRefreshableUrl("https://rezeptwelt.de.example.com/x")).toBe(false);
    expect(isRefreshableUrl("keine url")).toBe(false);
    expect(isRefreshableUrl(undefined)).toBe(false);
  });
});

describe("planRefresh", () => {
  it("ergänzt die Tipps, wenn noch keine Beschreibung dasteht", () => {
    const plan = planRefresh(recipe(), parsed);
    expect(plan.patch?.description).toContain("Gemüsebrühe");
    expect(plan.filled).toContain("Tipps");
  });

  it("lässt einen selbst geschriebenen Text stehen", () => {
    const plan = planRefresh(recipe({ description: "Mein eigener Hinweis." }), parsed);
    expect(plan.patch?.description).toBeUndefined();
    expect(plan.kept).toContain("Beschreibung");
  });

  it("schützt umbenannte und gelöschte Zutaten", () => {
    const stored = recipe({
      // Der Nutzer hat „Zwiebel" in „rote Zwiebel" umbenannt und „Butter" gelöscht
      ingredients: [{ id: "i1", amount: 1, unit: "Stück", name: "rote Zwiebel" }],
      parseSnapshot: {
        title: "Spinat Risotto",
        ingredients: [
          { name: "Zwiebel", amount: 1, unit: "Stück" },
          { name: "Butter", amount: 20, unit: "g" },
        ],
        steps: ["Zwiebel zerkleinern.", "Reis dünsten."],
      },
    });
    const plan = planRefresh(stored, parsed);
    // Bleibt die Zutatenliste unverändert, wird sie gar nicht erst geschrieben –
    // geprüft wird deshalb das Ergebnis, nicht der Patch.
    const names = (plan.patch?.ingredients ?? stored.ingredients).map((i) => i.name);
    expect(names).toContain("rote Zwiebel");
    // Die gelöschte Butter darf nicht zurückkommen
    expect(names).not.toContain("Butter");
    expect(plan.respectedEdits).toBeGreaterThan(0);
    expect(plan.respectedRemovals).toBeGreaterThan(0);
    expect(plan.userEdited).toBe(true);
  });

  it("meldet nichts zu tun, wenn sich nichts ändert", () => {
    const stored = recipe({
      parseSnapshot: {
        title: "Spinat Risotto",
        ingredients: [
          { name: "Zwiebel", amount: 1, unit: "Stück" },
          { name: "Butter", amount: 20, unit: "g" },
        ],
        steps: ["Zwiebel zerkleinern.", "Reis dünsten."],
      },
      parserVersion: PARSER_VERSION,
    } as Partial<Recipe>);
    const plan = planRefresh(stored, {
      ...parsed,
      description: undefined,
      // gleiche ids wie gespeichert, damit der Vergleich greift
      ingredients: [
        { id: "i1", amount: 1, unit: "Stück", name: "Zwiebel" },
        { id: "i2", amount: 20, unit: "g", name: "Butter" },
      ],
      steps: [
        { id: "s1", order: 1, instruction: "Zwiebel zerkleinern." },
        { id: "s2", order: 2, instruction: "Reis dünsten." },
      ],
    });
    expect(plan.patch).toBeNull();
  });

  it("ersetzt kein eigenes Foto, aktualisiert aber ein fremdes", () => {
    const withOwn = planRefresh(recipe({ image: "local-image:abc" }), { ...parsed, image: "https://x/y.jpg" });
    expect(withOwn.patch?.image).toBeUndefined();
    expect(withOwn.kept).toContain("eigenes Bild");

    const withRemote = planRefresh(recipe({ image: "https://alt/alt.jpg" }), { ...parsed, image: "https://x/y.jpg" });
    expect(withRemote.patch?.image).toBe("https://x/y.jpg");
  });

  it("übernimmt neue Zeiten und Portionen nur, wenn sie fehlen", () => {
    const plan = planRefresh(recipe(), { ...parsed, servings: 4, prepTime: 15, cookTime: 20 });
    expect(plan.patch?.servings).toBe(4);
    expect(plan.patch?.prepTime).toBe(15);
    expect(plan.patch?.cookTime).toBe(20);

    const filled = planRefresh(recipe({ servings: 2, prepTime: 5 }), { ...parsed, servings: 4, prepTime: 15 });
    expect(filled.patch?.servings).toBeUndefined();
    expect(filled.patch?.prepTime).toBeUndefined();
  });
});

describe("refreshRecipes", () => {
  it("aktualisiert, meldet Unverändertes und benennt Fehlschläge im Klartext", async () => {
    const target = recipe({ sourceUrl: REZEPTWELT_URL, parserVersion: 15, parseSnapshot: {
      title: "Spinat Risotto",
      ingredients: [
        { name: "Zwiebel", amount: 1, unit: "Stück" },
        { name: "Butter", amount: 20, unit: "g" },
      ],
      steps: ["Zwiebel zerkleinern.", "Reis dünsten."],
    } });
    const blocked = recipe({ id: "r2", title: "Nur mit Anmeldung", sourceUrl: `${REZEPTWELT_URL}/r2` });
    const updated: string[] = [];

    const outcomes = await refreshRecipes([target, blocked], {
      parseUrl: async (url): Promise<WebRecipeResponse> => {
        if (url.endsWith("/r2")) return { status: "login_required" };
        return {
          status: "success",
          recipe: {
            title: "Spinat Risotto",
            ingredients: [
              { id: "i1", amount: 1, unit: "Stück", name: "Zwiebel" },
              { id: "i2", amount: 20, unit: "g", name: "Butter" },
            ],
            steps: [
              { id: "s1", order: 1, instruction: "Zwiebel zerkleinern." },
              { id: "s2", order: 2, instruction: "Reis dünsten." },
            ],
            description: "Tipps: • Gemüsebrühe statt Weißwein.",
            sourceUrl: REZEPTWELT_URL,
            confidence: 0.9,
            highConfidence: true,
            fieldSources: {},
          },
        };
      },
      update: async (id) => {
        updated.push(id);
      },
    });

    // Zweiter Aufruf liefert immer dasselbe – deshalb hier der erste Datensatz
    expect(outcomes[0].status).toBe("updated");
    expect(outcomes[0].filled).toContain("Tipps");
    expect(outcomes[1].status).toBe("failed");
    expect(outcomes[1].reason).toBe("nur mit Anmeldung lesbar");
    expect(updated).toEqual(["r1"]);

    const summary = summarizeRefresh(outcomes);
    expect(summary.updated).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.tipsFilled).toBe(1);
  });
});
