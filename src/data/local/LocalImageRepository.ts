import type { LocalImage } from "@/domain/types";
import type { ImageRepository } from "../repositories";
import { getDB } from "./db";
import { newId } from "@/lib/text";

export const LOCAL_IMAGE_PREFIX = "local-image:";

export class LocalImageRepository implements ImageRepository {
  private db = getDB();

  async save(blob: Blob): Promise<string> {
    const id = newId();
    await this.db.images.add({
      id,
      blob,
      mime: blob.type || "image/jpeg",
      createdAt: Date.now(),
    });
    return `${LOCAL_IMAGE_PREFIX}${id}`;
  }

  async get(ref: string): Promise<LocalImage | undefined> {
    if (!ref.startsWith(LOCAL_IMAGE_PREFIX)) return undefined;
    return this.db.images.get(ref.slice(LOCAL_IMAGE_PREFIX.length));
  }

  async delete(ref: string): Promise<void> {
    if (!ref.startsWith(LOCAL_IMAGE_PREFIX)) return;
    await this.db.images.delete(ref.slice(LOCAL_IMAGE_PREFIX.length));
  }

  async getAll(): Promise<LocalImage[]> {
    return this.db.images.toArray();
  }

  async importImages(images: { id: string; blob: Blob; mime: string }[]): Promise<void> {
    await this.db.images.bulkPut(
      images.map((i) => ({ id: i.id, blob: i.blob, mime: i.mime, createdAt: Date.now() })),
    );
  }
}
