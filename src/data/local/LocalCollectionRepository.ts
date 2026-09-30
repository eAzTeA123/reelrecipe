import type { CollectionRepository } from "../repositories";
import type { Collection } from "@/domain/types";
import { getDB } from "./db";
import { newId } from "@/lib/text";

export const MAX_COLLECTIONS = 50;
export const MAX_COLLECTION_MEMBERS = 500;

/**
 * Sammlungen (Ordner) lokal in IndexedDB.
 *
 * Die Mitgliedschaft liegt in der Sammlung (`recipeIds`), nicht am Rezept:
 * dadurch bleibt `Recipe` unverändert und es braucht keine Rezept-Migration.
 */
export class LocalCollectionRepository implements CollectionRepository {
  private db = getDB();

  async list(): Promise<Collection[]> {
    const all = await this.db.collections.toArray();
    return all.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  }

  async create(input: {
    name: string;
    emoji?: string;
    filter?: Collection["filter"];
  }): Promise<Collection> {
    const existing = await this.db.collections.toArray();
    if (existing.length >= MAX_COLLECTIONS) {
      throw new Error(`Mehr als ${MAX_COLLECTIONS} Sammlungen sind nicht vorgesehen.`);
    }
    const now = Date.now();
    const collection: Collection = {
      id: newId(),
      name: input.name.trim().slice(0, 40) || "Neue Sammlung",
      emoji: input.emoji,
      order: existing.length,
      filter: input.filter,
      recipeIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.db.collections.add(collection);
    return collection;
  }

  async rename(id: string, name: string): Promise<void> {
    await this.update(id, { name });
  }

  async update(
    id: string,
    patch: Partial<Pick<Collection, "name" | "emoji" | "filter" | "recipeIds">>,
  ): Promise<void> {
    const clean: Partial<Collection> = { ...patch, updatedAt: Date.now() };
    if (typeof clean.name === "string") {
      clean.name = clean.name.trim().slice(0, 40) || "Neue Sammlung";
    }
    await this.db.collections.update(id, clean);
  }

  async addRecipes(id: string, recipeIds: string[]): Promise<void> {
    const collection = await this.db.collections.get(id);
    if (!collection) return;
    const current = collection.recipeIds ?? [];
    const merged = [...new Set([...current, ...recipeIds])].slice(0, MAX_COLLECTION_MEMBERS);
    await this.update(id, { recipeIds: merged });
  }

  async removeRecipe(id: string, recipeId: string): Promise<void> {
    const collection = await this.db.collections.get(id);
    if (!collection) return;
    await this.update(id, {
      recipeIds: (collection.recipeIds ?? []).filter((entry) => entry !== recipeId),
    });
  }

  /** Reihenfolge anhand der übergebenen ID-Liste neu setzen (Rest hinten angehängt). */
  async setOrder(idsInOrder: string[]): Promise<void> {
    const all = await this.db.collections.toArray();
    const known = new Set(all.map((entry) => entry.id));
    const ordered = idsInOrder.filter((id) => known.has(id));
    const rest = all
      .map((entry) => entry.id)
      .filter((id) => !ordered.includes(id))
      .sort((a, b) => {
        const ca = all.find((entry) => entry.id === a);
        const cb = all.find((entry) => entry.id === b);
        return (ca?.order ?? 0) - (cb?.order ?? 0);
      });
    const now = Date.now();
    await Promise.all(
      [...ordered, ...rest].map((id, index) =>
        this.db.collections.update(id, { order: index, updatedAt: now }),
      ),
    );
  }

  /** Löscht nur die Sammlung – Rezepte bleiben selbstverständlich erhalten. */
  async delete(id: string): Promise<void> {
    await this.db.collections.delete(id);
  }
}
