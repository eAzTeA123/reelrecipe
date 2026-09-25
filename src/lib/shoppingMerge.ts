import type { ShoppingItem } from "@/domain/types";
import { normalizeForSearch } from "./text";

const UNIT_GROUPS: Record<string, string> = {
  g: "mass", kg: "mass", mg: "mass",
  ml: "vol", l: "vol", cl: "vol",
  cup: "cup", cups: "cup",
  "stück": "count", "stueck": "count", st: "count", stk: "count", pcs: "count",
};

export function canonicalUnit(unit: string | undefined): string | undefined {
  if (!unit) return undefined;
  const u = unit.trim().toLowerCase();
  switch (u) {
    case "tbsp": case "el": case "esslöffel": case "essloeffel": return "EL";
    case "tsp": case "tl": case "teelöffel": case "teeloeffel": return "TL";
    case "cups": case "cup": case "tasse": case "tassen": return "cup";
    case "stueck": case "st": case "stk": case "pcs": case "stück": return "Stück";
    case "kg": case "kilogramm": return "kg";
    case "g": case "gramm": return "g";
    case "mg": case "milligramm": return "mg";
    case "l": case "liter": return "l";
    case "ml": case "milliliter": return "ml";
    case "cl": case "zentiliter": return "cl";
    default: return unit.trim();
  }
}

/** Normalisiert Einheit + Menge auf die Basis-Einheit der Gruppe (mass→g, vol→ml). */
export function normalizeAmount(
  amount: number | undefined,
  unit: string | undefined,
): { amount?: number; unit?: string } {
  const canon = canonicalUnit(unit);
  if (!canon) return { amount, unit: undefined };
  const u = canon.toLowerCase();
  switch (u) {
    case "kg": return { amount: amount !== undefined ? amount * 1000 : undefined, unit: "g" };
    case "mg": return { amount: amount !== undefined ? amount / 1000 : undefined, unit: "g" };
    case "l": return { amount: amount !== undefined ? amount * 1000 : undefined, unit: "ml" };
    case "cl": return { amount: amount !== undefined ? amount * 10 : undefined, unit: "ml" };
    default:
      return { amount, unit: canon };
  }
}

function unitCompatible(a?: string, b?: string): boolean {
  const ua = (canonicalUnit(a) ?? "").toLowerCase();
  const ub = (canonicalUnit(b) ?? "").toLowerCase();
  if (ua === ub) return true;
  const ga = UNIT_GROUPS[ua];
  const gb = UNIT_GROUPS[ub];
  return !!ga && ga === gb;
}

export interface MergeResult {
  /** Zu aktualisierendes vorhandenes Item (Menge wurde addiert) */
  update?: { id: string; amount?: number; unit?: string; recipeIds: string[] };
  /** Neues Item, falls kein Merge möglich */
  create?: Omit<ShoppingItem, "id" | "createdAt">;
}

/**
 * Findet ein vorhandenes Item mit gleichem (normalisiertem) Namen und
 * kompatibler Einheit und berechnet die zusammengeführte Menge.
 */
export function mergeIntoList(
  existing: ShoppingItem[],
  incoming: { name: string; amount?: number; unit?: string },
  recipeId: string,
): MergeResult {
  const nName = normalizeForSearch(incoming.name);
  const match = existing.find(
    (e) => normalizeForSearch(e.name) === nName && unitCompatible(e.unit, incoming.unit),
  );
  if (!match) {
    return {
      create: {
        name: incoming.name,
        amount: incoming.amount,
        unit: incoming.unit,
        checked: false,
        recipeIds: [recipeId],
      },
    };
  }
  const a = normalizeAmount(match.amount, match.unit);
  const b = normalizeAmount(incoming.amount, incoming.unit);

  // Wenn mindestens eine Menge unbekannt (undefined) ist, kann keine Gesamtsumme gebildet werden,
  // da sonst z. B. (undefined kg) + (500 g) zu fälschlichen 500 kg führen würde.
  // In dem Fall behalten wir sie separat oder setzen amount auf undefined.
  // Laut Plan: Wenn eine Menge bekannt und eine unbekannt ist, getrennt anlegen!
  if (
    (match.amount === undefined && incoming.amount !== undefined) ||
    (match.amount !== undefined && incoming.amount === undefined)
  ) {
    return {
      create: {
        name: incoming.name,
        amount: incoming.amount,
        unit: incoming.unit,
        checked: false,
        recipeIds: [recipeId],
      },
    };
  }

  const sum =
    a.amount !== undefined && b.amount !== undefined
      ? a.amount + b.amount
      : undefined;

  return {
    update: {
      id: match.id,
      amount: sum,
      unit: a.unit ?? match.unit,
      recipeIds: match.recipeIds.includes(recipeId)
        ? match.recipeIds
        : [...match.recipeIds, recipeId],
    },
  };
}
