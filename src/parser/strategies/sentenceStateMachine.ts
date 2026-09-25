import { lineStateMachineStrategy } from "./lineStateMachine";
import type { ParserStrategy, RawParseResult } from "./types";

/**
 * Zerlegt einen Fließtext ohne verlässliche Zeilenumbrüche in logische Satz-/Listen-Segmente.
 * Berücksichtigt Emojis, Bulletpoints, Nummerierungen und Satzzeichen.
 */
export function tokenizeSentences(text: string): string[] {
  let normalized = text
    // 1. Zuerst Keycap Emojis (1️⃣ 2️⃣ 3️⃣...) sauber in standardisierte Schritte umwandeln
    .replace(/1(?:\uFE0F)?\u20E3/g, "\n1. ")
    .replace(/2(?:\uFE0F)?\u20E3/g, "\n2. ")
    .replace(/3(?:\uFE0F)?\u20E3/g, "\n3. ")
    .replace(/4(?:\uFE0F)?\u20E3/g, "\n4. ")
    .replace(/5(?:\uFE0F)?\u20E3/g, "\n5. ")
    .replace(/6(?:\uFE0F)?\u20E3/g, "\n6. ")
    .replace(/7(?:\uFE0F)?\u20E3/g, "\n7. ")
    .replace(/8(?:\uFE0F)?\u20E3/g, "\n8. ")
    .replace(/9(?:\uFE0F)?\u20E3/g, "\n9. ")
    // 2. Trennung bei markanten Deko-Emojis (z.B. 😍 ⭐️ 🔥)
    .replace(/([😍⭐️✨🌮🍕])/gu, "\n")
    // 3. "Für X Stück:" oder "Für X Portionen:" als eigenständigen Header isolieren
    .replace(/(Für\s*\d+\s*(?:Stück|Portionen?|Personen?):?)/gi, "\n$1\n")
    // 3b. "Für den/die/das..." Sub-Header isolieren (auch wenn an Text angeklebt)
    .replace(/((?:Für\s*(?:den|die|das|diese|alle)|\bFor\s*(?:the|this))\s+[a-zA-ZäöüÄÖÜß\-]+(?:\s+[a-zA-ZäöüÄÖÜß\-]+)?:?)/gi, "\n$1\n")
    // 4. Abschnitte trennen
    .replace(/(Zutaten|Ingredients|Zubereitung|Instructions|Directions|Schritte|Anleitung)[:\s]/gi, "\n$1:\n")
    // 5. Emojis trennen
    .replace(/([🛒🥣🥕🥑🧀🥩🥔🥚👩‍🍳👨‍🍳🍳🔪🥘🔥🍲📝])/gu, "\n$1\n")
    // 6. Zeilenumbrüche vor Bullets (auch wenn ohne Leerzeichen an vorheriges Wort geklebt wie "Sojajoghurt- Saft")
    .replace(/(?<=[a-zA-ZäöüÄÖÜß0-9,])\s*-(?=\s*(?:\d|[A-ZÄÖÜ]))/g, "\n- ")
    .replace(/(?<=\s)[•*–—]\s*|(?<=\s)-+\s+/g, "\n- ")
    // 7. Vor Zutaten-Mengen trennen (nur wenn gefolgt von Einheit/Lebensmittel, NIEMALS bei "Minuten"!)
    .replace(/(?<=[a-zA-ZäöüÄÖÜß])\s+(?=\d+\s*(?:g|kg|ml|l|el|tl|tbsp|tsp|cup|cups|slices|scheiben|stk|stück|wraps|tomaten)\b)/gi, "\n")
    // 8. Vor Schritt-Nummerierungen trennen (z. B. "anbraten. 2. Tomaten schneiden")
    .replace(/(?<=[a-zA-ZäöüÄÖÜß.!?])\s*(\d+[.)]\s+)/g, "\n$1");

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
