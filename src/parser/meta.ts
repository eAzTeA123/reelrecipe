const SERVINGS_RES = [
  /(?:serves?|servings?|yields?|ergibt|portionen?|portion)\s*[:=-]?\s*(?:about\s*|ca\.?\s*)?(\d{1,2})/i,
  /(?:für|for)\s*(?:ca\.?\s*|about\s*|approximately\s*)?(\d{1,2})\s*(?:portionen?|pers(?:onen)?\.?|servings?|people|persons|stücke?|tacos?|portion|stück|person)\b/i,
  /(\d{1,2})\s*(?:portionen?|pers(?:onen)?\.?|servings?|people|persons)\b/i,
];

const HOUR_MIN = /(?<![\p{L}])(\d{1,3})\s*(?:h|std\.?|stunden?|hours?|hrs?)(?![\p{L}])(?:\s*(\d{1,2})\s*(?:min\.?|minuten?|minutes?)(?![\p{L}]))?/iu;
const MIN_ONLY = /(?<![\p{L}])(\d{1,3})\s*(?:min\.?|minuten?|minutes?)(?![\p{L}])/iu;
const TIME_LABEL = /(zeit|time|dauer|prep(?:aration)?\s*time|vorbereitungs?zeit|cook\s*time|kochzeit|backzeit|bake\s*time|gesamt|total|⏱)/i;
const PREP_LABEL = /(prep(?:aration)?\s*time|vorbereitungs?zeit|vorbereitung|arbeitszeit)/i;

export function parseServings(lines: string[]): number | undefined {
  for (const line of lines) {
    for (const re of SERVINGS_RES) {
      const m = line.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= 60) return n;
      }
    }
  }
  return undefined;
}

function parseMinutes(m: RegExpMatchArray): number | undefined {
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const total = m[0].match(/h|std|stund|hour|hr/i) ? h * 60 + min : h;
  return total > 0 && total < 24 * 60 ? total : undefined;
}

const STEP_LINE = /^(?:schritt\s+)?\d{1,2}\s*[.)\]]\s/i;

export function parseTimes(lines: string[]): { prepTime?: number; cookTime?: number } {
  let prepTime: number | undefined;
  let cookTime: number | undefined;
  for (const line of lines) {
    if (!/\d/.test(line)) continue;
    if (STEP_LINE.test(line)) continue;
    const labeled = TIME_LABEL.test(line);
    const m =
      line.match(HOUR_MIN) ?? (labeled || line.length < 40 ? line.match(MIN_ONLY) : null);
    if (!m) continue;
    const minutes = parseMinutes(m);
    if (!minutes) continue;
    if (PREP_LABEL.test(line)) prepTime = minutes;
    else cookTime = minutes;
  }
  return { prepTime, cookTime };
}

const TITLE_BAD = /^(rezept|recipe|hier ist|das hier|dieses|heute|neu)/i;

/** Phrasen, die NICHT als Titel taugen (TikTok/Insta Intro-Boilerplate) */
const TITLE_STRIP_PHRASES = [
  // DE Intro-Phrasen
  /^(?:hier\s+(?:steht|ist|kommt)\s+(?:das\s+)?rezept)\s*/i,
  /^(?:zum\s+rezept)\s*/i,
  /^(?:das\s+(?:komplette\s+)?rezept\s+(?:für\s+euch|steht\s+hier))\s*/i,
  /^(?:hier\s+(?:ist|für)\s+(?:euch|dich))\s*/i,
  
  // EN Intro-Phrasen
  /^(?:here(?:'s|\s+is)\s+(?:the\s+)?recipe)\s*/i,
  /^(?:recipe\s+(?:below|here))\s*/i,
  /^(?:full\s+recipe)\s*/i,
  
  // Social CTAs (am Ende)
  /\s*(?:(?:noch\s+)?mehr\s+(?:rezepte?\s+)?(?:bei|auf|gibts?|findest?\s+du)\s+(?:ig|insta(?:gram)?|tiktok)\s*[:\s]*\S+)\s*$/i,
  /\s*(?:follow\s+(?:me\s+)?(?:on|@)\s*\S+)\s*$/i,
  /\s*(?:folg[te]?\s+(?:mir|uns)\s+(?:auf|bei|@)\s*\S+)\s*$/i,
  
  // Pfeil-Emojis und "nach unten"-Hinweise
  /\s*[⬇️👇⤵️↓🔽]\uFE0F?\s*/gu,
];

/** Bereinigt einen Titel-Kandidaten von Intro-Boilerplate */
export function cleanTitle(raw: string): string {
  let t = raw;
  for (const re of TITLE_STRIP_PHRASES) {
    t = t.replace(re, "").trim();
  }
  // Trailing Emojis entfernen
  t = t.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s]+$/u, "").trim();
  // Leading Emojis entfernen (wenn nur noch Emojis + kurzer Text übrig)
  t = t.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/gu, "").trim();
  return t;
}

/** Erste sinnvolle Zeile als Titel: keine Überschrift, keine Zutat, 2–80 Zeichen. */
export function pickTitle(
  preambleLines: string[],
  isSectionHeader: (l: string) => boolean,
): string | undefined {
  for (const line of preambleLines) {
    const l = line.trim();
    if (l.length < 3 || l.length > 80) continue;
    if (isSectionHeader(l)) continue;
    if (/^\d/.test(l)) continue;
    
    const cleaned = cleanTitle(l);
    // Nach dem Bereinigen zu kurz? → Nächste Zeile versuchen
    if (cleaned.length < 3) continue;
    // Nur Intro-Text, kein richtiger Titel? → Skip
    if (TITLE_BAD.test(cleaned) && cleaned.length < 20) continue;
    
    return cleaned;
  }
  return undefined;
}
