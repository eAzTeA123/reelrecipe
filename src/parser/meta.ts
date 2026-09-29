import { looksLikeIngredient } from "./ingredient";

const SERVINGS_RES = [
  // "Pro Portion (1/4)" → 4 Portionen
  /\bpro\s+portion\s*\(?\s*1\s*\/\s*(\d{1,2})\s*\)?/i,
  /(?:serves?|servings?|yields?|ergibt|portionen?|portion)\s*[:=-]?\s*(?:about\s*|ca\.?\s*)?(\d{1,2})/i,
  /(?:für|for)\s*(?:ca\.?\s*|about\s*|approximately\s*)?(\d{1,2})\s*(?:portionen?|pers(?:onen)?\.?|servings?|people|persons|stücke?|tacos?|portion|stück|person)\b/i,
  /(\d{1,2})\s*(?:portionen?|pers(?:onen)?\.?|servings?|people|persons)\b/i,
];

const HOUR_MIN = /(?<![\p{L}])(\d{1,3})\s*(?:h|std\.?|stunden?|hours?|hrs?)(?![\p{L}])(?:\s*(\d{1,2})\s*(?:min\.?|minuten?|minutes?)(?![\p{L}]))?/iu;
const MIN_ONLY = /(?<![\p{L}])(\d{1,3})\s*(?:min\.?|minuten?|minutes?)(?![\p{L}])/iu;
const TIME_LABEL = /(zeit|time|dauer|prep(?:aration)?\s*time|vorbereitungs?zeit|cook\s*time|kochzeit|backzeit|bake\s*time|gesamt|total|⏱)/i;
const PREP_LABEL = /(prep(?:aration)?\s*time|vorbereitungs?zeit|vorbereitung|arbeitszeit)/i;

/**
 * Ertragszeile ("(9 „Stück“)", "Für 4 Stück:", "Ergibt 12 Stück").
 * Bewusst streng: "4 Stück Eier" ist eine Zutat, keine Portionsangabe.
 */
const YIELD_LINE_RES = [
  /^\s*\(?\s*(?:für|ergibt|reicht für|bei|pro)?\s*(\d{1,2})\s*[„“"'’]?\s*(?:stücke?|stk\.?)\s*[)\]"„“'’]*\s*:?\s*$/iu,
  /^\s*\(?\s*(?:für|ergibt|reicht für|bei|pro)\s*(\d{1,2})\s*(?:portionen?|personen?|pers\.?)\s*[)\]]*\s*:?\s*$/iu,
];

export function parseServings(lines: string[]): number | undefined {
  for (const line of lines) {
    // Ertragszeilen zuerst: sie sind eindeutig und stehen oft vor der Zutatenliste
    for (const re of YIELD_LINE_RES) {
      const m = line.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= 60) return n;
      }
    }
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

const TITLE_BAD = /^(rezept|recipe|hier ist|das hier|dieses|heute|neu\b|wenn\b|falls\b|rabattcode\b|\*?anzeige\b|\*?werbung\b|werbung\b)/i;

/** Menge + Einheit mitten in der Zeile → das ist eine Zutatenzeile, kein Titel. */
const INGREDIENT_AMOUNT_RE =
  /\d+[.,]?\d*\s*(?:g|gr|gramm|ml|kg|l|el|tl|stück|stk|packung|dose|zehe|scheibe|prise|bund|handvoll|zweig|blatt|kopf|glas|becher|cup|oz|lb)\b/i;

/**
 * Taugt die Zeile als Rezepttitel? Zutatenzeilen, Aufzählungen, Klammer-Notizen,
 * Portionsangaben und Werbetext sind keine Titel – sonst landet "1 großer Apfel"
 * oder "( für 800g Futter )" als Rezeptname in der App.
 */
/**
 * Werbetext, der einen Titel disqualifiziert. Bewusst enger als `isPromoLine`:
 * "Tacos zum Abnehmen" ist ein Rezeptname, "Rabattcode: NOEL" nicht.
 */
const TITLE_PROMO_RE =
  /\b(?:prozis|rabattcode|rabatte?|gutschein|werbung|anzeige|folge mir|folgt mir|gratis|unterstützen|link in bio)\b/i;

/** Wörter, die als Rezepttitel nie taugen (Abschnitts- und Struktur-Marker) */
const TITLE_MARKER_RE =
  /^(?:zutaten|zutatenliste|zubereitung|anleitung|nährwerte|naehrwerte|portionen|mengenangaben|belag|topping|sauce|soße|dressing|für den|für die|für das|for the|ingredients?|instructions?|method|steps?)\b/i;

/** Ansprache/Marketing – ein Satz, kein Rezeptname */
const TITLE_SENTENCE_RE = /\b(?:ich|wir|du|dir|dich|wenn|falls|folge|folgt|speichere|teste|probiert|schau|check|save)\b/i;

export function isPlausibleTitle(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 80) return false;
  // Reine Klammerzeile ("(9 Stück)", "(Werbung)") ist kein Titel – ein Titel
  // MIT Klammerzusatz ("Flammkuchen (Chicken)") dagegen schon.
  if (/^[(\[{][^)\]}]*[)\]}]*\s*$/.test(t)) return false;
  // Aufzählungszeichen oder Nummer am Anfang – aber ein führendes Emoji ist okay
  // ("🌮 HIGH PROTEIN TACOS" ist ein Titel, "✖️ 1g Salz" nicht: das fängt die Mengen-Regel).
  if (/^[-–—•·*+~›»]/.test(t) || /^\d/.test(t)) return false;
  if (INGREDIENT_AMOUNT_RE.test(t)) return false;
  if (/^(?:für|pro|je)\s/i.test(t)) return false;
  if (/[,\-:;]$/.test(t)) return false;
  const cleaned = cleanTitle(t);
  if (cleaned.length < 3) return false;
  if (TITLE_BAD.test(cleaned)) return false;
  if (TITLE_MARKER_RE.test(cleaned)) return false;
  // Marketingsatz statt Rezeptname ("Ich teste jede Woche …", "Wenn du …")
  if (cleaned.length > 40 && TITLE_SENTENCE_RE.test(cleaned)) return false;
  if (TITLE_PROMO_RE.test(t)) return false;
  if (looksLikeIngredient(t) >= 6) return false;
  return true;
}

/** Phrasen, die NICHT als Titel taugen (TikTok/Insta Intro-Boilerplate) */
const TITLE_STRIP_PHRASES = [
  // DE Intro-Phrasen
  /^(?:hier\s+(?:steht|ist|kommt)\s+(?:das\s+)?rezept)\s*/i,
  /^(?:zum\s+rezept)\s*/i,
  /^(?:das\s+(?:komplette\s+|ganze\s+)?rezept\s*(?::|für\s+euch|steht\s+hier)?)\s*/i,
  /^(?:hier\s+(?:ist|für)\s+(?:euch|dich))\s*/i,
  
  // EN Intro-Phrasen
  /^(?:here(?:'s|\s+is)\s+(?:the\s+)?recipe)\s*/i,
  /^(?:recipe\s+(?:below|here|in the comments))\s*/i,
  /^(?:full\s+recipe)\s*/i,
  
  // Social CTAs (am Ende)
  /\s*(?:(?:noch\s+)?mehr\s+(?:rezepte?\s+)?(?:bei|auf|gibts?|findest?\s+du)\s+(?:ig|insta(?:gram)?|tiktok)\s*[:\s]*\S+)\s*$/i,
  /\s*(?:follow\s+(?:me\s+)?(?:on|@)\s*\S+)\s*$/i,
  /\s*(?:folg[te]?\s+(?:mir|uns)\s+(?:auf|bei|@)\s*\S+)\s*$/i,
  
  // Pfeil-Emojis und "nach unten"-Hinweise
  /\s*[⬇️👇⤵️↓🔽]\uFE0F?\s*/gu,
];

/** Bereinigt einen Titel-Kandidaten von Intro-Boilerplate und kürzt überlange Titel intelligent */
export function cleanTitle(raw: string): string {
  let t = raw;
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of TITLE_STRIP_PHRASES) {
      const match = t.match(re);
      if (match) {
        t = t.replace(re, "").trim();
        changed = true;
      }
    }
    // Leading Emojis und Sonderzeichen entfernen
    const noLeading = t.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s*\|:-]+/gu, "").trim();
    if (noLeading !== t) {
      t = noLeading;
      changed = true;
    }
  }

  // Trailing Emojis entfernen
  t = t.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s]+$/u, "").trim();

  // Werbung / Anzeige Marker entfernen (z.B. "*Anzeige Churros sind lecker", "*ANZElGE")
  t = t.replace(/\*?an[zs]e[il1|]ge\s*[:|-]?\s*/gi, "").trim();

  // Smart Truncation: Wenn der Titel extrem lang ist (Fließtext), ersten sinnvollen Satz nehmen
  if (t.length > 70) {
    const sentences = t.split(/[.!?|]/).map(s => s.trim()).filter(s => s.length > 5);
    const blacklist = /recipe in the comments|tarif yorumlarda/i;
    // Ersten Satz nehmen, der nicht auf der Blacklist steht
    const best = sentences.find(s => !blacklist.test(s));
    if (best) {
      t = best;
    } else if (sentences.length > 0) {
      t = sentences[0];
    }
  }

  // Harter Cut für die UI
  if (t.length > 80) {
    t = t.slice(0, 77).trim() + "...";
  }

  return t;
}

/**
 * Titel aus einer Marketing-Headline ableiten:
 * "Die beste Lasagne-Suppe aller Zeiten: Der Party-Trend …" → "Lasagne-Suppe".
 */
export function extractTitleFromHeadline(line: string): string | undefined {
  const head = line.split(/[!:?]|\s+–\s+|\s+-\s+/)[0]?.trim();
  if (!head) return undefined;

  let candidate = head.replace(
    /^(?:die|der|das|mein|meine|unser|unsere)\s+(?:beste[nrs]?|leckerste[nrs]?|einfachste[nrs]?|schnellste[nrs]?|gesündeste[nrs]?|cremigste[nrs]?)\s+/i,
    "",
  );
  candidate = candidate.replace(/\s+(?:aller\s+zeiten|überhaupt|ever)$/i, "").trim();

  if (candidate.split(/\s+/).filter(Boolean).length > 6) return undefined;
  const cleaned = cleanTitle(candidate);
  return isPlausibleTitle(cleaned) ? cleaned : undefined;
}

/** Erste sinnvolle Zeile als Titel: keine Überschrift, keine Zutat, 2–80 Zeichen. */
export function pickTitle(
  preambleLines: string[],
  isSectionHeader: (l: string) => boolean,
): string | undefined {
  for (const line of preambleLines) {
    const l = line.trim();
    if (l.length < 3 || l.length > 80) continue;
    if (isSectionHeader(l)) break;

    const cleaned = cleanTitle(l);
    if (!isPlausibleTitle(cleaned)) continue;

    return cleaned;
  }
  return undefined;
}
