import { lineStateMachineStrategy } from "./lineStateMachine";
import type { ParserStrategy, RawParseResult } from "./types";

/**
 * Zerlegt einen Fließtext ohne verlässliche Zeilenumbrüche in logische Satz-/Listen-Segmente.
 * Berücksichtigt Emojis, Bulletpoints, Nummerierungen und Satzzeichen.
 */
export function tokenizeSentences(text: string): string[] {
  const normalized = text
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
    .replace(/(😍|⭐️|✨|🌮|🍕)/gu, "\n")
    // 3. "Für X Stück:" oder "Pro Portion:" als eigenständigen Header isolieren
    .replace(/((?:Für|Ergibt|Reicht für|Bei|Pro|Du hast direkt)\s*(?:ca\.\s*)?(?:\d+\s+)?(?:Stück|Portion(?:en)?|Person(?:en)?|Tacos?|Pancakes?):?)/gi, "\n$1\n")
    // 3b. "Für den/die/das..." Sub-Header isolieren (nur wenn Doppelpunkt oder Zutaten-Anfang folgt)
    .replace(/(\b(?:Für\s*(?:den|die|das|diese|alle)|\bFor\s*(?:the|this))\s+[a-zA-ZäöüÄÖÜß\-]+)(?=:|\s+(?=-|•|\*|\d|ca|etwa))/gi, "\n$1:\n")
    // 3c. Typische Sub-Header ohne "Für" isolieren (z.B. "Helle Sauce:")
    .replace(/(?<!\b(?:den|die|das|diese|alle|zubereitung|zutaten)\s+)\b([a-zA-ZäöüßÄÖÜ\-]*(?:Sauce|Soße|Teig|Dip|Topping|Creme|Füllung|Garnitur|Boden|Dressing))\s*:/gi, "\n$1:\n")
    // 4. Abschnitte trennen (inklusiver typischer TikTok/Insta-Redewendungen)
    .replace(/(Zutaten|Ingredients|Zubereitung|Instructions|Directions|Schritte|Anleitung|So geht'?s|So wird'?s gemacht|Wir brauchen|Du brauchst|Das brauchst du|Dafür brauchst du|Was (?:du|ihr) braucht)(?:\s+[a-zA-ZäöüßÄÖÜ\-]+)?(?::|\s+(?=-|•|\*|\d|[\p{Emoji_Presentation}\p{Extended_Pictographic}]))/giu, "\n$&\n")
    // 5. Section-Emojis trennen
    .replace(/(🛒|🥣|🥗|👩‍🍳|👨‍🍳|📝)/gu, "\n$1\n")
    // 6. Zeilenumbrüche vor Bullets (z. B. "Sojajoghurt- Saft", "Tomaten- 250g", aber NICHT bei "Zitronen-Minz-Joghurt" oder "45-50")
    .replace(/(?<=[a-zA-ZäöüÄÖÜß0-9,])\s+-(?=\s*(?:\d|[A-ZÄÖÜ]))|(?<=[a-zA-ZäöüÄÖÜß,])-(?=\s*\d)/g, "\n- ")
    .replace(/(?<=\s)[•*–—✳✅👉📍]\uFE0F?\s*|(?<=\s)-+\s+/gu, "\n- ")
    // 6b. Vor beliebigen grafischen Emojis trennen, aber NUR wenn sie als Aufzählung dienen (gefolgt von Zahl oder großem Buchstabe)
    .replace(/(?<=[a-zA-ZäöüÄÖÜß0-9,:.!?])\s+(?=\p{Emoji_Presentation}\s*(?:\d|[A-ZÄÖÜ]|ca\.?\s*\d))/gu, "\n")
    // 7. Vor Zutaten-Mengen trennen (nur wenn gefolgt von Einheit/Lebensmittel, NIEMALS bei "Minuten" oder nach typischen Präpositionen)
    .replace(/(?<=[a-zA-ZäöüÄÖÜß:,])(?<!\b(?:in|den|dem|die|das|der|mit|und|oder|zu|im|am|auf|aus|bei|von|für|for|and|with|to|etwa|ca)\b)\s+(?=(?:\d+(?:[.,]\d+)?(?:[\s-]*1\/\d+)?|\d+[\s-]*\/\s*\d+|½|¼|¾|⅓|⅔|⅛|⅜|⅝|⅞)\s*(?:[a-zA-ZäöüÄÖÜß-]+\s*){0,2}(?:g|kg|ml|l|el|tl|tbsp|tsp|cup|cups|slices|scheiben|stk|stück|st|wraps|block|packung|pck|dose|glas|zehe|zehen|tomaten?|zwiebeln?|zehen?|knoblauch|paprika|spitzpaprika|brokkoli|möhren?|karotten?|äpfel|apfel|eier?|kartoffeln?|putenschnitzel|schnitzel|gurke|zucchini|aubergine|pilze|champignons|salat|ajvar|paprikapulver)\b)/gi, "\n")
    // 7b. Vor typischen Satzanfängen trennen, falls sie direkt (ohne Punkt) auf ein kleingeschriebenes Wort folgen
    .replace(/(?<=[a-zäöüßy])\s+(?=(?:Die|Der|Das|Den|Dem|Alles|Dann|Danach|Zuerst|Zum|Zur|Schließlich|Nun|Anschließend|Zubereitung|Für|Mit|Dazu|Hierfür|Dabei|Sobald|Wenn|Während|Dafür|Preheat|Bake|Place|Add|Stir|Flake|Season|Pour|Cook|Heat)\b)/g, "\n")
    // 8. Echte Satzgrenzen trennen (Punkt/Ausrufezeichen/Fragezeichen gefolgt von Großbuchstaben)
    // ABER NICHT nach "ca.", "z.B.", "bzw." etc.
    .replace(/(?<!\b(?:ca|bzw|inkl|max|min|usw)\.)(?<=[.!?])\s+(?=[A-ZÄÖÜ\d])/g, "\n")
    // 9. Vor Schritt-Nummerierungen trennen (z. B. "anbraten. 2. Tomaten schneiden")
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
