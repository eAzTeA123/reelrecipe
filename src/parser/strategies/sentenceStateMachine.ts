import { lineStateMachineStrategy } from "./lineStateMachine";
import type { ParserStrategy, RawParseResult } from "./types";

/**
 * Zerlegt einen Fließtext ohne verlässliche Zeilenumbrüche in logische Satz-/Listen-Segmente.
 * Berücksichtigt Emojis, Bulletpoints, Nummerierungen und Satzzeichen.
 */
export function tokenizeSentences(text: string): string[] {
  let normalized = text
    // Abschnitte trennen
    .replace(/(Zutaten|Ingredients|Zubereitung|Instructions|Directions|Schritte|Anleitung)[:\s]/gi, "\n$1:\n")
    // Emojis trennen
    .replace(/([🛒🥣🥕🥑🧀🥩🥔🥚👩‍🍳👨‍🍳🍳🔪🥘🔥🍲📝])/g, "\n$1\n")
    // Zeilenumbrüche vor Bullets
    .replace(/([•\-*])/g, "\n$1")
    // Vor Zutaten-Mengen trennen (z. B. "Hähnchenbrust 2 Wraps 1 Tomate 50g geriebener Käse")
    .replace(/(?<=[a-zA-ZäöüÄÖÜß])\s+(?=\d+\s*(?:g|kg|ml|l|el|tl|tbsp|tsp|cup|cups|slices|scheiben|stk|stück|wraps|tomaten|\b))/gi, "\n")
    // Vor Schritt-Nummerierungen trennen (z. B. "anbraten. 2. Tomaten schneiden")
    .replace(/(?<=[a-zA-ZäöüÄÖÜß.!?])\s*(\d+[.)]\s+)/g, "\n$1")
    // Satzenden gefolgt von Großbuchstaben
    .replace(/([.!?])\s+(?=[A-ZÄÖÜ])/g, "$1\n");

  return normalized
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const sentenceStateMachineStrategy: ParserStrategy = {
  name: "sentence_state_machine",
  parse(caption: string): RawParseResult {
    const sentences = tokenizeSentences(caption);
    const simulatedText = sentences.join("\n");
    const result = lineStateMachineStrategy.parse(simulatedText);
    return {
      ...result,
      strategy: "sentence_state_machine",
    };
  },
};
