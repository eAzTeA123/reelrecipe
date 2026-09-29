import type { Ingredient, ParseSnapshot, RecipeStep } from "@/domain/types";

/**
 * Verlustfreier Merge von neuem Parser-Ergebnis und Nutzerfassung.
 *
 * Problem vorher: Die Migration hat Zutaten nur über den exakten Namen gesucht.
 * Wer eine Zutat umbenannt hatte, bekam sie doppelt; wer eine gelöscht hatte,
 * bekam sie beim nächsten Parser-Update zurück. Mit dem beim Import
 * gespeicherten `parseSnapshot` ist eindeutig erkennbar, was der Nutzer selbst
 * geändert hat – diese Änderungen gewinnen, alles andere wird aktualisiert.
 */

export interface MergeStoredRecipe {
  title: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  parseSnapshot?: ParseSnapshot;
}

export interface MergeParsedRecipe {
  title: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
}

export interface MergeResult {
  title: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  /** Vom Nutzer gelöschte Einträge, die nicht wieder aufgetaucht sind */
  respectedRemovals: number;
  /** Vom Nutzer umbenannte/angepasste Einträge, die erhalten blieben */
  respectedEdits: number;
  /** Neu erkannte Einträge des Parsers, die ergänzt wurden */
  addedByParser: number;
  /** true = das Rezept wurde erkennbar von Hand bearbeitet */
  userEdited: boolean;
  /** true = es gab keinen Snapshot (Altbestand), es wurde konservativ gemergt */
  legacyMerge: boolean;
}

const FILLER = new Set([
  "der", "die", "das", "und", "oder", "mit", "von", "vom", "für", "fur", "the", "and",
  "aus", "dem", "den", "ein", "eine", "einen", "etwas", "ca", "je", "jeweils", "optional",
]);

/** Vergleichsform: klein, ohne Sonderzeichen, ohne Füllwörter. */
export function normalizeEntry(value: string): string {
  const words = value
    .toLowerCase()
    .replace(/[„“”"']/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9äöüß ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const meaningful = words.filter((w) => w.length >= 3 && !FILLER.has(w));
  // Kurze Namen ("Ei", "Öl") dürfen nicht wegfallen
  return (meaningful.length > 0 ? meaningful : words).join(" ").trim();
}

/** Exakt derselbe Eintrag (nur Schreibweise/Sonderzeichen anders)? */
export function isIdenticalEntry(a: string, b: string): boolean {
  return normalizeEntry(a) === normalizeEntry(b);
}

/** 0 = verschieden, 1 = gleich. Umbenennungen ("Zwiebel" → "rote Zwiebel") ergeben 1. */
export function entrySimilarity(a: string, b: string): number {
  const na = normalizeEntry(a);
  const nb = normalizeEntry(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length >= 4 && long.includes(short)) return 1;
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

/** Ab dieser Ähnlichkeit gilt ein Eintrag als "dieselbe Zutat, nur angepasst". */
const SAME_ENTRY = 0.5;

function sameAmount(a: Ingredient, b: { amount?: number; unit?: string }): boolean {
  return (a.amount ?? null) === (b.amount ?? null) && (a.unit ?? "") === (b.unit ?? "");
}

interface Match {
  snapshotIndex: number;
  storedIndex: number;
}

/** Snapshot-Einträge den gespeicherten Einträgen zuordnen (jeder höchstens einmal). */
function matchSnapshotToStored(
  snapshot: ParseSnapshot,
  stored: Ingredient[],
): { matches: Match[]; removed: number[]; storedOnly: number[] } {
  const matches: Match[] = [];
  const usedStored = new Set<number>();
  const removed: number[] = [];

  snapshot.ingredients.forEach((snap, snapshotIndex) => {
    let bestStored = -1;
    let bestScore = 0;
    stored.forEach((ing, storedIndex) => {
      if (usedStored.has(storedIndex)) return;
      const score = entrySimilarity(snap.name, ing.name);
      if (score > bestScore) {
        bestScore = score;
        bestStored = storedIndex;
      }
    });

    if (bestStored >= 0 && bestScore >= SAME_ENTRY) {
      usedStored.add(bestStored);
      matches.push({ snapshotIndex, storedIndex: bestStored });
    } else {
      removed.push(snapshotIndex);
    }
  });

  const storedOnly = stored.map((_, i) => i).filter((i) => !usedStored.has(i));
  return { matches, removed, storedOnly };
}

function mergeIngredients(
  stored: Ingredient[],
  parsed: Ingredient[],
  snapshot: ParseSnapshot,
): { ingredients: Ingredient[]; respectedRemovals: number; respectedEdits: number; addedByParser: number } {
  const { matches, removed } = matchSnapshotToStored(snapshot, stored);

  // Gelöschte Snapshot-Einträge als Vergleichsnamen (der neue Parser kann
  // denselben Eintrag anders benennen, deshalb Ähnlichkeit statt Gleichheit)
  const removedNames = removed.map((i) => snapshot.ingredients[i].name);
  const consumedRemoved = new Set<number>();

  const editedBySnapshot = new Map<number, number>(); // snapshotIndex → storedIndex
  for (const m of matches) {
    const snap = snapshot.ingredients[m.snapshotIndex];
    const user = stored[m.storedIndex];
    if (!isIdenticalEntry(snap.name, user.name)) editedBySnapshot.set(m.snapshotIndex, m.storedIndex);
  }

  const result: Ingredient[] = [];
  const seen = new Set<string>();
  let respectedRemovals = 0;
  let respectedEdits = 0;
  let addedByParser = 0;

  for (const ing of parsed) {
    const name = normalizeEntry(ing.name);

    // 1) Vom Nutzer gelöscht? → nicht wieder ergänzen
    const removedIdx = removedNames.findIndex(
      (rn, i) => !consumedRemoved.has(i) && entrySimilarity(rn, ing.name) >= SAME_ENTRY,
    );
    if (removedIdx >= 0) {
      consumedRemoved.add(removedIdx);
      respectedRemovals++;
      continue;
    }

    // 2) Vom Nutzer umbenannt/angepasst? → seine Fassung gewinnt,
    //    unveränderte Felder kommen aber vom neuen Parser
    const match = matches.find((m) => {
      const snap = snapshot.ingredients[m.snapshotIndex];
      return entrySimilarity(snap.name, ing.name) >= SAME_ENTRY;
    });
    if (match) {
      const snap = snapshot.ingredients[match.snapshotIndex];
      const user = stored[match.storedIndex];
      const userRenamed = !isIdenticalEntry(snap.name, user.name);
      const userChangedAmount = !sameAmount(user, snap);
      const userChangedNotes = (user.notes ?? "") !== (snap.notes ?? "");

      const merged: Ingredient = {
        ...ing,
        id: user.id,
        name: userRenamed ? user.name : ing.name,
        amount: userChangedAmount ? user.amount : ing.amount,
        unit: userChangedAmount ? user.unit : ing.unit,
        notes: userChangedNotes ? user.notes : ing.notes,
        uncertain: user.uncertain === false ? false : ing.uncertain,
      };
      const key = normalizeEntry(merged.name);
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(merged);
      }
      if (userRenamed || userChangedAmount || userChangedNotes) respectedEdits++;
      continue;
    }

    // 3) Wirklich neu erkannt → ergänzen
    if (name && !seen.has(name)) {
      seen.add(name);
      result.push({ ...ing });
      addedByParser++;
    }
  }

  // 4) Zutaten, die der Nutzer selbst ergänzt hat, bleiben am Ende erhalten
  for (const storedIndex of stored.map((_, i) => i)) {
    const user = stored[storedIndex];
    const key = normalizeEntry(user.name);
    if (!key || seen.has(key)) continue;
    const isSnapshotEntry = matches.some((m) => m.storedIndex === storedIndex);
    if (isSnapshotEntry) continue; // wurde oben schon behandelt
    seen.add(key);
    result.push({ ...user });
  }

  return { ingredients: result, respectedRemovals, respectedEdits, addedByParser };
}

function mergeSteps(
  stored: RecipeStep[],
  parsed: RecipeStep[],
  snapshot: ParseSnapshot,
): { steps: RecipeStep[]; respectedRemovals: number; respectedEdits: number; addedByParser: number } {
  const removedTexts = snapshot.steps.filter(
    (snap) => !stored.some((s) => entrySimilarity(s.instruction, snap) >= SAME_ENTRY),
  );
  const consumedRemoved = new Set<number>();
  const result: RecipeStep[] = [];
  let respectedRemovals = 0;
  let respectedEdits = 0;
  let addedByParser = 0;

  for (const step of parsed) {
    const removedIdx = removedTexts.findIndex(
      (rt, i) => !consumedRemoved.has(i) && entrySimilarity(rt, step.instruction) >= SAME_ENTRY,
    );
    if (removedIdx >= 0) {
      consumedRemoved.add(removedIdx);
      respectedRemovals++;
      continue;
    }

    // Hat der Nutzer diesen Schritt bearbeitet? Dann seine Fassung behalten.
    const storedMatch = stored.find((s) => entrySimilarity(s.instruction, step.instruction) >= SAME_ENTRY);
    const snapshotMatch = snapshot.steps.some((snap) => entrySimilarity(snap, step.instruction) >= SAME_ENTRY);
    if (storedMatch && snapshotMatch && !isIdenticalEntry(storedMatch.instruction, step.instruction)) {
      result.push({ ...step, id: storedMatch.id, instruction: storedMatch.instruction });
      respectedEdits++;
      continue;
    }
    result.push({ ...step, id: storedMatch?.id ?? step.id });
    addedByParser++;
  }

  // Vom Nutzer ergänzte Schritte (nicht im Snapshot) bleiben erhalten
  for (const step of stored) {
    const inSnapshot = snapshot.steps.some((snap) => entrySimilarity(snap, step.instruction) >= SAME_ENTRY);
    const inResult = result.some((r) => entrySimilarity(r.instruction, step.instruction) >= SAME_ENTRY);
    if (!inSnapshot && !inResult) result.push({ ...step });
  }

  return {
    steps: result.map((s, i) => ({ ...s, order: i + 1 })),
    respectedRemovals,
    respectedEdits,
    addedByParser,
  };
}

/**
 * Ohne Snapshot (Rezepte aus früheren Versionen) ist nicht unterscheidbar, ob
 * eine Zutat neu erkannt oder vom Nutzer gelöscht wurde. Deshalb konservativ:
 * unveränderte Listen werden aktualisiert, bearbeitete bleiben stehen und
 * werden nur um echte Neuentdeckungen ergänzt.
 */
function mergeLegacy(stored: MergeStoredRecipe, parsed: MergeParsedRecipe): MergeResult {
  const namesUnchanged =
    stored.ingredients.length === parsed.ingredients.length &&
    stored.ingredients.every((ing, i) => entrySimilarity(ing.name, parsed.ingredients[i]?.name ?? "") >= 1);

  if (namesUnchanged) {
    const ingredients = parsed.ingredients.map((ing, i) => ({ ...ing, id: stored.ingredients[i].id }));
    const stepsUnchanged =
      stored.steps.length === parsed.steps.length &&
      stored.steps.every((s, i) => entrySimilarity(s.instruction, parsed.steps[i]?.instruction ?? "") >= 1);
    const steps = stepsUnchanged
      ? parsed.steps.map((s, i) => ({ ...s, id: stored.steps[i].id, order: i + 1 }))
      : stored.steps.map((s, i) => ({ ...s, order: i + 1 }));
    return {
      title: parsed.title,
      ingredients,
      steps,
      respectedRemovals: 0,
      respectedEdits: 0,
      addedByParser: 0,
      userEdited: false,
      legacyMerge: true,
    };
  }

  // Erkennbar bearbeitet: Nutzerfassung bleibt Basis, nur unbekannte Zutaten kommen dazu
  const ingredients = [...stored.ingredients];
  let addedByParser = 0;
  for (const ing of parsed.ingredients) {
    const known = stored.ingredients.some((s) => entrySimilarity(s.name, ing.name) >= SAME_ENTRY);
    if (!known) {
      ingredients.push({ ...ing });
      addedByParser++;
    }
  }

  return {
    title: stored.title,
    ingredients,
    steps: stored.steps.map((s, i) => ({ ...s, order: i + 1 })),
    respectedRemovals: 0,
    respectedEdits: 0,
    addedByParser,
    userEdited: true,
    legacyMerge: true,
  };
}

export function mergeParsedRecipe(stored: MergeStoredRecipe, parsed: MergeParsedRecipe): MergeResult {
  if (!stored.parseSnapshot) return mergeLegacy(stored, parsed);

  const snapshot = stored.parseSnapshot;
  const ingredientResult = mergeIngredients(stored.ingredients, parsed.ingredients, snapshot);
  const stepResult = mergeSteps(stored.steps, parsed.steps, snapshot);

  // Titel: nur übernehmen, wenn der Nutzer ihn nicht selbst geändert hat
  const titleEdited = stored.title.trim() !== snapshot.title.trim();
  const title = titleEdited ? stored.title : parsed.title;

  return {
    title,
    ingredients: ingredientResult.ingredients,
    steps: stepResult.steps,
    respectedRemovals: ingredientResult.respectedRemovals + stepResult.respectedRemovals,
    respectedEdits: ingredientResult.respectedEdits + stepResult.respectedEdits,
    addedByParser: ingredientResult.addedByParser + stepResult.addedByParser,
    userEdited:
      titleEdited ||
      ingredientResult.respectedRemovals + ingredientResult.respectedEdits > 0 ||
      stepResult.respectedRemovals + stepResult.respectedEdits > 0,
    legacyMerge: false,
  };
}

/** Snapshot aus einem Parser-Ergebnis erzeugen (beim Import speichern). */
export function createParseSnapshot(parsed: {
  title: string;
  ingredients: { name: string; amount?: number; unit?: string; notes?: string }[];
  steps: { instruction: string }[];
}): ParseSnapshot {
  return {
    title: parsed.title,
    ingredients: parsed.ingredients.map((i) => ({
      name: i.name,
      amount: i.amount,
      unit: i.unit,
      notes: i.notes,
    })),
    steps: parsed.steps.map((s) => s.instruction),
  };
}

