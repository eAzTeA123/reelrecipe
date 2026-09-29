import { getDB } from "./db";
import { newId } from "@/lib/text";
import { correctionsToFixtureJson, isRecordableCorrection } from "@/parser/corpus/fromCorrection";
import type { CorrectionRepository } from "@/data/repositories";
import type { ParserCorrection } from "@/domain/types";

/** Obergrenze, damit das lokale Log nicht unbegrenzt wächst. */
const MAX_ENTRIES = 200;

export class LocalCorrectionRepository implements CorrectionRepository {
  async record(entry: Omit<ParserCorrection, "id" | "createdAt">): Promise<ParserCorrection | undefined> {
    if (!isRecordableCorrection(entry.parsed, entry.corrected, entry.sourceCaption)) return undefined;

    const row: ParserCorrection = { ...entry, id: newId(), createdAt: Date.now() };
    const db = getDB();
    await db.corrections.put(row);

    const all = await db.corrections.orderBy("createdAt").toArray();
    if (all.length > MAX_ENTRIES) {
      const obsolete = all.slice(0, all.length - MAX_ENTRIES).map((r) => r.id);
      await db.corrections.bulkDelete(obsolete);
    }
    return row;
  }

  async list(): Promise<ParserCorrection[]> {
    return getDB().corrections.orderBy("createdAt").reverse().toArray();
  }

  async count(): Promise<number> {
    return getDB().corrections.count();
  }

  async remove(id: string): Promise<void> {
    await getDB().corrections.delete(id);
  }

  async clearAll(): Promise<void> {
    await getDB().corrections.clear();
  }

  /** JSON-Inhalt (Fixture-Array) für src/parser/corpus/fixtures/. */
  async exportFixtures(): Promise<string> {
    const rows = await this.list();
    return correctionsToFixtureJson(rows);
  }
}
