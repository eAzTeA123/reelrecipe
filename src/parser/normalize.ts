const UNICODE_FRACTIONS: Record<string, string> = {
  "¼": "1/4", "½": "1/2", "¾": "3/4",
  "⅐": "1/7", "⅑": "1/9", "⅒": "1/10",
  "⅓": "1/3", "⅔": "2/3",
  "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5",
  "⅙": "1/6", "⅚": "5/6",
  "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
};

const BULLET_RE = /^[\s\-–—•·∙◦▪▫●○*+~›»➡️➜→↳✓✔️☐🔹🔸📌🥄🍴\p{Emoji_Presentation}]+/u;
const HASHTAG_LINE_RE = /^(#\S+\s*)+$/;
const MENTION_LINE_RE = /^(@\S+\s*)+$/;

export function normalizeCaption(caption: string): string {
  let text = caption;
  for (const [frac, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    text = text.replace(new RegExp(`(\\d)${frac}`, "g"), `$1 ${ascii}`);
    text = text.split(frac).join(ascii);
  }
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
  l = l.replace(BULLET_RE, "").trim();
  // trailing Hashtags/Mentions am Zeilenende entfernen
  l = l.replace(/(\s[#@]\S+)+\s*$/, "");
  l = l.replace(/\s+/g, " ").trim();
  if (HASHTAG_LINE_RE.test(l) || MENTION_LINE_RE.test(l)) return "";
  // Ignore lines with no letters or numbers
  if (!/[\p{L}\d]/u.test(l)) return "";
  
  // Ignore nutritional values
  if (/nährwerte|kalorien|nutritional info/i.test(l)) return "";
  if (/^\d+\s*kcal/i.test(l) || /(?:kcal|protein|kohlenhydrate|fett)\s*[:=]?/i.test(l)) return "";
  
  return l;
}
