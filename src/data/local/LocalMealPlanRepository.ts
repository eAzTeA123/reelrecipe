import { liveQuery } from "dexie";
import type { MealPlanEntry } from "@/domain/types";
import type { MealPlanRepository } from "../repositories";
import { getDB } from "./db";
import { newId } from "@/lib/text";

export class LocalMealPlanRepository implements MealPlanRepository {
  private db = getDB();

  async list(): Promise<MealPlanEntry[]> {
    return this.db.mealPlan.toArray();
  }

  async getForDay(dayOfWeek: string): Promise<MealPlanEntry[]> {
    return this.db.mealPlan.where("dayOfWeek").equals(dayOfWeek).toArray();
  }

  async add(entry: Omit<MealPlanEntry, "id">): Promise<MealPlanEntry> {
    const newEntry: MealPlanEntry = { ...entry, id: newId() };
    await this.db.mealPlan.add(newEntry);
    return newEntry;
  }

  async update(id: string, patch: Partial<Omit<MealPlanEntry, "id">>): Promise<MealPlanEntry> {
    await this.db.mealPlan.update(id, patch);
    const updated = await this.db.mealPlan.get(id);
    if (!updated) throw new Error("Meal plan entry not found");
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.db.mealPlan.delete(id);
  }

  async clearAll(): Promise<void> {
    await this.db.mealPlan.clear();
  }

  subscribe(
    onChange: (entries: MealPlanEntry[]) => void,
    onError?: (error: unknown) => void,
  ): () => void {
    const sub = liveQuery(() => this.db.mealPlan.toArray()).subscribe({
      next: (all) => onChange(all),
      error: (err) => {
        console.error("meal plan subscription failed", err);
        onError?.(err);
      },
    });
    return () => sub.unsubscribe();
  }
}
