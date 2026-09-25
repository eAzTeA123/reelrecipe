import { liveQuery } from "dexie";
import type { Recipe, RecipeInput } from "@/domain/types";
import type { RecipeRepository, SearchFilter } from "../repositories";
import { getDB } from "./db";
import { newId, normalizeForSearch } from "@/lib/text";

function applyFilter(recipes: Recipe[], filter?: SearchFilter): Recipe[] {
  if (!filter) return recipes;
  let out = recipes;
  if (filter.favoritesOnly) out = out.filter((r) => r.favorite);
  if (filter.category) out = out.filter((r) => r.category === filter.category);
  const q = filter.query?.trim();
  if (q) {
    const nq = normalizeForSearch(q);
    out = out.filter(
      (r) =>
        normalizeForSearch(r.title).includes(nq) ||
        r.ingredients.some((i) => normalizeForSearch(i.name).includes(nq)),
    );
  }
  return out;
}

function sortByCreatedDesc(recipes: Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) => b.createdAt - a.createdAt);
}

export class LocalRecipeRepository implements RecipeRepository {
  private db = getDB();

  async list(filter?: SearchFilter): Promise<Recipe[]> {
    const all = await this.db.recipes.toArray();
    return sortByCreatedDesc(applyFilter(all, filter));
  }

  async get(id: string): Promise<Recipe | undefined> {
    return this.db.recipes.get(id);
  }

  async create(input: RecipeInput): Promise<Recipe> {
    const now = Date.now();
    const recipe: Recipe = { ...input, id: newId(), createdAt: now, updatedAt: now };
    await this.db.recipes.add(recipe);
    return recipe;
  }

  async update(id: string, patch: Partial<RecipeInput>): Promise<Recipe> {
    await this.db.recipes.update(id, { ...patch, updatedAt: Date.now() });
    const updated = await this.db.recipes.get(id);
    if (!updated) throw new Error("Recipe not found");
    return updated;
  }

  async saveWithImage(
    id: string | undefined,
    input: RecipeInput,
    pendingImage?: Blob,
    previousImageRef?: string,
  ): Promise<Recipe> {
    const now = Date.now();
    return this.db.transaction("rw", this.db.recipes, this.db.images, async () => {
      let imageRef = input.image;
      if (pendingImage) {
        const imageId = newId();
        await this.db.images.add({
          id: imageId,
          blob: pendingImage,
          mime: pendingImage.type || "image/jpeg",
          createdAt: now,
        });
        imageRef = `local-image:${imageId}`;
      }

      let saved: Recipe;
      if (id) {
        const count = await this.db.recipes.update(id, {
          ...input,
          image: imageRef,
          updatedAt: now,
        });
        if (count === 0) throw new Error("Recipe not found");
        saved = (await this.db.recipes.get(id))!;
      } else {
        saved = { ...input, image: imageRef, id: newId(), createdAt: now, updatedAt: now };
        await this.db.recipes.add(saved);
      }

      if (
        previousImageRef?.startsWith("local-image:") &&
        previousImageRef !== imageRef
      ) {
        // Prüfen, ob noch ein anderes Rezept das alte Bild referenziert
        const otherCount = await this.db.recipes
          .filter((r) => r.id !== id && r.image === previousImageRef)
          .count();
        if (otherCount === 0) {
          await this.db.images.delete(previousImageRef.slice("local-image:".length));
        }
      }
      return saved;
    });
  }

  async delete(id: string): Promise<void> {
    const recipe = await this.db.recipes.get(id);
    await this.db.transaction("rw", this.db.recipes, this.db.images, this.db.shopping, async () => {
      await this.db.recipes.delete(id);

      // Bild nur löschen, wenn kein anderes Rezept dasselbe Bild referenziert!
      if (recipe?.image?.startsWith("local-image:")) {
        const otherRecipesWithSameImage = await this.db.recipes
          .filter((r) => r.id !== id && r.image === recipe.image)
          .count();
        if (otherRecipesWithSameImage === 0) {
          await this.db.images.delete(recipe.image.slice("local-image:".length));
        }
      }

      // Herkunftsverweis aus der Einkaufsliste entfernen, aber die Einkaufsliste und ihre Mengen ERHALTEN!
      const items = await this.db.shopping.toArray();
      for (const item of items) {
        if (item.recipeIds.includes(id)) {
          const recipeIds = item.recipeIds.filter((r) => r !== id);
          await this.db.shopping.update(item.id, { recipeIds });
        }
      }
    });
  }

  async duplicate(id: string): Promise<Recipe> {
    return this.db.transaction("rw", this.db.recipes, this.db.images, async () => {
      const source = await this.db.recipes.get(id);
      if (!source) throw new Error("Recipe not found");
      const now = Date.now();
      let image: string | undefined;
      if (source.image?.startsWith("local-image:")) {
        const sourceImage = await this.db.images.get(
          source.image.slice("local-image:".length),
        );
        if (sourceImage) {
          const imageId = newId();
          await this.db.images.add({
            id: imageId,
            blob: sourceImage.blob,
            mime: sourceImage.mime,
            createdAt: now,
          });
          image = `local-image:${imageId}`;
        }
      } else {
        image = source.image;
      }
      const copy: Recipe = {
        ...source,
        id: newId(),
        title: `${source.title} (Kopie)`,
        image,
        favorite: false,
        createdAt: now,
        updatedAt: now,
      };
      await this.db.recipes.add(copy);
      return copy;
    });
  }

  async toggleFavorite(id: string): Promise<void> {
    const recipe = await this.db.recipes.get(id);
    if (!recipe) return;
    await this.db.recipes.update(id, { favorite: !recipe.favorite, updatedAt: Date.now() });
  }

  subscribe(
    filter: SearchFilter | undefined,
    onChange: (recipes: Recipe[]) => void,
    onError?: (error: unknown) => void,
  ): () => void {
    const sub = liveQuery(() => this.db.recipes.toArray()).subscribe({
      next: (all) => onChange(sortByCreatedDesc(applyFilter(all, filter))),
      error: (err) => {
        console.error("recipe subscription failed", err);
        onError?.(err);
      },
    });
    return () => sub.unsubscribe();
  }

  async importRecipes(recipes: Recipe[], mode: "skip" | "replace"): Promise<{ added: number; skipped: number }> {
    let added = 0;
    let skipped = 0;
    await this.db.transaction("rw", this.db.recipes, async () => {
      for (const r of recipes) {
        const exists = await this.db.recipes.get(r.id);
        if (exists && mode === "skip") {
          skipped++;
          continue;
        }
        await this.db.recipes.put(r);
        added++;
      }
    });
    return { added, skipped };
  }

  async clearAll(): Promise<void> {
    await this.db.transaction("rw", this.db.recipes, this.db.images, this.db.shopping, async () => {
      await this.db.recipes.clear();
      await this.db.images.clear();
      await this.db.shopping.clear();
    });
  }
}
