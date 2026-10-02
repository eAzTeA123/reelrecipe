const UNICODE_FRACTIONS: Record<string, string> = {
  "¼": "1/4", "½": "1/2", "¾": "3/4",
  "⅐": "1/7", "⅑": "1/9", "⅒": "1/10",
  "⅓": "1/3", "⅔": "2/3",
  "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5",
  "⅙": "1/6", "⅚": "5/6",
  "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
};

/** Klassische Aufzählungszeichen und Satzzeichen, die Listenzeilen einleiten. */
const CLASSIC_BULLET_RE = /^[\s\-–—•·∙◦▪▫●○*+~›».'%✅👇]+/u;
/**
 * Emoji am Zeilenanfang – bewusst OHNE Ziffern, "#" und "*", denn die zählen in
 * Unicode ebenfalls als "Extended_Pictographic" und würden Mengen zerstören.
 */
const LEADING_EMOJI_RE =
  /^(?![\d#*])[\p{Extended_Pictographic}\p{Emoji_Presentation}][\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}\u200D]*(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}][\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}]*)*/u;

const HASHTAG_LINE_RE = /^(#\S+\s*)+$/;
const MENTION_LINE_RE = /^(@\S+\s*)+$/;

/**
 * Entfernt Aufzählungszeichen/Emojis am Zeilenanfang ("* 200 g Reis" → "200 g Reis",
 * "✖️ 1g Salz" → "1g Salz"). Zentrale Stelle, damit Zutaten-Erkennung und -Parsing
 * dieselben Zeichen kennen – Instagram nutzt ❌/✖️/🌶️ ebenso wie "-" oder "*".
 */
export function stripLeadingBullets(line: string): string {
  let l = line.trim();
  for (;;) {
    const before = l;
    l = l.replace(CLASSIC_BULLET_RE, "").trimStart();
    if (l !== before) continue;

    const emoji = l.match(LEADING_EMOJI_RE);
    if (emoji && emoji[0].length > 0) {
      l = l.slice(emoji[0].length).trimStart();
      continue;
    }
    break;
  }
  return l;
}

/**
 * Entfernt Variation-Selectors und Hautton-Modifier aus Emojis,
 * damit "👨🏻‍🍳" als Marker "👨‍🍳" erkannt wird.
 */
export function stripEmojiModifiers(text: string): string {
  return text.replace(/[\uFE0E\uFE0F]/gu, "").replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "");
}

/**
 * Wandelt Unicode-Brüche in ASCII um: „¼ TL" → „1/4 TL", „1½" → „1 1/2".
 * Eigene Funktion, weil auch **einzelne Zutatenzeilen** sie brauchen: Der
 * Seiten-Scraper übergibt Zeilen direkt an `parseIngredientLine`, und dort
 * scheiterte „¼ TL Salz" vorher (Menge blieb leer).
 */
export function normalizeFractions(text: string): string {
  let out = text;
  for (const [frac, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    out = out.replace(new RegExp(`(\\d)${frac}`, "g"), `$1 ${ascii}`);
    out = out.split(frac).join(ascii);
  }
  return out;
}

export function normalizeCaption(caption: string): string {
  let text = normalizeFractions(caption);
  
  // Break lines around common section markers if they are buried in text
  const R_COLON = /(?<![\p{L}])(du brauchst|zutaten|zubereitung|so gehts|so geht's|anleitung|ingredients|instructions|directions|method)(?:\s+[a-zA-ZäöüßÄÖÜ\-]+)?\s*:/giu;
  const R_NO_COLON = /(^|[.?!,]\s*|[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*)(du brauchst|zutaten|zubereitung|so gehts|so geht's|anleitung|ingredients|instructions|directions|method)\s+(?=\d|[•\-\*]|[\p{Emoji_Presentation}\p{Extended_Pictographic}])/giu;

  text = text.replace(R_COLON, "\n$&\n");
  text = text.replace(R_NO_COLON, "$1\n$2:\n");
  
  // Break lines before inline bullets (* or •)
  text = text.replace(/([^\n])\s+([*•])\s+/g, "$1\n$2 ");

  // Unicode-Schmuckschrift und Sonderformen auf ASCII bringen: Instagram nutzt
  // "𝙕𝙪𝙩𝙖𝙩𝙚𝙣"/"𝐇𝐢𝐠𝐡 𝐏𝐫𝐨𝐭𝐞𝐢𝐧" – ohne Normalisierung greifen weder Marker
  // noch Zutaten-Erkennung. Erst NACH der Bruch-Umwandlung, damit "½" erhalten bleibt.
  text = text.normalize("NFKC");

  return text;
}

/**
 * Zerlegt eine Caption in bereinigte Zeilen:
 * Unicode-Brüche → ASCII, Bullets/Emojis am Zeilenanfang entfernt,
 * reine Hashtag-/Mention-Zeilen und trailing Hashtags verworfen.
 */
export function splitLines(caption: string): string[] {
  const normalized = normalizeCaption(caption);
  return normalized
    .split(/\r?\n|\u2028|\u2029/)
    .map((line) => cleanLine(line))
    .filter((line) => line.length > 0);
}

export function cleanLine(line: string): string {
  let l = line.trim();
  // trailing Hashtags/Mentions am Zeilenende entfernen
  l = l.replace(/(\s[#@]\S+)+\s*$/, "");
  l = l.replace(/\s+/g, " ").trim();
  if (HASHTAG_LINE_RE.test(l) || MENTION_LINE_RE.test(l)) return "";
  // Ignore lines with no letters or numbers
  if (!/[\p{L}\d]/u.test(l)) return "";
  
  // Ignore specific trash phrases
  const trashPhrases = [
    /folg(e|t) mir/i,
    /f[üu]r mehr.*rezepte/i,
    /link in.*bio/i,
    /das ist so+ gut/i,
    /jeden abend/i,
    /abnehmrezepte/i,
    /digitale kochb[üu]cher/i,
    /du hast direkt/i,
    /speichern nicht vergessen/i,
    /klick auf/i,
    /lass ein abo da/i,
    /speicher.*rezept/i
  ];
  if (trashPhrases.some(re => re.test(l))) return "";

  // Ignore nutritional values (Bullet-Präfixe wie "* 46 g Protein" mitdenken)
  const noBullet = stripLeadingBullets(l);
  if (/nährwerte|kalorien|nutritional info/i.test(noBullet)) return "";
  if (/^\d+\s*kcal/i.test(noBullet)) return "";
  if (/\|\s*(?<![\p{L}])(?:kh|f|e|eiweiß|protein|fett|kohlenhydrate|kcal)(?![\p{L}])\s*[:=]?/iu.test(noBullet)) return "";
  if (/^(?<![\p{L}])(?:kh|f|e|eiweiß|protein|fett|kohlenhydrate|kcal)(?![\p{L}])\s*[:=]\s*\d/iu.test(noBullet)) return "";
  if (/^\d+[.,]?\d*\s*(?:g|ml|kcal)\s*\|?\s*(?<![\p{L}])(?:kh|f|e|eiweiß|protein|fett|kohlenhydrate|kcal)(?![\p{L}])/iu.test(noBullet)) return "";
  if (/(?<![\p{L}])(?:kh|f|e|eiweiß|protein|fett|kohlenhydrate|kcal)(?![\p{L}])\s*[:=]\s*\d+\s*(?:g|ml)/iu.test(noBullet)) return "";
  
  return l;
}
