/**
 * Rezepte erneut durch den Parser schicken.
 *
 * Anlass: Der Import wird laufend besser (neue Seitenscraper, bessere
 * Zutaten-Zerlegung). Bereits gespeicherte Rezepte sollen davon profitieren,
 * ohne dass man sie von Hand neu anlegt.
 *
 * Zwei harte Regeln:
 * 1. **Nichts überschreiben, was der Nutzer geändert hat.** Der Merge läuft über
 *    `mergeParsedRecipe` (siehe `data/local/parseMerge.ts`, dort ausführlich
 *    begründet). Umbenannte Zutaten, gelöschte Einträge, eigene Schritte und ein
 *    selbst gesetzter Titel bleiben stehen.
 * 2. **Fehlende Angaben ergänzen, vorhandene nicht ersetzen.** Betrifft Felder
 *    ohne Snapshot-Vergleich: Beschreibung (Tipps), Portionen, Zeiten und Bild.
 *    Ein eigenes Foto (`local-image:…`) wird nie durch das Seitenbild ersetzt.
 *
 * Der Ablauf ist bewusst nacheinander: Seitenabrufe sind teuer und die Route
 * fragt fremde Server ab – kein Burst aus dem Browser.
 */

import { PARSER_VERSION, parseRecipe } from "@/parser";
import { createParseSnapshot, mergeParsedRecipe } from "@/data/local/parseMerge";
import type { Ingredient, Recipe, RecipeInput, RecipeStep } from "@/domain/types";
import type { WebRecipeResponse } from "@/parser/universal/toWebRecipe";

/** Plattformen, deren Caption bereits lokal liegt – dort wird **nicht** abgerufen. */
const SOCIAL_HOSTS = ["instagram.com", "tiktok.com", "vm.tiktok.com"] as const;

export function isSocialUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return SOCIAL_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
  } catch {
    return false;
  }
}

export type RefreshMode = "caption" | "url";

export interface RefreshTarget {
  recipe: Recipe;
  mode: RefreshMode;
  /** nur bei mode "url" gesetzt */
  url?: string;
}

/**
 * Entscheidet je Rezept, wie es neu eingelesen wird.
 *
 * - `caption`: Die Caption liegt lokal vor (Instagram, TikTok, eingefügter Text)
 *   → lokal parsen, kein Netzabruf, dauert Millisekunden.
 * - `url`: Es gibt nur einen Link auf eine Rezeptseite → Seite neu abrufen.
 * - kein Ziel: weder Caption noch brauchbarer Link → nichts zu tun.
 *
 * Soziale Links werden bewusst **nicht** abgerufen: Die Caption liegt bereits
 * vor, und die Plattform-Schnittstellen (oEmbed/og-Tags) sind langsam und
 * unzuverlässig. Sie laufen deshalb über den Caption-Weg mit.
 */
export function planRefreshTargets(recipes: Recipe[]): RefreshTarget[] {
  const targets: RefreshTarget[] = [];
  for (const recipe of recipes) {
    if (recipe.sourceCaption?.trim()) {
      targets.push({ recipe, mode: "caption" });
      continue;
    }
    const url = recipe.sourceUrl?.trim() ?? "";
    if (/^https?:\/\//.test(url) && !isSocialUrl(url)) {
      targets.push({ recipe, mode: "url", url });
    }
  }
  return targets;
}

/** Parser-Ergebnis aus der gespeicherten Caption – ohne Netz, für Tests injizierbar. */
export function parsedFromCaption(caption: string): ParsedForRefresh | null {
  const parsed = parseRecipe(caption);
  if (!parsed || (parsed.ingredients.length === 0 && parsed.steps.length === 0)) return null;
  return {
    title: parsed.title,
    ingredients: parsed.ingredients,
    steps: parsed.steps,
    servings: parsed.servings,
    prepTime: parsed.prepTime,
    cookTime: parsed.cookTime,
  };
}

/** Das Parser-Ergebnis, soweit es für eine Aktualisierung gebraucht wird. */
export interface ParsedForRefresh {
  title: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  description?: string;
  image?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
}

export interface RefreshPlan {
  /** null = es gibt nichts zu ändern */
  patch: Partial<RecipeInput> | null;
  /** Was ergänzt wurde (für die Rückmeldung an den Nutzer) */
  filled: string[];
  /** Was bewusst unangetastet blieb, weil der Nutzer es gesetzt hat */
  kept: string[];
  /** Vom Nutzer gelöschte Einträge, die nicht wieder aufgetaucht sind */
  respectedRemovals: number;
  /** Vom Nutzer angepasste Einträge, die erhalten blieben */
  respectedEdits: number;
  /** Neu erkannte Einträge */
  addedByParser: number;
  userEdited: boolean;
  legacyMerge: boolean;
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Ein eigenes Bild (Upload) darf nicht durch das Seitenbild ersetzt werden. */
function isOwnImage(image?: string): boolean {
  return typeof image === "string" && image.startsWith("local-image:");
}

export function planRefresh(stored: Recipe, parsed: ParsedForRefresh): RefreshPlan {
  const merge = mergeParsedRecipe(
    {
      title: stored.title,
      ingredients: stored.ingredients,
      steps: stored.steps,
      parseSnapshot: stored.parseSnapshot,
    },
    { title: parsed.title, ingredients: parsed.ingredients, steps: parsed.steps },
  );

  const patch: Partial<RecipeInput> = {};
  const filled: string[] = [];
  const kept: string[] = [];

  if (merge.title.trim() && merge.title !== stored.title) {
    patch.title = merge.title;
    filled.push("Titel");
  }
  if (!sameJson(merge.ingredients, stored.ingredients)) {
    patch.ingredients = merge.ingredients;
    if (merge.addedByParser > 0) filled.push("Zutaten");
  }
  if (!sameJson(merge.steps, stored.steps)) {
    patch.steps = merge.steps;
    if (merge.addedByParser > 0) filled.push("Schritte");
  }

  // Beschreibung: hier gibt es keinen Snapshot-Vergleich. Deshalb gilt streng:
  // nur füllen, wenn nichts dasteht. Ein selbst geschriebener Text bleibt.
  if (parsed.description) {
    if (!stored.description || stored.description.trim() === "") {
      patch.description = parsed.description;
      filled.push("Tipps");
    } else if (stored.description.trim() !== parsed.description.trim()) {
      kept.push("Beschreibung");
    }
  }

  if (parsed.servings !== undefined && stored.servings === undefined) {
    patch.servings = parsed.servings;
    filled.push("Portionen");
  }
  if (parsed.prepTime !== undefined && stored.prepTime === undefined) {
    patch.prepTime = parsed.prepTime;
    filled.push("Vorbereitungszeit");
  }
  if (parsed.cookTime !== undefined && stored.cookTime === undefined) {
    patch.cookTime = parsed.cookTime;
    filled.push("Kochzeit");
  }

  if (parsed.image && (!stored.image || (!isOwnImage(stored.image) && stored.image !== parsed.image))) {
    patch.image = parsed.image;
    filled.push("Bild");
  } else if (parsed.image && isOwnImage(stored.image) && stored.image !== parsed.image) {
    kept.push("eigenes Bild");
  }

  // Vergleichsbasis für den nächsten Durchlauf immer auf den neuen Stand bringen
  const snapshot = createParseSnapshot({
    title: parsed.title,
    ingredients: parsed.ingredients,
    steps: parsed.steps,
  });
  if (!sameJson(snapshot, stored.parseSnapshot)) patch.parseSnapshot = snapshot;
  if (stored.parserVersion !== PARSER_VERSION) patch.parserVersion = PARSER_VERSION;

  return {
    patch: Object.keys(patch).length > 0 ? patch : null,
    filled,
    kept,
    respectedRemovals: merge.respectedRemovals,
    respectedEdits: merge.respectedEdits,
    addedByParser: merge.addedByParser,
    userEdited: merge.userEdited,
    legacyMerge: merge.legacyMerge,
  };
}

/** Holt eine Seite über die bestehende Route und übersetzt sie ins App-Format. */
export async function fetchParsedRecipe(url: string): Promise<WebRecipeResponse> {
  const response = await fetch("/api/recipe/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) return { status: "fetch_error" };
  return (await response.json()) as WebRecipeResponse;
}

export interface RefreshOutcome {
  id: string;
  title: string;
  status: "updated" | "unchanged" | "failed";
  /** Über welchen Weg aktualisiert wurde */
  mode: RefreshMode;
  /** Klartext-Grund bei Fehlschlägen (nie technische Fehlermeldungen) */
  reason?: string;
  filled: string[];
  kept: string[];
  respectedEdits: number;
  respectedRemovals: number;
  addedByParser: number;
}

const STATUS_REASON: Record<string, string> = {
  login_required: "nur mit Anmeldung lesbar",
  paywall: "kostenpflichtig",
  blocked: "Seite hat den Abruf abgelehnt",
  not_a_recipe: "kein Rezept auf der Seite gefunden",
  fetch_error: "Seite war nicht erreichbar",
  invalid_url: "Link ist ungültig",
};

export interface RefreshDeps {
  parseUrl: (url: string) => Promise<WebRecipeResponse>;
  update: (id: string, patch: Partial<RecipeInput>) => Promise<unknown>;
  onProgress?: (done: number, total: number, title: string) => void;
  /** Nur für Tests: Standard ist der lokale Parser (`parsedFromCaption`). */
  parseCaption?: (caption: string) => ParsedForRefresh | null;
}

/**
 * Liest die übergebenen Ziele neu ein – je nach Ziel lokal aus der Caption oder
 * über einen Seitenabruf. Nacheinander, damit fremde Server nicht in einem
 * Schwall angefragt werden; die Caption-Ziele laufen zuerst, weil sie nichts
 * kosten. Die Ziele kommen aus `planRefreshTargets`.
 */
export async function refreshRecipes(targets: RefreshTarget[], deps: RefreshDeps): Promise<RefreshOutcome[]> {
  const ordered = [
    ...targets.filter((target) => target.mode === "caption"),
    ...targets.filter((target) => target.mode === "url"),
  ];
  const parseCaption = deps.parseCaption ?? parsedFromCaption;
  const outcomes: RefreshOutcome[] = [];
  let done = 0;

  for (const target of ordered) {
    const { recipe, mode } = target;
    done++;
    deps.onProgress?.(done, ordered.length, recipe.title);
    const empty = (status: RefreshOutcome["status"], reason?: string): RefreshOutcome => ({
      id: recipe.id,
      title: recipe.title,
      status,
      mode,
      reason,
      filled: [],
      kept: [],
      respectedEdits: 0,
      respectedRemovals: 0,
      addedByParser: 0,
    });

    try {
      let parsed: ParsedForRefresh | null;
      if (mode === "caption") {
        parsed = parseCaption(recipe.sourceCaption ?? "");
        if (!parsed) {
          outcomes.push(empty("failed", "Im gespeicherten Text war kein Rezept zu erkennen"));
          continue;
        }
      } else {
        const result = await deps.parseUrl(target.url ?? "");
        if (result.status !== "success" || !result.recipe) {
          outcomes.push(empty("failed", STATUS_REASON[result.status] ?? "Import nicht möglich"));
          continue;
        }
        const web = result.recipe;
        parsed = {
          title: web.title,
          ingredients: web.ingredients,
          steps: web.steps,
          description: web.description,
          image: web.image,
          servings: web.servings,
          prepTime: web.prepTime,
          cookTime: web.cookTime,
        };
      }

      const plan = planRefresh(recipe, parsed);
      if (!plan.patch) {
        outcomes.push({
          ...empty("unchanged"),
          kept: plan.kept,
          respectedEdits: plan.respectedEdits,
          respectedRemovals: plan.respectedRemovals,
        });
        continue;
      }
      await deps.update(recipe.id, plan.patch);
      outcomes.push({
        id: recipe.id,
        title: recipe.title,
        status: "updated",
        mode,
        filled: plan.filled,
        kept: plan.kept,
        respectedEdits: plan.respectedEdits,
        respectedRemovals: plan.respectedRemovals,
        addedByParser: plan.addedByParser,
      });
    } catch {
      outcomes.push(empty("failed", "unerwarteter Fehler beim Aktualisieren"));
    }
  }

  return outcomes;
}

export interface RefreshSummary {
  total: number;
  updated: number;
  unchanged: number;
  failed: number;
  /** Wie oft eigene Änderungen geschützt wurden */
  protectedEdits: number;
  /** Wie oft Tipps ergänzt wurden */
  tipsFilled: number;
  /** Wie viele Rezepte aus der gespeicherten Caption kamen (ohne Netz) */
  fromCaption: number;
  /** Wie viele Rezepte über einen Seitenabruf liefen */
  fromUrl: number;
}

export function summarizeRefresh(outcomes: RefreshOutcome[]): RefreshSummary {
  return {
    total: outcomes.length,
    updated: outcomes.filter((o) => o.status === "updated").length,
    unchanged: outcomes.filter((o) => o.status === "unchanged").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    protectedEdits: outcomes.reduce((sum, o) => sum + o.respectedEdits + o.respectedRemovals, 0),
    tipsFilled: outcomes.filter((o) => o.filled.includes("Tipps")).length,
    fromCaption: outcomes.filter((o) => o.mode === "caption").length,
    fromUrl: outcomes.filter((o) => o.mode === "url").length,
  };
}
