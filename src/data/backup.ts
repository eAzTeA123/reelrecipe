import type {
  BackupFile,
  Ingredient,
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
}

export interface ImportResult {
  addedRecipes: number;
  skippedRecipes: number;
  addedShoppingItems: number;
  skippedShoppingItems: number;
}

export async function importBackup(
  backup: ParsedBackup,
  mode: "skip" | "replace",
): Promise<ImportResult> {
  const db = getDB();
  return db.transaction("rw", db.recipes, db.images, db.shopping, async () => {
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

    await db.images.bulkPut(imagesToWrite);
    await db.recipes.bulkPut(finalRecipesToWrite);
    await db.shopping.bulkPut(shoppingToWrite);

    return {
      addedRecipes: finalRecipesToWrite.length,
      skippedRecipes: backup.recipes.length - finalRecipesToWrite.length,
      addedShoppingItems: shoppingToWrite.length,
      skippedShoppingItems: backup.shopping.length - shoppingToWrite.length,
    };
  });
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
  if (!isRecord(raw) || raw.app !== "rezept" || raw.version !== 1) {
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
  return { recipes, images, shopping };
}

export async function buildBackup(): Promise<BackupFile> {
  const db = getDB();
  const [recipes, images, shopping] = await Promise.all([
    db.recipes.toArray(),
    db.images.toArray(),
    db.shopping.toArray(),
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
    version: 1,
    exportedAt: Date.now(),
    recipes,
    images: encoded,
    shopping,
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
