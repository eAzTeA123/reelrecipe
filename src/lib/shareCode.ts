import type { Recipe, ShoppingItem } from "@/domain/types";

/**
 * Weitergabe-Codes für einzelne Rezepte und Einkaufslisten.
 *
 * Kein Konto, kein Server, keine externe API: Der Inhalt wird komprimiert
 * (deflate-raw) und als Textcode ausgegeben, den man per Messenger weitergeben
 * kann. Der Empfänger fügt ihn in den Import ein.
 *
 * Wichtig: Der Code ist komprimiert, NICHT verschlüsselt. Wer ihn sieht, kann
 * den Inhalt lesen – das ist bei Rezepten gewollt (sie sind zum Weitergeben da).
 * Der Modus-Buchstabe "p" ist für eine spätere passwortgeschützte Variante
 * reserviert.
 *
 * Bewusst NICHT im Code: Bilder (ein Foto sprengt jeden Code) sowie
 * gerätelokale Artefakte wie Favorit, parserVersion und parseSnapshot.
 */

export const SHARE_PREFIX = "S2C1";
const SEPARATOR = ":";
const MODE_COMPRESSED = "c";
const MODE_PLAIN = "u";
const KIND_RECIPE = "r";
const KIND_SHOPPING = "l";
/** Ab dieser Länge ist ein Code nicht mehr praktikabel zum Kopieren. */
export const MAX_SHARE_CODE_LENGTH = 12_000;

export interface SharedIngredient {
  name: string;
  amount?: number;
  unit?: string;
  notes?: string;
}

/** Gleiche Feldnamen wie der bestehende ?share=-Empfangspfad der Import-Seite. */
export interface SharedRecipe {
  title: string;
  description?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  color?: string;
  category?: string;
  tags?: string[];
  sourceUrl?: string;
  ingredients: SharedIngredient[];
  steps: string[];
}

export interface SharedShoppingItem {
  name: string;
  amount?: number;
  unit?: string;
}

export type SharePayload =
  | { kind: "recipe"; recipe: SharedRecipe }
  | { kind: "shopping"; items: SharedShoppingItem[] };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deflate(text: string): Promise<Uint8Array | undefined> {
  if (typeof CompressionStream === "undefined") return undefined;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<string> {
  // Frischer ArrayBuffer: die DOM-Typen akzeptieren kein Uint8Array<ArrayBufferLike>
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

/** Nur der Inhalt, ohne Kopfdaten – so bleibt der Code so kurz wie möglich. */
function payloadFor(payload: SharePayload): string {
  return JSON.stringify(payload.kind === "recipe" ? { recipe: payload.recipe } : { items: payload.items });
}

/** Textcode erzeugen. Wirft, wenn der Inhalt für einen Code zu groß ist. */
export async function encodeShareCode(payload: SharePayload): Promise<string> {
  const json = payloadFor(payload);
  const kind = payload.kind === "recipe" ? KIND_RECIPE : KIND_SHOPPING;
  const compressed = await deflate(json);
  const code = compressed
    ? [SHARE_PREFIX, MODE_COMPRESSED, kind, toBase64Url(compressed)].join(SEPARATOR)
    : [SHARE_PREFIX, MODE_PLAIN, kind, toBase64Url(new TextEncoder().encode(json))].join(SEPARATOR);
  if (code.length > MAX_SHARE_CODE_LENGTH) {
    throw new Error("Der Inhalt ist zu groß für einen Code. Teile stattdessen ein Backup.");
  }
  return code;
}

/** Prüft, ob ein eingefügter Text ein Weitergabe-Code ist. */
export function looksLikeShareCode(value: string): boolean {
  return value.trim().startsWith(`${SHARE_PREFIX}${SEPARATOR}`);
}

/** Ersten Code aus einem eingefügten Text herausziehen (z. B. aus einer Nachricht). */
export function extractShareCode(value: string): string | undefined {
  const match = value.match(
    new RegExp(`(${SHARE_PREFIX}${SEPARATOR}[\\w-]+${SEPARATOR}[\\w-]+${SEPARATOR}[\\w-]+)`),
  );
  return match?.[1];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return out.length > 0 ? out : undefined;
}

/** Zutaten tolerant lesen: unvollständige Einträge fallen weg, der Rest bleibt. */
function parseIngredients(value: unknown): SharedIngredient[] {
  if (!Array.isArray(value)) return [];
  const out: SharedIngredient[] = [];
  for (const raw of value) {
    const record = asRecord(raw);
    const name = optionalString(record?.name);
    if (!name) continue;
    out.push({
      name,
      amount: optionalNumber(record?.amount),
      unit: optionalString(record?.unit),
      notes: optionalString(record?.notes),
    });
  }
  return out;
}

function parseRecipePayload(value: unknown): SharedRecipe {
  const record = asRecord(value);
  const title = optionalString(record?.title);
  const ingredients = parseIngredients(record?.ingredients);
  if (!title || ingredients.length === 0) {
    throw new Error("Der Code enthält kein vollständiges Rezept.");
  }
  return {
    title,
    description: optionalString(record?.description),
    servings: optionalNumber(record?.servings),
    prepTime: optionalNumber(record?.prepTime),
    cookTime: optionalNumber(record?.cookTime),
    color: optionalString(record?.color),
    category: optionalString(record?.category),
    tags: optionalStringArray(record?.tags),
    sourceUrl: optionalString(record?.sourceUrl),
    ingredients,
    steps: Array.isArray(record?.steps)
      ? (record.steps as unknown[]).filter((step): step is string => typeof step === "string" && step.trim().length > 0)
      : [],
  };
}

function parseShoppingPayload(value: unknown): SharedShoppingItem[] {
  if (!Array.isArray(value)) throw new Error("Der Code enthält keine Einkaufsliste.");
  const items: SharedShoppingItem[] = [];
  for (const raw of value) {
    const record = asRecord(raw);
    const name = optionalString(record?.name);
    if (!name) continue;
    items.push({ name, amount: optionalNumber(record?.amount), unit: optionalString(record?.unit) });
  }
  if (items.length === 0) throw new Error("Der Code enthält keine Einkaufsliste.");
  return items;
}

/** Textcode einlesen. Wirft mit verständlicher Meldung, wenn er unbrauchbar ist. */
export async function decodeShareCode(input: string): Promise<SharePayload> {
  const code = extractShareCode(input) ?? input.trim();
  const parts = code.split(SEPARATOR);
  if (parts.length !== 4 || parts[0] !== SHARE_PREFIX) {
    throw new Error("Das ist kein Scroll2Cook-Code.");
  }
  const [, mode, kind, data] = parts;
  if (!data) throw new Error("Der Code ist unvollständig.");
  if (mode !== MODE_COMPRESSED && mode !== MODE_PLAIN) {
    throw new Error("Dieser Code stammt aus einer neueren Version der App.");
  }

  let json: string;
  try {
    const bytes = fromBase64Url(data);
    json = mode === MODE_COMPRESSED ? await inflate(bytes) : new TextDecoder().decode(bytes);
  } catch {
    throw new Error("Der Code ist beschädigt und konnte nicht gelesen werden.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Der Code ist beschädigt und konnte nicht gelesen werden.");
  }
  const record = asRecord(parsed);
  if (!record) throw new Error("Der Code ist beschädigt und konnte nicht gelesen werden.");

  if (kind === KIND_RECIPE) return { kind: "recipe", recipe: parseRecipePayload(record.recipe) };
  if (kind === KIND_SHOPPING) return { kind: "shopping", items: parseShoppingPayload(record.items) };
  throw new Error("Dieser Code-Typ wird nicht unterstützt.");
}

/** Rezept in die Weitergabe-Form bringen (Feldauswahl an genau einer Stelle). */
export function recipeToSharePayload(recipe: Recipe): SharePayload {
  return {
    kind: "recipe",
    recipe: {
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      color: recipe.color,
      category: recipe.category,
      tags: recipe.tags,
      sourceUrl: recipe.sourceUrl,
      ingredients: recipe.ingredients.map((ingredient) => ({
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
        notes: ingredient.notes,
      })),
      steps: recipe.steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((step) => step.instruction),
    },
  };
}

/** Einkaufsliste in die Weitergabe-Form bringen – ohne "abgehakt"-Zustand. */
export function shoppingToSharePayload(items: ShoppingItem[]): SharePayload {
  return {
    kind: "shopping",
    items: items.map((item) => ({ name: item.name, amount: item.amount, unit: item.unit })),
  };
}

/** Einkaufsliste als Klartext (für den Text-Weg). */
export function shoppingToText(items: ShoppingItem[]): string {
  return items
    .filter((item) => !item.checked)
    .map((item) => [item.amount !== undefined ? String(item.amount).replace(".", ",") : "", item.unit ?? "", item.name]
      .filter(Boolean)
      .join(" "))
    .join("\n");
}
