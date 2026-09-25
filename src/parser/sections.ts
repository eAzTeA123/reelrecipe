export type Section = "ingredients" | "steps" | "ignore" | null;

const INGREDIENT_HEADERS = [
  "zutaten", "zutatenliste", "ingredients", "ingredient list",
  "you need", "you'll need", "youll need", "what you need", "what you'll need", "what youll need",
  "das brauchst du", "das brauchst du dafür", "dafür brauchst du", "dafuer brauchst du",
  "das benötigst du", "das benoetigst du", "einkaufsliste",
  "for the ingredients", "ingredienten",
];

const STEP_HEADERS = [
  "zubereitung", "instructions", "instruction", "directions", "method",
  "steps", "anleitung", "preparation", "so geht's", "so gehts",
  "so geht es", "so wird's gemacht", "so wirds gemacht", "schritt für schritt",
  "schritt fuer schritt", "how to", "how to make it", "vorgehensweise",
  "zubereitungsschritte", "rezept-zubereitung",
];

const IGNORE_HEADERS = [
  "notes", "notizen", "tipps", "tips", "tipp", "tip", "hinweise",
  "nährwerte", "naehrwerte", "nutrition", "nutritional info", "kalorien",
  "enjoy", "guten appetit", "lasst es euch schmecken", "kommentare",
];

function stripHeaderDecoration(line: string): string {
  return line
    .toLowerCase()
    .replace(/[\s\u{FE0F}\u{200D}]/gu, " ")
    .replace(/[^\p{L}\p{N}\s']/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Erkennt Überschriften wie "Zutaten:", "🥕 Ingredients", "ZUBEREITUNG (für 2)". */
export function detectSection(line: string): Section {
  const cleaned = stripHeaderDecoration(line).replace(/\s*\(.*?\)\s*/g, " ").trim();
  if (!cleaned) return null;

  for (const h of INGREDIENT_HEADERS) {
    if (cleaned === h || cleaned.startsWith(h + " ")) return "ingredients";
  }
  for (const h of STEP_HEADERS) {
    if (cleaned === h || cleaned.startsWith(h + " ")) return "steps";
  }
  for (const h of IGNORE_HEADERS) {
    if (cleaned === h || cleaned.startsWith(h + " ")) return "ignore";
  }
  // Kurze Zeilen mit Doppelpunkt ("For the Beef:", "Sauce:") = Zutaten-Gruppenheader
  if (/:\s*$/.test(line) && cleaned.length <= 45) return "ingredients";
  return null;
}
