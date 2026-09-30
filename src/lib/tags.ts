/**
 * Tags an Rezepten: Eingabe normalisieren, Vorschläge sammeln, filtern.
 *
 * Bewusst reine Funktionen – die UI-Schicht ruft sie nur auf, und sie sind
 * ohne IndexedDB/DOM testbar.
 */

export const MAX_TAGS_PER_RECIPE = 12;
export const MAX_TAG_LENGTH = 24;

/**
 * Zerlegt eine Eingabe in Tags: trennt an Komma und Semikolon, trimmt,
 * kürzt auf 24 Zeichen, wirft Leeres und Duplikate (case-insensitiv) weg und
 * begrenzt auf 12 Tags je Rezept.
 */
export function parseTagInput(raw: string, existing: string[] = []): string[] {
  const result = [...existing];
  const seen = new Set(result.map((tag) => tag.toLowerCase()));

  for (const part of raw.split(/[,;]+/)) {
    const cleaned = part.replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH);
    if (cleaned.length < 2) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    if (result.length >= MAX_TAGS_PER_RECIPE) break;
    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

/** Entfernt ein Tag (case-insensitiv) aus der Liste. */
export function removeTag(tags: string[], tag: string): string[] {
  const key = tag.toLowerCase();
  return tags.filter((entry) => entry.toLowerCase() !== key);
}

/**
 * Sammelt alle vergebenen Tags über alle Rezepte, häufigste zuerst
 * (bei Gleichstand alphabetisch) – Grundlage für die Vorschlagsliste.
 */
export function collectTags(recipes: { tags?: string[] }[]): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const recipe of recipes) {
    for (const tag of recipe.tags ?? []) {
      const key = tag.toLowerCase();
      const prev = counts.get(key);
      if (prev) prev.count += 1;
      else counts.set(key, { label: tag, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.label.localeCompare(b.label)))
    .map((entry) => entry.label);
}

/** Rezept passt zu allen gewählten Tags (UND-Verknüpfung, case-insensitiv). */
export function matchesTags(recipe: { tags?: string[] }, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const own = new Set((recipe.tags ?? []).map((tag) => tag.toLowerCase()));
  return selected.every((tag) => own.has(tag.toLowerCase()));
}
