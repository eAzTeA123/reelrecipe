import { describe, expect, it } from "vitest";
import type { Recipe, RecipeInput } from "@/domain/types";
import { PARSER_VERSION } from "@/parser";
import type { WebRecipeResponse } from "@/parser/universal/toWebRecipe";
import {
  isSocialUrl,
  planRefresh,
  planRefreshTargets,
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

describe("planRefreshTargets", () => {
  it("nimmt Rezepte mit gespeicherter Caption lokal (ohne Netz)", () => {
    const targets = planRefreshTargets([
      recipe({ sourceCaption: "Zutaten: 200 g Mehl", sourceUrl: REZEPTWELT_URL }),
    ]);
    expect(targets).toHaveLength(1);
    expect(targets[0].mode).toBe("caption");
  });

  it("nimmt Web-Rezepte über den Link", () => {
    const targets = planRefreshTargets([recipe({ sourceUrl: REZEPTWELT_URL })]);
    expect(targets).toHaveLength(1);
    expect(targets[0].mode).toBe("url");
    expect(targets[0].url).toBe(REZEPTWELT_URL);
  });

  it("ruft Instagram und TikTok nicht ab – dort reicht die gespeicherte Caption", () => {
    for (const url of [
      "https://www.instagram.com/p/xyz/",
      "https://www.tiktok.com/@a/video/1",
      "https://vm.tiktok.com/abc/",
    ]) {
      expect(isSocialUrl(url)).toBe(true);
      expect(planRefreshTargets([recipe({ sourceUrl: url })])).toHaveLength(0);
    }
    expect(isSocialUrl("https://www.chefkoch.de/rezepte/123/x.html")).toBe(false);
  });

  it("überspringt Rezepte ohne Caption und ohne brauchbaren Link", () => {
    expect(planRefreshTargets([recipe()])).toHaveLength(0);
    expect(planRefreshTargets([recipe({ sourceUrl: "keine url" })])).toHaveLength(0);
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

    const outcomes = await refreshRecipes(planRefreshTargets([target, blocked]), {
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
    expect(summary.fromUrl).toBe(2);
    expect(summary.fromCaption).toBe(0);
  });

  it("liest Rezepte aus der gespeicherten Caption lokal neu ein – ohne jeden Abruf", async () => {
    // Echte Caption: der Gerichtsname steht hinter dem Doppelpunkt
    const caption = [
      "Wenn's schnell gehen muss, aber trotzdem richtig lecker sein soll: Dieser herzhafte Ofenpfannkuchen ist ein absoluter Gamechanger!",
      "",
      "4 Eier",
      "150 g Mehl",
      "150 g Quark",
    ].join("\n");

    const stored = recipe({
      title: "Eier",
      sourceCaption: caption,
      // Der Nutzer hat „Mehl" in „Dinkelmehl" umbenannt
      ingredients: [{ id: "m1", amount: 150, unit: "g", name: "Dinkelmehl" }],
      steps: [{ id: "ms1", order: 1, instruction: "Alles verrühren." }],
      parseSnapshot: {
        title: "Eier",
        ingredients: [
          { name: "Mehl", amount: 150, unit: "g" },
          { name: "Quark", amount: 150, unit: "g" },
        ],
        steps: ["Alles verrühren."],
      },
    });

    let urlCalls = 0;
    const patches: Partial<RecipeInput>[] = [];
    const outcomes = await refreshRecipes(planRefreshTargets([stored]), {
      parseUrl: async () => {
        urlCalls++;
        return { status: "fetch_error" };
      },
      update: async (_id, patch) => {
        patches.push(patch);
      },
    });

    // Kein Abruf: die Caption liegt lokal vor
    expect(urlCalls).toBe(0);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].mode).toBe("caption");
    expect(outcomes[0].status).toBe("updated");
    // Titel kommt jetzt aus der Caption
    expect(patches[0].title).toBe("Herzhafte Ofenpfannkuchen");
    // Eigene Umbenennung bleibt, gelöschter Quark kommt nicht zurück
    const names = (patches[0].ingredients ?? []).map((ingredient) => ingredient.name);
    expect(names).toContain("Dinkelmehl");
    expect(names).not.toContain("Quark");
    expect(summarizeRefresh(outcomes).fromCaption).toBe(1);
  });
});
