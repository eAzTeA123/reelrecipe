/**
 * Tags an Rezepten – reine Bestandsdaten.
 *
 * Seit den Sammlungen mit eigenen Filtern vergibt die App keine Tags mehr
 * (kein Eingabefeld, keine Tag-Leiste in der Rezeptliste). Die Funktionen
 * bleiben, damit alte Bibliotheken ihre Tags behalten und eine Sammlung mit
 * einer alten Tag-Regel weiter funktioniert.
 */

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
