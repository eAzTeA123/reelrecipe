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
  const updates: any[] = [];

  for (const recipe of recipes) {
    try {
      const parsed = parseRecipe(recipe.sourceCaption!);
      if (!parsed || (parsed.ingredients.length === 0 && parsed.steps.length === 0)) {
        result.skipped++;
        updates.push({ ...recipe, parserVersion: PARSER_VERSION });
        continue;
      }

      const translated = translateParsedRecipe(parsed, lang);

      // Heuristic: If title doesn't match original sourceCaption, user probably edited it
      const titleChanged = !recipe.sourceCaption!.includes(recipe.title);
      
      // Preserve manual ingredients
      const mergedIngredients = translated.ingredients.map((newIng, i) => {
        // Find existing by name similarity or position
        const existing = recipe.ingredients.find(e => e.name === newIng.name) || recipe.ingredients[i];
        if (existing) {
          // Keep the ID, and if user removed the uncertain flag, keep it removed
          return { ...newIng, id: existing.id, uncertain: existing.uncertain === false ? false : newIng.uncertain };
        }
        return newIng;
      });

      // Append ingredients that the user added manually (those that don't match any in the new parsed list by ID)
      const userAddedIngs = recipe.ingredients.filter(oldIng => !mergedIngredients.some(m => m.id === oldIng.id));
      mergedIngredients.push(...userAddedIngs);

      // Preserve manual steps
      const mergedSteps = translated.steps.map((newStep, i) => {
        const existing = recipe.steps[i];
        return existing ? { ...newStep, id: existing.id } : newStep;
      });
      const userAddedSteps = recipe.steps.slice(translated.steps.length);
      mergedSteps.push(...userAddedSteps);

      updates.push({
        ...recipe,
        title: titleChanged ? recipe.title : translated.title,
        ingredients: mergedIngredients,
        steps: mergedSteps,
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
      updates.push({ ...recipe, parserVersion: PARSER_VERSION });
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
