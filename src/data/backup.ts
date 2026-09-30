import type {
  AisleCheckEvent,
  BackupFile,
  Collection,
  CollectionFilter,
  Ingredient,
  MealPlanEntry,
  ParseSnapshot,
  ParsedRecipe,
  ParserCorrection,
  Recipe,
  RecipeStep,
  ShoppingItem,
} from "@/domain/types";
import { getDB } from "./local/db";

const MAX_BACKUP_BYTES = 60 * 1024 * 1024; // 60 MB inkl. Base64-Bilder

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function optString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function optNumber(v: unknown, min = 0): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  if (v < min) return undefined;
  return v;
}

function parseIngredient(v: unknown): Ingredient {
  if (!isRecord(v)) throw new Error("Ungültiges Zutat-Format im Backup.");
  const name = optString(v.name)?.trim();
  if (!name) throw new Error("Zutat ohne Namen im Backup gefunden.");
  if (v.amount !== undefined && (typeof v.amount !== "number" || !Number.isFinite(v.amount) || v.amount < 0)) {
    throw new Error(`Ungültige Menge für Zutat „${name}“ im Backup.`);
  }
  return {
    id: optString(v.id) ?? crypto.randomUUID(),
    amount: optNumber(v.amount, 0),
    unit: optString(v.unit),
    name,
    notes: optString(v.notes),
    uncertain: v.uncertain === true ? true : undefined,
  };
}

function parseStep(v: unknown, order: number): RecipeStep {
  if (!isRecord(v)) throw new Error("Ungültiges Schritt-Format im Backup.");
  const instruction = optString(v.instruction)?.trim();
  if (!instruction) throw new Error("Schritt ohne Anweisung im Backup gefunden.");
  return {
    id: optString(v.id) ?? crypto.randomUUID(),
    order: (typeof v.order === "number" && Number.isFinite(v.order) && v.order > 0) ? v.order : order,
    instruction,
  };
}

function parseStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((entry): entry is string => typeof entry === "string");
}

/**
 * Parse-Snapshot (Grundlage der verlustfreien Parser-Migration). Ist er
 * unbrauchbar, wird er verworfen – das Rezept bleibt gültig, die Migration
 * fällt dann auf den konservativen Weg zurück.
 */
function parseSnapshot(v: unknown): ParseSnapshot | undefined {
  if (!isRecord(v) || !Array.isArray(v.ingredients) || !Array.isArray(v.steps)) return undefined;
  const ingredients = [];
  for (const raw of v.ingredients) {
    if (!isRecord(raw) || typeof raw.name !== "string" || !raw.name.trim()) return undefined;
    ingredients.push({
      name: raw.name,
      amount: optNumber(raw.amount, 0),
      unit: optString(raw.unit),
      notes: optString(raw.notes),
    });
  }
  const steps = v.steps.filter((s): s is string => typeof s === "string");
  return { title: optString(v.title) ?? "", ingredients, steps };
}

function parseRecipe(v: unknown): Recipe {
  if (!isRecord(v)) throw new Error("Ungültiges Rezept-Format im Backup.");
  const title = optString(v.title)?.trim();
  if (!title) throw new Error("Rezept ohne Titel im Backup gefunden.");
  if (!Array.isArray(v.ingredients)) {
    throw new Error(`Rezept „${title}“ hat eine ungültige Zutatenliste.`);
  }
  if (!Array.isArray(v.steps)) {
    throw new Error(`Rezept „${title}“ hat eine ungültige Schrittliste.`);
  }
  if (v.servings !== undefined && (typeof v.servings !== "number" || !Number.isFinite(v.servings) || v.servings <= 0)) {
    throw new Error(`Rezept „${title}“ hat eine ungültige Portionenanzahl.`);
  }
  const now = Date.now();
  return {
    id: optString(v.id) ?? crypto.randomUUID(),
    title,
    description: optString(v.description),
    image: optString(v.image),
    sourceUrl: optString(v.sourceUrl),
    sourceCaption: optString(v.sourceCaption),
    servings: optNumber(v.servings, 1),
    prepTime: optNumber(v.prepTime, 0),
    cookTime: optNumber(v.cookTime, 0),
    ingredients: v.ingredients.map(parseIngredient),
    steps: v.steps.map((s, i) => parseStep(s, i + 1)),
    category: optString(v.category),
    tags: parseStringArray(v.tags),
    color: optString(v.color),
    parserVersion: optNumber(v.parserVersion, 0),
    parseSnapshot: parseSnapshot(v.parseSnapshot),
    favorite: v.favorite === true,
    createdAt: optNumber(v.createdAt, 0) ?? now,
    updatedAt: optNumber(v.updatedAt, 0) ?? now,
  };
}

function parseShoppingItem(v: unknown): ShoppingItem {
  if (!isRecord(v)) throw new Error("Ungültiges Einkaufslisten-Format im Backup.");
  const name = optString(v.name)?.trim();
  if (!name) throw new Error("Einkaufslisten-Eintrag ohne Namen im Backup.");
  if (v.amount !== undefined && (typeof v.amount !== "number" || !Number.isFinite(v.amount) || v.amount < 0)) {
    throw new Error(`Ungültige Menge für Einkaufslisten-Eintrag „${name}“.`);
  }
  return {
    id: optString(v.id) ?? crypto.randomUUID(),
    name,
    amount: optNumber(v.amount, 0),
    unit: optString(v.unit),
    checked: v.checked === true,
    recipeIds: Array.isArray(v.recipeIds)
      ? v.recipeIds.filter((r): r is string => typeof r === "string")
      : [],
    createdAt: optNumber(v.createdAt, 0) ?? Date.now(),
  };
}

export interface ParsedBackup {
  recipes: Recipe[];
  images: { id: string; mime: string; dataBase64: string }[];
  shopping: ShoppingItem[];
  /** Ab Backup-Version 2; bei älteren Dateien leer */
  mealPlan: MealPlanEntry[];
  corrections: ParserCorrection[];
  aisleOrder: AisleCheckEvent[];
  /** Ab Backup-Version 3; bei älteren Dateien leer */
  collections: Collection[];
  /**
   * Nicht-fatale Probleme (z. B. Bildverweis ohne zugehöriges Bild). Wird dem
   * Nutzer angezeigt, statt still kaputte Rezepte zu erzeugen.
   */
  warnings: string[];
}

export interface ImportResult {
  addedRecipes: number;
  skippedRecipes: number;
  addedShoppingItems: number;
  skippedShoppingItems: number;
  addedMealPlanEntries: number;
  addedCorrections: number;
  addedAisleOrderEntries: number;
  addedCollections: number;
  /** Verwaiste Bild-Blobs, die beim Import aufgeräumt wurden */
  removedOrphanImages: number;
  warnings: string[];
}

export async function importBackup(
  backup: ParsedBackup,
  mode: "skip" | "replace",
): Promise<ImportResult> {
  const db = getDB();
  return db.transaction(
    "rw",
    [db.recipes, db.images, db.shopping, db.mealPlan, db.corrections, db.aisleOrder, db.collections],
    async () => {
    const existingRecipeIds = new Set(
      (await db.recipes.toArray()).map((recipe) => recipe.id),
    );
    const existingShoppingIds = new Set(
      (await db.shopping.toArray()).map((item) => item.id),
    );

    const recipesToWrite = backup.recipes.filter(
      (recipe) => mode === "replace" || !existingRecipeIds.has(recipe.id),
    );

    // Bild-Kollisionsschutz für Modus "skip":
    // Wenn Modus "skip" ist und ein neues Rezept importiert wird, dessen Bild-ID
    // bereits in db.images existiert (z. B. von einem anderen existierenden Rezept),
    // darf das existierende Bild NICHT überschrieben werden!
    // Stattdessen weisen wir dem neuen Rezept eine neue Bild-ID zu.
    const existingImages = await db.images.toArray();
    const existingImageMap = new Map(existingImages.map((img) => [img.id, img]));

    const imageMap = new Map(backup.images.map((img) => [img.id, img]));
    const imagesToWrite: { id: string; blob: Blob; mime: string; createdAt: number }[] = [];

    const finalRecipesToWrite = recipesToWrite.map((r) => {
      if (!r.image?.startsWith("local-image:")) return r;
      const originalImageId = r.image.slice("local-image:".length);
      const backupImg = imageMap.get(originalImageId);
      if (!backupImg) return r;

      if (mode === "skip" && existingImageMap.has(originalImageId)) {
        // Kollision! Vergib eine neue ID für das neue Rezept
        const newImageId = crypto.randomUUID();
        imagesToWrite.push({
          id: newImageId,
          blob: base64ToBlob(backupImg.dataBase64, backupImg.mime),
          mime: backupImg.mime,
          createdAt: Date.now(),
        });
        return { ...r, image: `local-image:${newImageId}` };
      }

      // Normaler Fall (keine Kollision oder mode === 'replace')
      imagesToWrite.push({
        id: originalImageId,
        blob: base64ToBlob(backupImg.dataBase64, backupImg.mime),
        mime: backupImg.mime,
        createdAt: Date.now(),
      });
      return r;
    });

    const shoppingToWrite = backup.shopping.filter(
      (item) => mode === "replace" || !existingShoppingIds.has(item.id),
    );

    // Wochenplan, Korrektur-Log und Aisle-Reihenfolge: gleiche Semantik wie bei
    // Rezepten – "skip" ergänzt nur Unbekanntes, "replace" überschreibt
    // vorhandene Einträge. Es wird nie etwas gelöscht, das nicht im Backup steht.
    const existingMealPlanIds = new Set((await db.mealPlan.toArray()).map((entry) => entry.id));
    const mealPlanToWrite = backup.mealPlan.filter(
      (entry) => mode === "replace" || !existingMealPlanIds.has(entry.id),
    );
    const existingCorrectionIds = new Set((await db.corrections.toArray()).map((entry) => entry.id));
    const correctionsToWrite = backup.corrections.filter(
      (entry) => mode === "replace" || !existingCorrectionIds.has(entry.id),
    );
    const existingAisleIds = new Set((await db.aisleOrder.toArray()).map((entry) => entry.id));
    const aisleToWrite = backup.aisleOrder.filter(
      (entry) => mode === "replace" || !existingAisleIds.has(entry.id),
    );
    const existingCollectionIds = new Set((await db.collections.toArray()).map((entry) => entry.id));
    const collectionsToWrite = backup.collections.filter(
      (entry) => mode === "replace" || !existingCollectionIds.has(entry.id),
    );

    await db.images.bulkPut(imagesToWrite);
    await db.recipes.bulkPut(finalRecipesToWrite);
    await db.shopping.bulkPut(shoppingToWrite);
    await db.mealPlan.bulkPut(mealPlanToWrite);
    await db.corrections.bulkPut(correctionsToWrite);
    await db.aisleOrder.bulkPut(aisleToWrite);
    await db.collections.bulkPut(collectionsToWrite);

    // Bild-Aufräumen: Blobs löschen, auf die kein Rezept (mehr) verweist. Ohne
    // das wächst die Datenbank bei jedem Re-Import bis zum Quota-Fehler.
    const referencedImageIds = new Set(
      (await db.recipes.toArray())
        .map((recipe) => recipe.image)
        .filter((ref): ref is string => typeof ref === "string" && ref.startsWith("local-image:"))
        .map((ref) => ref.slice("local-image:".length)),
    );
    const orphanImageIds = (await db.images.toArray())
      .map((img) => img.id)
      .filter((id) => !referencedImageIds.has(id));
    if (orphanImageIds.length > 0) {
      await db.images.bulkDelete(orphanImageIds);
    }

    return {
      addedRecipes: finalRecipesToWrite.length,
      skippedRecipes: backup.recipes.length - finalRecipesToWrite.length,
      addedShoppingItems: shoppingToWrite.length,
      skippedShoppingItems: backup.shopping.length - shoppingToWrite.length,
      addedMealPlanEntries: mealPlanToWrite.length,
      addedCorrections: correctionsToWrite.length,
      addedAisleOrderEntries: aisleToWrite.length,
      addedCollections: collectionsToWrite.length,
      removedOrphanImages: orphanImageIds.length,
      warnings: backup.warnings,
    };
  });
}

const DAYS_OF_WEEK = ["mo", "tu", "we", "th", "fr", "sa", "su"];

function parseMealPlanEntry(v: unknown): MealPlanEntry | null {
  if (!isRecord(v)) return null;
  const id = optString(v.id);
  const recipeId = optString(v.recipeId);
  const day = optString(v.dayOfWeek);
  if (!id || !recipeId || !day || !DAYS_OF_WEEK.includes(day)) return null;
  return {
    id,
    dayOfWeek: day as MealPlanEntry["dayOfWeek"],
    recipeId,
    servings: optNumber(v.servings, 0) ?? 1,
  };
}

function parseAisleCheckEvent(v: unknown): AisleCheckEvent | null {
  if (!isRecord(v)) return null;
  const id = optString(v.id);
  const aisle = optString(v.aisle);
  if (!id || !aisle) return null;
  return {
    id,
    aisle,
    position: optNumber(v.position, 0) ?? 0,
    timestamp: optNumber(v.timestamp, 0) ?? Date.now(),
  };
}

function parseParsedRecipeSnapshot(v: unknown): ParsedRecipe | null {
  if (!isRecord(v) || typeof v.title !== "string" || !Array.isArray(v.ingredients) || !Array.isArray(v.steps)) {
    return null;
  }
  return {
    title: v.title,
    servings: optNumber(v.servings, 0),
    prepTime: optNumber(v.prepTime, 0),
    cookTime: optNumber(v.cookTime, 0),
    ingredients: v.ingredients.map(parseIngredient),
    steps: v.steps.map((s, i) => parseStep(s, i + 1)),
    tags: parseStringArray(v.tags),
  };
}

/**
 * Filter einer Sammlung: nur bekannte Regeln übernehmen, unbekannte Felder
 * fallen weg – so bleibt der Import auch bei künftigen Formaten robust.
 */
function parseCollectionFilter(v: unknown): CollectionFilter | undefined {
  if (!isRecord(v)) return undefined;
  const filter: CollectionFilter = {
    categories: parseStringArray(v.categories),
    category: optString(v.category),
    tags: parseStringArray(v.tags),
    maxTotalTime: optNumber(v.maxTotalTime, 1),
    favoritesOnly: v.favoritesOnly === true ? true : undefined,
    titleContains: optString(v.titleContains),
    ingredientContains: optString(v.ingredientContains),
    query: optString(v.query),
  };
  const hasAny =
    (filter.categories && filter.categories.length > 0) ||
    filter.category ||
    (filter.tags && filter.tags.length > 0) ||
    filter.maxTotalTime !== undefined ||
    filter.favoritesOnly ||
    filter.titleContains ||
    filter.ingredientContains ||
    filter.query;
  return hasAny ? filter : undefined;
}

function parseCollection(v: unknown): Collection | null {
  if (!isRecord(v)) return null;
  const id = optString(v.id);
  const name = optString(v.name)?.trim();
  if (!id || !name) return null;
  const now = Date.now();
  return {
    id,
    name,
    emoji: optString(v.emoji),
    order: optNumber(v.order, 0) ?? 0,
    filter: parseCollectionFilter(v.filter),
    recipeIds: parseStringArray(v.recipeIds),
    createdAt: optNumber(v.createdAt, 0) ?? now,
    updatedAt: optNumber(v.updatedAt, 0) ?? now,
  };
}

function parseCorrection(v: unknown): ParserCorrection | null {
  if (!isRecord(v)) return null;
  const id = optString(v.id);
  const sourceCaption = optString(v.sourceCaption);
  if (!id || !sourceCaption) return null;
  const parsed = parseParsedRecipeSnapshot(v.parsed);
  const corrected = parseParsedRecipeSnapshot(v.corrected);
  if (!parsed || !corrected) return null;
  return {
    id,
    createdAt: optNumber(v.createdAt, 0) ?? Date.now(),
    sourceUrl: optString(v.sourceUrl),
    sourceCaption,
    parsed,
    corrected,
  };
}

/**
 * Zusatzsammlungen sind Ergänzungsdaten: eine einzelne kaputte Zeile darf keine
 * vollständige Wiederherstellung verhindern. Sie wird übersprungen und gemeldet.
 */
function collectEntries<T>(
  raw: unknown,
  parse: (v: unknown) => T | null,
  label: string,
  warnings: string[],
): T[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    warnings.push(`${label} im Backup sind unlesbar und wurden übersprungen.`);
    return [];
  }
  const out: T[] = [];
  let skipped = 0;
  for (const entry of raw) {
    try {
      const parsed = parse(entry);
      if (parsed) out.push(parsed);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  if (skipped > 0) {
    warnings.push(`${skipped} von ${raw.length} ${label} waren unvollständig und wurden übersprungen.`);
  }
  return out;
}

export function parseBackup(json: string): ParsedBackup {
  if (json.length > MAX_BACKUP_BYTES) {
    throw new Error("Die Datei ist zu groß für ein Backup.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Die Datei ist keine gültige JSON-Datei.");
  }
  if (!isRecord(raw) || raw.app !== "rezept" || (raw.version !== 1 && raw.version !== 2 && raw.version !== 3)) {
    throw new Error("Das ist keine gültige Rezept-Backup-Datei.");
  }
  if (!Array.isArray(raw.recipes)) {
    throw new Error("Die Backup-Datei enthält keine Rezepte.");
  }
  const recipes = raw.recipes.map(parseRecipe);
  const rawImages = Array.isArray(raw.images) ? raw.images : [];
  for (const img of rawImages) {
    if (!isRecord(img) || typeof img.id !== "string" || typeof img.mime !== "string" || typeof img.dataBase64 !== "string") {
      throw new Error("Ungültiges Bild-Format im Backup.");
    }
    if (!img.mime.startsWith("image/")) {
      throw new Error("Nicht unterstützter Bild-MIME-Typ im Backup.");
    }
  }
  const images = rawImages as { id: string; mime: string; dataBase64: string }[];
  const rawShopping = Array.isArray(raw.shopping) ? raw.shopping : [];
  const shopping = rawShopping.map(parseShoppingItem);

  const warnings: string[] = [];

  // Bildverweise prüfen: fehlt der Blob, bleibt nur der Platzhalter – das soll
  // der Nutzer wissen, statt es später zu bemerken.
  const imageIds = new Set(images.map((img) => img.id));
  const missingImages = recipes.filter(
    (recipe) => recipe.image?.startsWith("local-image:") && !imageIds.has(recipe.image.slice("local-image:".length)),
  );
  if (missingImages.length > 0) {
    warnings.push(
      `Für ${missingImages.length} Rezept(e) fehlt das Bild in der Backup-Datei – dort erscheint später der Platzhalter.`,
    );
  }

  return {
    recipes,
    images,
    shopping,
    mealPlan: collectEntries(raw.mealPlan, parseMealPlanEntry, "Wochenplan-Einträge", warnings),
    corrections: collectEntries(raw.corrections, parseCorrection, "Korrektur-Einträge", warnings),
    aisleOrder: collectEntries(raw.aisleOrder, parseAisleCheckEvent, "Aisle-Einträge", warnings),
    collections: collectEntries(raw.collections, parseCollection, "Sammlungen", warnings),
    warnings,
  };
}

export async function buildBackup(): Promise<BackupFile> {
  const db = getDB();
  const [recipes, images, shopping, mealPlan, corrections, aisleOrder, collections] =
    await Promise.all([
      db.recipes.toArray(),
      db.images.toArray(),
      db.shopping.toArray(),
      db.mealPlan.toArray(),
      db.corrections.toArray(),
      db.aisleOrder.toArray(),
      db.collections.toArray(),
    ]);
  const encoded = await Promise.all(
    images.map(async (img) => ({
      id: img.id,
      mime: img.mime,
      dataBase64: await blobToBase64(img.blob),
    })),
  );
  return {
    app: "rezept",
    version: 3,
    exportedAt: Date.now(),
    recipes,
    images: encoded,
    shopping,
    mealPlan,
    corrections,
    aisleOrder,
    collections,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(dataBase64: string, mime: string): Blob {
  const bin = atob(dataBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
