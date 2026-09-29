import type { Recipe } from "@/domain/types";
import { getDB } from "./db";
import { parseRecipe, PARSER_VERSION } from "@/parser";
import { translateParsedRecipe } from "@/lib/i18n/recipeTranslation";
import { mergeParsedRecipe } from "./parseMerge";
import { compressImage } from "@/lib/image";
import { getImageRepository } from "@/data";

export interface MigrationResult {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  /** Vom Nutzer gelöschte Einträge, die nicht wieder aufgetaucht sind */
  respectedRemovals: number;
  /** Vom Nutzer angepasste Einträge, die erhalten blieben */
  respectedEdits: number;
  /** Rezepte ohne Snapshot (Altbestand) – dort wird konservativ gemergt */
  legacyMerges: number;
}

/**
 * Re-parst alle Rezepte, deren parserVersion < PARSER_VERSION.
 * Der Merge (parseMerge.ts) bewahrt Nutzeränderungen:
 * - gelöschte Zutaten/Schritte kommen NICHT zurück
 * - umbenannte Zutaten werden nicht doppelt angelegt
 * - angepasste Mengen/Notizen und selbst ergänzte Einträge bleiben
 * - ein selbst gesetzter Titel wird nicht überschrieben
 * - favorite, category, image, tags bleiben unangetastet
 */
export async function runParserMigration(lang: "de" | "en"): Promise<MigrationResult> {
  const db = getDB();
  const recipes = await db.recipes
    .filter(r => (r.parserVersion ?? 0) < PARSER_VERSION && !!r.sourceCaption)
    .toArray();

  const result: MigrationResult = {
    total: recipes.length,
    updated: 0,
    skipped: 0,
    failed: 0,
    respectedRemovals: 0,
    respectedEdits: 0,
    legacyMerges: 0,
  };
  const updates: Recipe[] = [];

  for (const recipe of recipes) {
    try {
      const parsed = parseRecipe(recipe.sourceCaption!);
      if (!parsed || (parsed.ingredients.length === 0 && parsed.steps.length === 0)) {
        // Kein brauchbares Ergebnis: Version bewusst NICHT stempeln, damit eine
        // spätere Parser-Version es erneut versuchen kann (Kosten: ein Parse je Start).
        result.skipped++;
        continue;
      }

      const translated = translateParsedRecipe(parsed, lang);
      const merged = mergeParsedRecipe(
        {
          title: recipe.title,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          parseSnapshot: recipe.parseSnapshot,
        },
        {
          title: translated.title,
          ingredients: translated.ingredients,
          steps: translated.steps,
        },
      );

      result.respectedRemovals += merged.respectedRemovals;
      result.respectedEdits += merged.respectedEdits;
      if (merged.legacyMerge) result.legacyMerges++;

      updates.push({
        ...recipe,
        title: merged.title,
        ingredients: merged.ingredients,
        steps: merged.steps,
        servings: translated.servings ?? recipe.servings,
        prepTime: translated.prepTime ?? recipe.prepTime,
        cookTime: translated.cookTime ?? recipe.cookTime,
        parserVersion: PARSER_VERSION,
        updatedAt: Date.now(),
      });
      result.updated++;
    } catch (e) {
      // Fehler (z. B. Quota oder transienter IndexedDB-Fehler): Version NICHT
      // stempeln, sonst bleibt das Rezept dauerhaft unmigriert. Beim nächsten
      // Start wird es erneut versucht und der Fehler dem Nutzer gemeldet.
      console.error(`Migration failed for recipe ${recipe.id}:`, e);
      result.failed++;
    }
  }

  if (updates.length > 0) {
    await db.recipes.bulkPut(updates);
  }

  return result;
}

export async function migrateExternalImages(): Promise<number> {
  const db = getDB();

  // Fix broken prefixes first
  const brokenImages = await db.recipes.filter(r => !!r.image && r.image.startsWith("local-image:local-image:")).toArray();
  for (const recipe of brokenImages) {
    await db.recipes.update(recipe.id, { image: recipe.image!.replace("local-image:local-image:", "local-image:") });
  }

  const recipes = await db.recipes
    .filter(r => !!r.image && !r.image.startsWith("local-image:") && r.image.startsWith("http"))
    .toArray();
  
  let cached = 0;
  for (const recipe of recipes) {
    try {
      const res = await fetch(`/api/instagram/image?url=${encodeURIComponent(recipe.image!)}`);
      if (!res.ok) continue;
      const blob = await compressImage(await res.blob());
      const imageRef = await getImageRepository().save(blob);
      await db.recipes.update(recipe.id, { image: imageRef });
      cached++;
    } catch { /* skip, retry next time */ }
  }
  return cached;
}

import { extractDominantColor } from "@/lib/color";

export async function backfillColors(): Promise<number> {
  const db = getDB();
  const recipes = await db.recipes.filter(r => !r.color && !!r.image).toArray();
  const imageRepo = getImageRepository();
  
  let updated = 0;
  for (const recipe of recipes) {
    try {
      let blob: Blob | undefined;
      if (recipe.image!.startsWith("local-image:")) {
        const localImg = await imageRepo.get(recipe.image!);
        if (localImg) blob = localImg.blob;
      } else {
        const res = await fetch(`/api/instagram/image?url=${encodeURIComponent(recipe.image!)}`);
        if (res.ok) blob = await res.blob();
      }
      
      if (blob) {
        const color = await extractDominantColor(blob);
        if (color) {
          await db.recipes.update(recipe.id, { color });
          updated++;
        }
      }
    } catch { /* skip */ }
  }
  return updated;
}

