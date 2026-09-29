import type { AisleOrderRepository } from "../repositories";
import { getDB } from "./db";
import { newId } from "@/lib/text";
import { getAisle } from "@/lib/shoppingAisles";

const MIN_EVENTS = 3;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export class LocalAisleOrderRepository implements AisleOrderRepository {
  private db = getDB();

  async recordCheck(aisle: string): Promise<void> {
    // Count how many distinct aisles already have checked items
    const items = await this.db.shopping.toArray();
    const checkedAisles = new Set(
      items.filter((i) => i.checked).map((i) => getAisle(i.name)),
    );
    const position = checkedAisles.size;

    await this.db.aisleOrder.add({
      id: newId(),
      aisle,
      position,
      timestamp: Date.now(),
    });

    // Prune old events
    const cutoff = Date.now() - MAX_AGE_MS;
    await this.db.aisleOrder.where("timestamp").below(cutoff).delete();
  }

  async getOrder(): Promise<Map<string, number>> {
    const events = await this.db.aisleOrder.toArray();
    const sums = new Map<string, { total: number; count: number }>();
    for (const e of events) {
      const prev = sums.get(e.aisle) ?? { total: 0, count: 0 };
      sums.set(e.aisle, { total: prev.total + e.position, count: prev.count + 1 });
    }
    const result = new Map<string, number>();
    for (const [aisle, { total, count }] of sums) {
      if (count >= MIN_EVENTS) {
        result.set(aisle, total / count);
      }
    }
    return result;
  }

  async clear(): Promise<void> {
    await this.db.aisleOrder.clear();
  }
}
