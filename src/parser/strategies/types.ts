export interface RawParseResult {
  title: string;
  ingredients: string[];
  /**
   * Zur Zutatenliste **index-gleich**: die Gruppe, zu der die jeweilige Zeile
   * gehört („Teig", „Belag"). Strategien, die keine Gruppen erkennen, lassen das
   * Feld weg – dann verhalten sie sich wie bisher.
   */
  ingredientGroups?: (string | undefined)[];
  steps: string[];
  other: string[];
  confidence: number;
  strategy: string;
}

export interface ParserStrategy {
  name: string;
  parse(caption: string): RawParseResult;
}
