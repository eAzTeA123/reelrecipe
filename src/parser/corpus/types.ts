/**
 * Real-Caption-Corpus: Fixtures aus echten Social-Media-Captions mit
 * menschengeschriebener Ground Truth. Grundlage für den Feld-Score
 * (Zutaten-Name, Menge, Einheit, Titel, Portionen, Schritte).
 */

export interface CorpusIngredient {
  /** Zahl oder null, wenn die Caption keine Menge nennt */
  amount?: number | null;
  /** Obergrenze bei Bereichsangaben ("1–2 EL" → amount 1, amountMax 2) */
  amountMax?: number | null;
  /** Kanonische Einheit (g, ml, EL, TL, Stück, Packung …) oder null */
  unit?: string | null;
  name: string;
}

export interface CorpusExpected {
  /**
   * Erwarteter Titel. `null` = die Caption enthält keinen Titel (z. B. nur
   * "Mengenangaben:"), dann wird nur geprüft, dass der geparste Titel kein
   * Listen-/Werbetext ist.
   */
  title: string | null;
  servings?: number | null;
  /** Obergrenze bei Portionsspannen ("für 4–6 Portionen") */
  servingsMax?: number | null;
  ingredients: CorpusIngredient[];
  /**
   * Anzahl der Zeilen, die ein Mensch als Anweisung befolgen würde.
   * Back-/Temperaturhinweise zählen mit, Nährwerte/Werbung/Hashtags nicht.
   */
  stepsCount: number;
}

export interface CorpusFixture {
  id: string;
  source: string;
  account?: string;
  language?: "de" | "en";
  /** Freie Beschreibung des Caption-Stils, z. B. "emoji-sections+asterisk-bullets+nutrition" */
  style?: string;
  /** Caption wörtlich, inklusive Emojis, Bullets und Zeilenumbrüchen */
  caption: string;
  expected: CorpusExpected;
  /**
   * Negativfall: Die Caption enthält gar kein Rezept (nur Werbung/DM-Gate).
   * Bewertet wird dann nur, dass der Parser nichts erfindet.
   */
  negative?: boolean;
  /**
   * Grund, warum dieses Fixture NICHT in die Metriken eingeht. Nötig für
   * Fixtures aus der eigenen Bibliothek: dort ist die gespeicherte Fassung
   * teilweise übersetzt (Anzeige-Sprache) und damit keine gültige Wahrheit
   * für den Parser, der die Rohfassung liest.
   */
  exclude?: string;
  /**
   * Grund, warum die Erwartung an die Schrittzahl NICHT bewertet wird.
   * Beispiel: Die Caption enthält gar keine Anleitung – die gespeicherten
   * Schritte wurden von Hand ergänzt und sind damit keine Parser-Wahrheit.
   */
  stepsUnreliable?: string;
  /** Besonderheiten, die man beim Bewerten kennen muss */
  notes?: string;
}

/** Vom Parser gelieferte Zutat (reduziert auf die bewerteten Felder). */
export interface ActualIngredient {
  amount?: number;
  unit?: string;
  name: string;
}

export interface ActualRecipe {
  title: string;
  servings?: number;
  ingredients: ActualIngredient[];
  steps: string[];
  /** Name der Strategie, die das Ensemble gewählt hat (nur für den Report) */
  strategy?: string;
}
