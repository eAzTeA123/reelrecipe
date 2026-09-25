import { liveQuery } from "dexie";
import type { ShoppingItem } from "@/domain/types";
import type { ShoppingListRepository } from "../repositories";
import { getDB } from "./db";
import { newId } from "@/lib/text";
import { mergeIntoList } from "@/lib/shoppingMerge";

export class LocalShoppingListRepository implements ShoppingListRepository {
  private db = getDB();

  async list(): Promise<ShoppingItem[]> {
    const items = await this.db.shopping.toArray();
    return items.sort((a, b) => Number(a.checked) - Number(b.checked) || a.createdAt - b.createdAt);
  }

  subscribe(
    onChange: (items: ShoppingItem[]) => void,
    onError?: (error: unknown) => void,
  ): () => void {
    const sub = liveQuery(() => this.list()).subscribe({
      next: onChange,
      error: (err) => {
        console.error("shopping subscription failed", err);
        onError?.(err);
      },
    });
    return () => sub.unsubscribe();
  }

  async addIngredients(
    ingredients: { name: string; amount?: number; unit?: string }[],
    recipeId: string,
  ): Promise<void> {
    await this.db.transaction("rw", this.db.shopping, async () => {
      const existing = await this.db.shopping.toArray();
      for (const ing of ingredients) {
        if (!ing.name.trim()) continue;
        const result = mergeIntoList(existing, ing, recipeId);
        if (result.update) {
          await this.db.shopping.update(result.update.id, {
            amount: result.update.amount,
            unit: result.update.unit,
            recipeIds: result.update.recipeIds,
            checked: false,
          });
          const idx = existing.findIndex((e) => e.id === result.update!.id);
          if (idx >= 0) {
            existing[idx] = {
              ...existing[idx],
              amount: result.update.amount,
              unit: result.update.unit,
              recipeIds: result.update.recipeIds,
            };
          }
        } else if (result.create) {
          const item: ShoppingItem = { ...result.create, id: newId(), createdAt: Date.now() };
          await this.db.shopping.add(item);
          existing.push(item);
        }
      }
    });
  }

  async addItem(item: { name: string; amount?: number; unit?: string }): Promise<void> {
    const name = item.name.trim();
    if (!name) return;
    await this.db.shopping.add({
      id: newId(),
      name,
      amount: item.amount,
      unit: item.unit?.trim() || undefined,
      checked: false,
      recipeIds: [],
      createdAt: Date.now(),
    });
  }

  async updateItem(
    id: string,
    patch: { name?: string; amount?: number; unit?: string },
  ): Promise<void> {
    const clean: { name?: string; amount?: number; unit?: string } = {};
    if ("name" in patch && patch.name !== undefined) clean.name = patch.name.trim();
    if ("amount" in patch) clean.amount = patch.amount;
    if ("unit" in patch) clean.unit = patch.unit?.trim() || undefined;
    await this.db.shopping.update(id, clean);
  }

  async toggle(id: string): Promise<void> {
    const item = await this.db.shopping.get(id);
    if (item) await this.db.shopping.update(id, { checked: !item.checked });
  }

  async remove(id: string): Promise<void> {
    await this.db.shopping.delete(id);
  }

  async clearChecked(): Promise<void> {
    await this.db.shopping.filter((i) => i.checked).delete();
  }

  async clearAll(): Promise<void> {
    await this.db.shopping.clear();
  }

  async importItems(items: ShoppingItem[]): Promise<void> {
    await this.db.shopping.bulkPut(items);
  }
}
