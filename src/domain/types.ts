export interface Ingredient {
  id: string;
  amount?: number;
  unit?: string;
  name: string;
  notes?: string;
  /**
   * Zutatengruppe aus der Caption („Teig", „Belag", „Frischkäse-Guss").
   * Vorher landeten solche Überschriften **als Zutaten** in der Liste und
   * klebten an Namen („Salz FÜLLUNG") – jetzt sind sie ein eigenes Feld.
   */
  group?: string;
  /** true, wenn der Parser die Zeile nicht eindeutig zuordnen konnte */
  uncertain?: boolean;
}

export interface RecipeStep {
  id: string;
  order: number;
  instruction: string;
}

/**
 * Zustand des Parser-Ergebnisses beim Import. Damit erkennt die spätere
 * Parser-Migration, was der Nutzer danach geändert hat (gelöscht, umbenannt,
 * Menge angepasst, ergänzt) – und lässt diese Änderungen stehen.
 */
export interface ParseSnapshotIngredient {
  name: string;
  amount?: number;
  unit?: string;
  notes?: string;
  group?: string;
}

export interface ParseSnapshot {
  ingredients: ParseSnapshotIngredient[];
  /** Schritt-Texte, wie der Parser sie geliefert hat */
  steps: string[];
  /** Titel, den der Parser vorgeschlagen hatte */
  title: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  color?: string;
  /** Bild-Referenz: "local-image:<id>" (Blob in IndexedDB) oder externe URL */
  image?: string;
  sourceUrl?: string;
  /** Originale Caption, aus der das Rezept erkannt wurde */
  sourceCaption?: string;
  servings?: number;
  /** Vorbereitungszeit in Minuten */
  prepTime?: number;
  /** Koch-/Backzeit in Minuten */
  cookTime?: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  category?: string;
  tags?: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  /** Version des Parsers, mit der dieses Rezept zuletzt geparst wurde */
  parserVersion?: number;
  /** Parser-Ergebnis beim Import – Grundlage für verlustfreie Re-Parses */
  parseSnapshot?: ParseSnapshot;
}

export type RecipeInput = Omit<Recipe, "id" | "createdAt" | "updatedAt">;

export type DayOfWeek = "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su";

export interface MealPlanEntry {
  id: string;
  dayOfWeek: DayOfWeek;
  recipeId: string;
  servings: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount?: number;
  unit?: string;
  checked: boolean;
  /** Rezepte, aus denen die Zutat stammt */
  recipeIds: string[];
  createdAt: number;
}

export interface LocalImage {
  id: string;
  blob: Blob;
  mime: string;
  createdAt: number;
}

export interface BackupImage {
  id: string;
  mime: string;
  dataBase64: string;
}

export interface BackupFile {
  app: "rezept";
  /**
   * 1 = nur Rezepte, Bilder und Einkaufsliste.
   * 2 = zusätzlich Wochenplan, Korrektur-Log und Aisle-Reihenfolge.
   * 3 = zusätzlich Sammlungen (Ordner mit eigenen Filtern).
   * Alle Versionen bleiben lesbar (`parseBackup`).
   */
  version: 1 | 2 | 3;
  exportedAt: number;
  recipes: Recipe[];
  images: BackupImage[];
  shopping: ShoppingItem[];
  /** Ab Version 2 */
  mealPlan?: MealPlanEntry[];
  /** Ab Version 2 */
  corrections?: ParserCorrection[];
  /** Ab Version 2 */
  aisleOrder?: AisleCheckEvent[];
  /** Ab Version 3 */
  collections?: Collection[];
}

export interface AisleCheckEvent {
  id: string;
  aisle: string;
  position: number;
  timestamp: number;
}

/**
 * Eigene Filter einer Sammlung: alle gesetzten Regeln gelten zusammen (UND).
 *
 * Die Regeln greifen auf vorhandene Rezeptdaten zu (Kategorie, Zeiten,
 * Favorit, Titel, Zutaten) – dadurch muss ein Rezept für eine Sammlung
 * **nicht** extra verschlagwortet werden.
 */
export interface CollectionFilter {
  /** Ein oder mehrere Kategorien (innerhalb der Liste ODER-verknüpft) */
  categories?: string[];
  /** veraltet: einzelne Kategorie aus der ersten Fassung – wird weiter gelesen */
  category?: string;
  /** Bestands-Tags; im Rezept-Formular werden keine Tags mehr vergeben */
  tags?: string[];
  /** maximale Gesamtzeit in Minuten (Vorbereitung + Kochen) */
  maxTotalTime?: number;
  /** nur Favoriten */
  favoritesOnly?: boolean;
  /** Titel enthält … */
  titleContains?: string;
  /** Zutat enthält … */
  ingredientContains?: string;
  /** veraltet: Suchbegriff über Titel und Zutaten */
  query?: string;
}

/**
 * Sammlung (Ordner) für Rezepte.
 *
 * Die Mitgliedschaft liegt **in der Sammlung**, nicht am Rezept – dadurch
 * braucht kein bestehendes Rezept eine Migration, und ein Rezept darf in
 * beliebig vielen Sammlungen liegen. `filter` macht eine Sammlung dynamisch
 * (sie füllt sich selbst), `recipeIds` macht sie statisch; beides zusammen ist
 * die Vereinigung.
 */
export interface Collection {
  id: string;
  name: string;
  emoji?: string;
  order: number;
  filter?: CollectionFilter;
  recipeIds?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ParsedRecipe {
  title: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  tags?: string[];
}

/**
 * Nutzerkorrektur eines Parser-Ergebnisses: was der Parser vorgeschlagen hat und
 * was der Nutzer im Review daraus gemacht hat. Bleibt lokal und dient als
 * Testfall-Material für den Parser (Export in den Real-Caption-Corpus).
 */
export interface ParserCorrection {
  id: string;
  createdAt: number;
  sourceUrl?: string;
  sourceCaption: string;
  parsed: ParsedRecipe;
  corrected: ParsedRecipe;
}
