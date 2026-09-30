import type {
  LocalImage,
  ParserCorrection,
  Recipe,
  RecipeInput,
  ShoppingItem,
  MealPlanEntry,
  Collection,
} from "@/domain/types";

export interface SearchFilter {
  query?: string;
  category?: string;
  favoritesOnly?: boolean;
}

export interface RecipeRepository {
  list(filter?: SearchFilter): Promise<Recipe[]>;
  get(id: string): Promise<Recipe | undefined>;
  create(input: RecipeInput): Promise<Recipe>;
  update(id: string, patch: Partial<RecipeInput>): Promise<Recipe>;
  /** Speichert Rezept und optionales Bild atomar; löscht previousImageRef erst nach erfolgreichem Schreiben */
  saveWithImage(
    id: string | undefined,
    input: RecipeInput,
    pendingImage?: Blob,
    previousImageRef?: string,
  ): Promise<Recipe>;
  delete(id: string): Promise<void>;
  duplicate(id: string): Promise<Recipe>;
  toggleFavorite(id: string): Promise<void>;
  /** Live-Updates via Dexie liveQuery; gibt Unsubscribe zurück */
  subscribe(
    filter: SearchFilter | undefined,
    onChange: (recipes: Recipe[]) => void,
    onError?: (error: unknown) => void,
  ): () => void;
  /** Live-Update für ein einzelnes Rezept */
  subscribeOne(
    id: string,
    onChange: (recipe: Recipe | undefined) => void,
    onError?: (error: unknown) => void,
  ): () => void;
  importRecipes(recipes: Recipe[], mode: "skip" | "replace"): Promise<{ added: number; skipped: number }>;
  findBySourceUrl(sourceUrl: string): Promise<Recipe | undefined>;
  clearAll(): Promise<void>;
}

export interface ShoppingListRepository {
  list(): Promise<ShoppingItem[]>;
  subscribe(
    onChange: (items: ShoppingItem[]) => void,
    onError?: (error: unknown) => void,
  ): () => void;
  addIngredients(
    ingredients: { name: string; amount?: number; unit?: string }[],
    recipeId: string,
  ): Promise<void>;
  addItem(item: { name: string; amount?: number; unit?: string }): Promise<void>;
  updateItem(id: string, patch: { name?: string; amount?: number; unit?: string }): Promise<void>;
  toggle(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  clearChecked(): Promise<void>;
  clearAll(): Promise<void>;
  importItems(items: ShoppingItem[]): Promise<void>;
}

export interface MealPlanRepository {
  list(): Promise<MealPlanEntry[]>;
  getForDay(dayOfWeek: string): Promise<MealPlanEntry[]>;
  add(entry: Omit<MealPlanEntry, "id">): Promise<MealPlanEntry>;
  update(id: string, patch: Partial<Omit<MealPlanEntry, "id">>): Promise<MealPlanEntry>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
  subscribe(
    onChange: (entries: MealPlanEntry[]) => void,
    onError?: (error: unknown) => void,
  ): () => void;
}

export interface AisleOrderRepository {
  recordCheck(aisle: string): Promise<void>;
  getOrder(): Promise<Map<string, number>>;
  clear(): Promise<void>;
}

/** Sammlungen (Ordner) für Rezepte – Mitgliedschaft liegt in der Sammlung. */
export interface CollectionRepository {
  list(): Promise<Collection[]>;
  create(input: { name: string; emoji?: string; filter?: Collection["filter"] }): Promise<Collection>;
  rename(id: string, name: string): Promise<void>;
  update(id: string, patch: Partial<Pick<Collection, "name" | "emoji" | "filter" | "recipeIds">>): Promise<void>;
  addRecipes(id: string, recipeIds: string[]): Promise<void>;
  removeRecipe(id: string, recipeId: string): Promise<void>;
  setOrder(idsInOrder: string[]): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * Lokales Log der Nutzerkorrekturen am Parser-Ergebnis. Wird genutzt, um den
 * Real-Caption-Corpus mit echten Fehlfällen zu füttern.
 */
export interface CorrectionRepository {
  /** Speichert nur, wenn sich die Nutzerfassung wirklich vom Parser-Vorschlag unterscheidet */
  record(entry: Omit<ParserCorrection, "id" | "createdAt">): Promise<ParserCorrection | undefined>;
  list(): Promise<ParserCorrection[]>;
  count(): Promise<number>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
  /** JSON-Inhalt (Fixture-Array) für src/parser/corpus/fixtures/ */
  exportFixtures(): Promise<string>;
}

export interface ImageRepository {
  /** Speichert ein Bild, gibt die Referenz ("local-image:<id>") zurück */
  save(blob: Blob): Promise<string>;
  /** Gibt das Blob für eine "local-image:"-Referenz zurück */
  get(ref: string): Promise<LocalImage | undefined>;
  delete(ref: string): Promise<void>;
  getAll(): Promise<LocalImage[]>;
  importImages(images: { id: string; blob: Blob; mime: string }[]): Promise<void>;
}
