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

/**
 * Anpreisungen am **Anfang** eines Titels („Geiler Flammkuchen" → „Flammkuchen").
 *
 * Bewusst nur am Anfang: mitten im Titel beschreibt so ein Wort das Gericht
 * („Cremige Gochujang-Linsen") und bleibt stehen. Ebenso bleiben Ernährungs- und
 * Zubereitungsangaben („High Protein", „Low Carb", „Bulking", „One Pot") – sie
 * gehören für den Betreiber zum Rezept. Freigegeben am Beispiel
 * „🔥 Geiler Flammkuchen" → „Flammkuchen".
 */
const TITLE_PRAISE_PHRASE_RE =
  /^(?:das\s+sind\s+(?:mit\s+abstand\s+)?die\s+besten|mit\s+abstand\s+die\s+besten|die\s+besten|die\s+beste|der\s+beste|das\s+beste)\s+/i;

/** Einzelne Anpreisungen – werden mehrfach angewandt („Mega geiler Flammkuchen"). */
const TITLE_PRAISE_WORD_RE =
  /^(?:beste[nrs]?|leckerste[nrs]?|lecker(?:e|er|es|en)?|geil(?:e|er|es|en)?|mega|super|ultra|hammer|krass(?:e|er)?|perfekt(?:e|er)?|schnellste[nrs]?|einfachste[nrs]?|cremigste[nrs]?|gesündeste[nrs]?|saftigste[nrs]?)\s+/i;

/** Nutzen-Floskeln am **Ende**: kein Titel, sondern ein Versprechen. */
const TITLE_BENEFIT_RE = /\s*(?:zum\s+abnehmen|für\s+die\s+figur|aller\s+zeiten|überhaupt|der\s+welt|ever)\s*$/i;

/** Hinweisende Fürwörter am Anfang: „Dieser herzhafte Ofenpfannkuchen" → „Herzhafte Ofenpfannkuchen" */
const TITLE_DEMONSTRATIVE_RE = /^(?:dieser|diese|dieses|diesen|diesem|das\s+ist|hier\s+ist|so\s+geht)\s+/i;

/** Emojis samt Varianten-Selektoren und Hautton-Modifier (sonst bleibt „🏻" stehen). */
const TITLE_EMOJI_LEAD_RE = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\s*|:-]+/gu;
const TITLE_EMOJI_TRAIL_RE = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\s]+$/u;

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
    const noLeading = t.replace(TITLE_EMOJI_LEAD_RE, "").trim();
    if (noLeading !== t) {
      t = noLeading;
      changed = true;
    }
  }

  // Trailing Emojis entfernen (samt Hautton-Modifier: „Zitronenkuchen☝🏽")
  t = t.replace(TITLE_EMOJI_TRAIL_RE, "").trim();

  // Werbung / Anzeige Marker entfernen (z.B. "*Anzeige Churros sind lecker", "*ANZElGE")
  t = t.replace(/\*?an[zs]e[il1|]ge\s*[:|-]?\s*/gi, "").trim();

  // Anpreisungen am Anfang und Nutzen-Floskeln am Ende entfernen.
  // Die Schleife fängt Ketten ab: „Mega geiler Flammkuchen" → „Flammkuchen".
  let trimmed = true;
  while (trimmed) {
    trimmed = false;
    for (const re of [TITLE_PRAISE_PHRASE_RE, TITLE_PRAISE_WORD_RE, TITLE_DEMONSTRATIVE_RE]) {
      const next = t.replace(re, "").trim();
      if (next !== t) {
        t = next;
        trimmed = true;
      }
    }
  }
  t = t.replace(TITLE_BENEFIT_RE, "").trim();

  // Nach dem Abschneiden beginnt der Titel wieder mit einem Großbuchstaben
  if (t.length > 1 && /^[a-zäöüß]/.test(t)) t = t.charAt(0).toUpperCase() + t.slice(1);

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
 * Titel aus einer Marketing-Headline ableiten.
 *
 * Zwei Fälle, beide aus echten Captions belegt:
 * - „Die beste Lasagne-Suppe aller Zeiten: Der Party-Trend …" → „Lasagne-Suppe"
 *   (Gericht steht **vor** dem Doppelpunkt)
 * - „Wenn's schnell gehen muss …: Dieser herzhafte Ofenpfannkuchen" →
 *   „Herzhafte Ofenpfannkuchen" (Gericht steht **hinter** dem Doppelpunkt)
 *
 * Deshalb werden beide Seiten geprüft und die brauchbarere gewählt: keine
 * Ansprache („wenn", „du", „muss"), höchstens sechs Wörter, und bei Gleichstand
 * die kürzere Fassung.
 */
export function extractTitleFromHeadline(line: string): string | undefined {
  // Werbe-Zeilen sind als Titelquelle unbrauchbar – auch der Teil hinter einem
  // Doppelpunkt. Ohne diese Prüfung auf der **ganzen** Zeile wurde aus
  // „Rabattcode: ❗️👉🏼NOEL👈🏼❗️" der Titel „NOEL" (gemessen).
  // Achtung: NICHT die Zeile mit `TITLE_BAD` prüfen – die fängt „Wenn's …" ab
  // und würde genau die Headlines verwerfen, deren Gericht hinter dem
  // Doppelpunkt steht. `TITLE_BAD` gilt für den Kandidaten (in `isPlausibleTitle`).
  if (TITLE_PROMO_RE.test(line)) return undefined;

  const parts = line
    .split(/[:!?]|\s+–\s+|\s+-\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);
  if (parts.length === 0) return undefined;

  // **Alle** Teile prüfen, nicht nur den ersten und letzten: In echten Headlines
  // steht das Gericht oft in der Mitte, eingerahmt von Ansprache und Behauptung
  // („Wenn's schnell gehen muss …: Dieser herzhafte Ofenpfannkuchen ist ein
  // absoluter Gamechanger! Und zudem …").
  let best: { text: string; score: number } | undefined;

  for (const part of parts) {
    // Behauptungen abschneiden: „<Gericht> ist/schmeckt/wird <Versprechen>"
    const withoutClaim = part.split(/\s+(?:ist|sind|war|waren|bleibt|wird|schmeckt|schmecken)\s+/i)[0] ?? part;
    const cleaned = cleanTitle(withoutClaim);
    if (cleaned.length < 3) continue;
    // Ein einzelnes Kürzel in Großbuchstaben ist ein Code, kein Gericht.
    if (!cleaned.includes(" ") && /^[A-ZÄÖÜ0-9!?&.\-]+$/.test(cleaned)) continue;
    const words = cleaned.split(/\s+/).filter(Boolean).length;
    if (words > 6) continue;
    // Marketingsatz statt Gericht ("Wenn's schnell gehen muss …")
    if (TITLE_SENTENCE_RE.test(cleaned)) continue;
    if (!isPlausibleTitle(cleaned)) continue;
    // Kürzere Fassungen sind eher ein Gericht als ein Satz
    const score = 7 - words;
    if (!best || score > best.score) best = { text: cleaned, score };
  }

  return best?.text;
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
