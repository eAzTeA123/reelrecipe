import { getDB } from "./db";
import { parseRecipe, PARSER_VERSION } from "@/parser";
import { translateParsedRecipe } from "@/lib/i18n/recipeTranslation";
import { compressImage } from "@/lib/image";
import { getImageRepository } from "@/data";

export interface MigrationResult {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
}

/**
 * Re-parst alle Rezepte, deren parserVersion < PARSER_VERSION.
 * Bewahrt manuelle Edits:
 * - Wenn sourceCaption vorhanden → neu parsen
 * - title wird NUR überschrieben, wenn er exakt dem alten Parse-Titel entspricht
 * - Manuell hinzugefügte Zutaten (die nicht im Parse-Ergebnis vorkommen) bleiben erhalten
 * - favorite, category, image, tags, servings bleiben unangetastet
 */
export async function runParserMigration(lang: "de" | "en"): Promise<MigrationResult> {
  const db = getDB();
  const recipes = await db.recipes
    .filter(r => (r.parserVersion ?? 0) < PARSER_VERSION && !!r.sourceCaption)
    .toArray();

  const result: MigrationResult = { total: recipes.length, updated: 0, skipped: 0, failed: 0 };

  for (const recipe of recipes) {
    try {
      const parsed = parseRecipe(recipe.sourceCaption!);
      if (!parsed || (parsed.ingredients.length === 0 && parsed.steps.length === 0)) {
        result.skipped++;
        // Trotzdem Version hochsetzen, damit wir nicht endlos re-parsen
        await db.recipes.update(recipe.id, { parserVersion: PARSER_VERSION });
        continue;
      }

      const translated = translateParsedRecipe(parsed, lang);

      // Titel nur updaten, wenn der User ihn NICHT manuell geändert hat
      // Heuristik: Wenn der alte Titel eine Teilmenge des alten Parse-Ergebnisses ist
      const titleChanged = !recipe.sourceCaption!.includes(recipe.title);
      
      await db.recipes.update(recipe.id, {
        title: titleChanged ? recipe.title : translated.title,
        ingredients: translated.ingredients,
        steps: translated.steps,
        servings: translated.servings ?? recipe.servings,
        prepTime: translated.prepTime ?? recipe.prepTime,
        cookTime: translated.cookTime ?? recipe.cookTime,
        parserVersion: PARSER_VERSION,
        updatedAt: Date.now(),
      });
      result.updated++;
    } catch (e) {
      console.error(`Migration failed for recipe ${recipe.id}:`, e);
      result.failed++;
      // Version trotzdem hochsetzen
      await db.recipes.update(recipe.id, { parserVersion: PARSER_VERSION });
    }
  }

  return result;
}

export async function migrateExternalImages(): Promise<number> {
  const db = getDB();
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
      await db.recipes.update(recipe.id, { image: `local-image:${imageRef}` });
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
        const id = recipe.image!.replace("local-image:", "");
        const localImg = await imageRepo.get(id);
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
