export function debugTokenize(caption: string) {
  let normalized = caption.replace(/\r?\n|\u2028|\u2029/g, "\n");

  normalized = normalized
    .replace(/(?:[\p{Emoji_Presentation}\u{FE0F}\u{200D}]+)\s*$/u, "")
    .replace(/(?:#\w+\s*)+$/i, "");
    
  console.log("0:", normalized);

  normalized = normalized
    .replace(/(Für\s*\d+\s*(?:Stück|Portionen?|Personen?):?)/gi, "\n$1\n")
    .replace(/(\b(?:Für\s*(?:den|die|das|diese|alle)|\bFor\s*(?:the|this))\s+[a-zA-ZäöüÄÖÜß\-]+)(?=:|\s+(?=-|•|\*|\d|ca|etwa))/gi, "\n$1:\n")
    .replace(/((?:Helle|Dunkle|Süße|Saure|Vegane|Frische|Warme|Kalte)?\s*(?:Sauce|Soße|Teig|Dip|Topping|Creme|Füllung|Garnitur|Boden|Dressing))\s*:/gi, "\n$1:\n");
  console.log("3:", normalized);

  normalized = normalized.replace(/(Zutaten|Ingredients|Zubereitung|Instructions|Directions|Schritte|Anleitung|So geht'?s|So wird'?s gemacht|Wir brauchen|Du brauchst|Das brauchst du|Dafür brauchst du|Was (?:du|ihr) braucht)(?::|\s+(?=-|•|\*|\d|[\p{Emoji_Presentation}\p{Extended_Pictographic}]))/gi, "\n$1:\n");
  console.log("4:", normalized);

  normalized = normalized.replace(/(?<=[a-zäöüß])\s+(?=(?:Die|Der|Das|Den|Dem|Alles|Dann|Danach|Zuerst|Zum|Zur|Schließlich|Nun|Anschließend|Zubereitung|Für|Mit|Dazu|Hierfür|Dabei|Sobald|Wenn|Während|Dafür|Unter|Auf|In|Aus|Bei)\b)/g, "\n");
  console.log("7b:", normalized);
}

debugTokenize('In der Zeit für die helle Sauce die Zutaten einfach verrühren.');
