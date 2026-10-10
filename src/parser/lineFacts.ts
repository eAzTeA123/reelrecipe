import { getAllVocab } from "./vocabulary";
import { stripEmojiModifiers, stripLeadingBullets } from "./normalize";
import { looksLikeIngredient } from "./ingredient";
import { UNIT_REGEX } from "./units";

/**
 * Zentrale Zeilen-Fakten für alle Parser-Strategien.
 *
 * Vorher lag dieselbe Logik (Bullets, Emojis, Nährwerte, Promo, Marker) mehrfach
 * in markerBased.ts und lineStateMachine.ts – ein Fix an einer Stelle wirkte an
 * der anderen nicht und die Strategien drifteten auseinander. Hier gibt es genau
 * eine Definition; die Strategien komponieren daraus nur noch ihre Entscheidungen.
 */

const vocab = getAllVocab();

export { stripEmojiModifiers, stripLeadingBullets };

/** Emoji-Listen in normalisierter Form (ohne Hautton/VS16). */
export const INGREDIENT_EMOJIS = vocab.ingredientEmojis.map(stripEmojiModifiers);
export const STEP_EMOJIS = vocab.stepEmojis.map(stripEmojiModifiers);

/** Enthält die Zeile eines der Emojis? (tolerant gegenüber "👨🏻‍🍳") */
export function hasEmoji(line: string, emojis: string[]): boolean {
  const normalized = stripEmojiModifiers(line);
  return emojis.some((e) => normalized.includes(e));
}

export const hasIngredientEmoji = (line: string): boolean => hasEmoji(line, INGREDIENT_EMOJIS);
export const hasStepEmoji = (line: string): boolean => hasEmoji(line, STEP_EMOJIS);

/** Zeile ohne Emoji/Doppelpunkt/Bullet, klein geschrieben – für Marker-Vergleiche. */
export function normalizeHeader(line: string): string {
  return stripEmojiModifiers(line)
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    /*
     * Typografische Apostrophe vereinheitlichen: Captions schreiben „SO GEHT’S",
     * der Wortschatz enthält „so geht's". Ohne diesen Schritt wurde die Anleitung
     * nicht erkannt – das Rezept hatte dann **keine Schritte** (gemessen am
     * Zimt-Zupfbrot).
     */
    .replace(/[\u2018\u2019\u201A\u201B\u00B4\u0060]/g, "'")
    .toLowerCase()
    .replace(/[:\-_#*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Marker-Wort am Zeilenanfang oder als exakte Überschrift? */
export function matchesMarker(line: string, markers: string[]): boolean {
  const clean = normalizeHeader(line);
  return markers.some((m) => clean === m || clean.startsWith(m));
}

export const isIngredientMarkerHeading = (line: string): boolean =>
  matchesMarker(line, vocab.ingredientMarkers);
export const isStepMarkerHeading = (line: string): boolean => matchesMarker(line, vocab.stepMarkers);

/** Marker-Wort irgendwo in der Zeile ("... unsere Zutaten ...")? */
export const containsIngredientMarker = (line: string): boolean =>
  vocab.ingredientMarkers.some((m) => line.toLowerCase().includes(m));

/** Portionsangabe als komplette Zeile ("Für 4 Stück:", "Pro Portion") */
export const SERVINGS_HEADER_RE =
  /^(?:für|for|serves?|yields?|ergibt|bei|pro)\s*(?:ca\.?\s*|about\s*)?(?:\d{1,2})?\s*(?:portionen?|pers(?:onen)?\.?|servings?|people|persons|stücke?|tacos?|portion|stück|person)\s*:?$/i;

/** Nährwert-/Portions-Überschrift (auch mit Emoji davor) */
export const NUTRITION_OR_PORTION_HEADER_RE =
  /^(?:pro|je)\s+portion\b|^(?:nährwerte|nährwertangaben|nutrition|macros?|makros?)\b/i;

/** Nährwert-Zeile: gehört weder in Zutaten noch in Schritte. */
export function isNutritionLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length > 90) return false;
  const lower = trimmed.toLowerCase();
  const stripped = stripLeadingBullets(trimmed);

  if (NUTRITION_OR_PORTION_HEADER_RE.test(stripped)) return true;
  /*
   * Deutsche Makro-Labels: „Eiweiß: ca. 11 g", „Fett: ca. 3 g",
   * „Kohlenhydrate: ca. 5 g", „Kalorien: ca. 95 kcal". In den gesicherten
   * Captions stehen solche Blöcke regelmäßig; bisher wurden sie nur zufällig
   * über eine andere Regel verworfen.
   */
  if (
    /^(?:kalorien|kcal|energie|brennwert|eiweiß|eiweiss|protein|fett|kohlenhydrate|kh|zucker|ballaststoffe|davon)\s*:/i.test(
      stripped,
    )
  ) {
    return true;
  }
  /*
   * Englische Makro-Blöcke aus Meal-Prep-Captions: „481 Calories", „43g Protein",
   * „39g Carbs", „17g Fat". Gemeldet und gemessen: „481 Calories" stand als Zutat
   * in der Zutatenliste, weil nur „kcal"/„Kalorien" erkannt wurden.
   */
  if (/^\s*\d+[.,]?\d*\s*(?:calories|cal|kcal)\b/i.test(stripped)) return true;
  if (
    /^\s*\d+[.,]?\d*\s*g\s*(?:protein|carbs?|carbohydrates?|fat|fats|fibers?|fibres?|sugars?)\b/i.test(
      stripped,
    )
  ) {
    return true;
  }
  // kcal nur als Nährwertangabe werten, wenn die Zeile damit beginnt oder ein
  // Makro-Block ist – sonst verschwindet der Titel "OFENPFANNKUCHEN | 115 KCAL".
  if (/^\s*\d+[.,]?\d*\s*(?:kcal|kalorien)\b/i.test(stripped)) return true;
  if (/^(?:energie|brennwert|davon)\b/i.test(stripped) && /\b(?:kcal|kalorien|kj)\b/i.test(lower)) {
    return true;
  }
  // Achtung: Einheiten und Makro-Wörter mit Unicode-Grenzen prüfen.
  // `\b` reicht nicht, weil "ü" in JS nicht zu \w gehört: "4 Gewürzgurken"
  // wurde sonst als "4 g" + "ew" (Eiweiß) gelesen und als Nährwertzeile verworfen.
  if (
    /(?<![\p{L}])\d+[.,]?\d*\s*(?:g|ml|kcal)(?![\p{L}])\s*(?:protein|kohlenhydrate|kohlenhydraten|kh|fett|carbs|fat|eiweiß|ew)(?![\p{L}])/iu.test(
      lower,
    )
  ) {
    return true;
  }
  // "Zucker" absichtlich NICHT als Makro-Wert: "50 g Zucker" ist eine Zutat.
  if (
    /^(?:protein|kohlenhydrate|kohlenhydraten|kh|fett|eiweiß|ew|carbs|fat)(?![\p{L}])\s*[:=]?\s*\d+[.,]?\d*\s*(?:g|ml|kcal)(?![\p{L}])/iu.test(
      lower,
    )
  ) {
    return true;
  }
  if (/^(?:kh|ew|eiweiß|fett|protein|kohlenhydrate|carbs|fat)\s*:\s*\d+/i.test(lower)) return true;

  const words = lower.split(/[\s,;|:]+/);
  const nutritionWords = ["kh", "kohlenhydrate", "protein", "eiweiß", "fett", "ew", "carbs", "fat"];
  const macroCount = words.filter((w) => nutritionWords.includes(w)).length;
  return macroCount >= 2 && looksLikeIngredient(trimmed) < 2;
}

/** Werbe-/Introzeilen ("30 Tage – 30 Rezepte | …", "Rabattcode: NOEL", "PROZIS") */
const PROMO_KEYWORDS =
  /\b(?:folge mir|folgt mir|folgt uns|folg uns|link in bio|rabattcode|rabatte?|gutschein|abnehmen|muskelaufbau|unterstützen|unterstuetzen|prozis|gratis|werbung|anzeige|anzeigen|produkte?|gerne für mehr|speichern und nachmachen|speichern\s*&\s*nachmachen|mealprep|discount|cookbook|mit dem code|sparen|code\s+\w+)\b|@[\w.]+\.(?:de|com|at|ch)\b/i;

export function isPromoLine(line: string): boolean {
  // Zutatenzeilen nennen oft Marken ("... (Prozis)") – die sind keine Werbung.
  if (looksLikeIngredient(line) >= 3) return false;
  if (PROMO_KEYWORDS.test(line)) return true;
  return line.includes("|") && !UNIT_REGEX.test(line) && !/\d+\s*(?:g|ml|kg|l|el|tl)\b/i.test(line);
}

/** Outro / Social-Media-CTA / Hashtag-Zeilen */
export function isOutroLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  if (/^\d+[.)]/.test(lower) || /^schritt\s*\d+/i.test(lower)) return false;
  if (lower.startsWith("#") || lower.split(/\s+/).filter((w) => w.startsWith("#")).length >= 3) {
    return true;
  }
  if (line.length > 60) return vocab.outroKeywords.some((k) => lower.startsWith(k));
  return vocab.outroKeywords.some((k) => lower.includes(k));
}

/**
 * Nackte Gruppenwörter, wie sie in Back- und Kochrezepten als eigene Zeile
 * stehen („FÜLLUNG", „Guss", „Topping"). Ohne diese Liste galten sie als
 * Zutaten und klebten später an Namen (gemessen: „Salz FÜLLUNG").
 */
const GROUP_WORDS = new Set([
  "füllung", "fuellung", "guss", "zuckerguss", "glasur", "topping", "belag", "teig", "boden",
  "soße", "sosse", "sauce", "creme", "crème", "streusel", "deko", "decor", "frosting",
  "frischkäse-guss", "frischkäse guss", "frischkäse-glasur", "dip", "dressing", "marinade",
  "gewürzmischung", "kräutermischung", "garnitur", "obendrauf", "zum bestreichen",
]);

/*
 * Dieselben Wörter ohne Bindestrich und Leerzeichen. `normalizeHeader` entfernt
 * Bindestriche ersatzlos („FRISCHKÄSE-GUSS" → „frischkäseguss"), deshalb wurde die
 * Überschrift nicht erkannt und stand als Zutat in der Liste (gemessen am
 * Zimt-Zupfbrot, live gegen die Instagram-Caption geprüft).
 */
const GROUP_WORDS_NORMALIZED = new Set(
  [...GROUP_WORDS].map((word) => word.replace(/[^a-zäöüß]/g, "")),
);

/** Sub-Kategorie innerhalb der Zutaten ("Für die Soße:", "Gewürze", "FÜLLUNG") */
export function isSubIngredientHeader(line: string): boolean {
  if (line.length > 40) return false;
  if (/^(?:für|for)\s+(?:den|die|das|diesen|diese|der)/i.test(line)) return true;
  const lower = normalizeHeader(line);
  if (vocab.ingredientMarkers.some((m) => lower.startsWith(m + " "))) {
    if (!lower.endsWith(" english") && !lower.endsWith(" deutsch")) return true;
  }
  // Nacktes Gruppenwort als eigene Zeile ("FÜLLUNG", "FRISCHKÄSE-GUSS", "Guss:")
  const bare = lower.replace(/[^a-zäöüß]/g, "");
  if (GROUP_WORDS.has(bare) || GROUP_WORDS_NORMALIZED.has(bare)) return true;
  return vocab.subIngredientPrefixes.some((p) => lower === p || lower === p + "s");
}

/**
 * Wörter, die auch mit Doppelpunkt eine **Zutat** bleiben („Salz:", „Milch:").
 * Alles andere mit Doppelpunkt ist ein Etikett („Chicken:", „Other:", „Icing:").
 */
/**
 * Wörter, mit denen eine **Fortsetzung** der Zeile darüber beginnt: „fein
 * gehackt", „in Streifen geschnitten", „und", „oder". Alles andere ist eine
 * eigene Zutat („Salz & Pfeffer", „frische Petersilie") oder ein Abschnitt.
 *
 * Diese Liste ist die **einzige** Wahrheit dafür – Zustandsmaschine und
 * Assemblierung nutzen sie gemeinsam.
 */
export const CONTINUATION_START_RE =
  /^(?:und|oder|sowie|in|im|mit|zum|zur|nach|ca|etwa|je|davon|hiervon|plus|dazu|optional|alternativ|evtl|eventuell|fein|grob|klein|gross|groß|mittel|dünn|duenn|dicke|weich|hart|kalt|warm|lauwarm|zimmerwarm|gehackt|gehackte|gehackter|gewürfelt|gewuerfelt|gerieben|geriebene|geriebener|geschnitten|gesiebte?|gewaschen|abgetropft|zerlassen|geschmolzen|gekocht|gebraten|geräuchert|geraeuchert|getrocknet|gemahlen|geröstet|geroestet|nach Belieben|zum Servieren|zum Bestreichen|zum Garnieren|für den|fuer den|für die|fuer die)\b/i;
const INGREDIENT_LABEL_WORDS = new Set([
  "salz", "pfeffer", "zucker", "mehl", "milch", "wasser", "öl", "oel", "butter", "ei", "eier",
  "sahne", "quark", "honig", "reis", "nudeln", "kartoffeln", "zwiebel", "knoblauch",
]);

/**
 * **Reine** Gruppen-Überschrift: keine Zahlen, keine Kommas, keine Zutatenzeile.
 *
 * Zwei Formen:
 *  1. Erkannte Abschnitte („Für die Soße", „FÜLLUNG", „Teig") – siehe
 *     `isSubIngredientHeader`.
 *  2. Kurze Etiketten mit Doppelpunkt („Chicken:", „Other:", „Icing:", „Ofen:"),
 *     die vorher als Zutaten in der Liste standen (gemeldet und gemessen).
 *
 * Zeilen mit Zahlen oder Kommas sind **Zutatenzeilen**: „Gewürze: Salz, Pfeffer,
 * Paprikapulver" enthält drei Zutaten und darf nicht als Überschrift verschwinden
 * (gemessen: sonst fehlen sie alle).
 */
export function isPureGroupHeader(line: string): boolean {
  /*
   * Klammern vor der Zahlenprüfung entfernen: „The Best Buff Chicken Subs
   * (makes 12):" ist ein Etikett, obwohl eine Zahl darin steht (gemeldet: die
   * Zeile stand als Zutat in der Zutatenliste).
   */
  const trimmed = line.trim().replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (/^\d/.test(trimmed) || trimmed.includes(",")) return false;
  // Fortsetzungen sind keine Überschrift – außer sie enden auf Doppelpunkt
  // („Für die Soße:"). Sonst entstand eine Gruppe namens „fein gehackt".
  if (!/:$/.test(trimmed) && CONTINUATION_START_RE.test(trimmed)) return false;
  if (/:$/.test(trimmed)) {
    const withoutColon = trimmed.replace(/:+$/, "").trim();
    // „Für das Grilled Cheese:" ist ein Abschnitt, kein Etikett
    if (!/\d/.test(withoutColon) && isSubIngredientHeader(withoutColon)) return true;
    const words = withoutColon.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 3 && !/\d/.test(trimmed)) {
      return !INGREDIENT_LABEL_WORDS.has(words[0].toLowerCase());
    }
    return false;
  }
  return isSubIngredientHeader(line) && !/\d/.test(line);
}

/**
 * Etikett, das **keine Zutat** ist: endet auf Doppelpunkt, enthält keine Zahl.
 * Kurze Etiketten werden zur Gruppe (`isPureGroupHeader`), lange fallen ganz aus
 * der Zutatenliste – gemessen: „The Best Buff Chicken Subs :" stand als Zutat drin.
 * Ein einzelnes Zutatwort mit Doppelpunkt („Salz:") bleibt Zutat.
 */
export function isLabelLine(line: string): boolean {
  /*
   * Klammern vor der Zahlenprüfung entfernen: „The Best Buff Chicken Subs
   * (makes 12):" ist ein Etikett, obwohl eine Zahl darin steht (gemeldet: die
   * Zeile stand als Zutat in der Liste).
   */
  const withoutParens = line.trim().replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!/:$/.test(withoutParens) || /\d/.test(withoutParens)) return false;
  const words = withoutParens.replace(/:+$/, "").split(/\s+/).filter(Boolean);
  return !(words.length === 1 && INGREDIENT_LABEL_WORDS.has(words[0].toLowerCase()));
}

/**
 * Ganzer Satz mit Kochverb („Die Tacos heiß mit dem Minzjoghurt servieren") – das
 * ist ein **Schritt**, keine Zutat. Gemessen: Solche Zeilen standen mitten in der
 * Zutatenliste, weil eine Abschnitts-Überschrift die Zubereitung wieder auf
 * Zutaten umgestellt hatte. Eine Zutatenzeile hat keine finite Verbform und ist
 * kurz („gehackte Tomaten").
 */
const SENTENCE_VERB_RE =
  /\b(servieren|anbraten|abschmecken|vermengen|verteilen|bestreuen|erhitzen|hinzugeben|dazugeben|würzen|mischen|verrühren|kochen|backen|braten|garen|ablöschen|anrösten|schneiden|hacken|abtropfen|ziehen lassen|genießen)\b/i;

export function isStepSentence(line: string): boolean {
  /*
   * Emojis und Ziffern-Emojis („1️⃣") vor der Mengenprüfung entfernen: Sonst galt
   * „1️⃣ Die Tacos heiß mit dem Minzjoghurt servieren" wegen der Ziffer als Zutat
   * und blieb in der Zutatenliste stehen (gemessen).
   */
  const trimmed = line
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}\u{203C}\u{2049}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/\d/.test(trimmed)) return false;
  return trimmed.split(/\s+/).length >= 5 && SENTENCE_VERB_RE.test(trimmed);
}

/**
 * Backofen-/Herdangabe („180 °C Ober-/Unterhitze", „200 Grad") – eine Einstellung,
 * keine Zutat. Gemessen: „Ofen:" mit der Temperaturzeile darunter landete beides
 * in den Zutaten.
 */
export function isTemperatureLine(line: string): boolean {
  const trimmed = line.trim();
  if (/°/.test(trimmed)) return true;
  return /^\s*(?:ca\.?\s*)?\d{2,3}\s*(?:grad|celsius)\b/i.test(trimmed);
}

/**
 * Anzeigename einer Zutatengruppe: Emojis, Aufzählungszeichen, Doppelpunkt und
 * einleitendes „Für die …" entfernen. „Für die Soße:" → „Soße", „FÜLLUNG" →
 * „FÜLLUNG".
 */
export function cleanGroupTitle(line: string): string {
  let text = line
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/[*_`~#>•·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:.]$/, "")
    .trim();
  text = text.replace(/^(?:für|fuer|for)\s+(?:den|die|das|diesen|diese|der|the)\s+/i, "").trim();
  return text.length > 40 ? text.slice(0, 40).trim() : text;
}

/** Abschnittsüberschrift (Zutaten/Zubereitung, auch als Emoji-Zeile) */
export function isSectionHeader(line: string): boolean {
  return (
    isIngredientMarkerHeading(line) ||
    isStepMarkerHeading(line) ||
    hasIngredientEmoji(line) ||
    hasStepEmoji(line)
  );
}

/**
 * Notiz-/Alternativzeile zu einer Zutat ("( erhältlich bei Prozis )",
 * "alternativ 25g Ofen Chips"). Gehört zur vorherigen Zutat, nie in die Schritte.
 */
export function isNoteLine(line: string): boolean {
  return /^\(/.test(line.trim()) || /^(?:alternativ|erhältlich|erhaeltlich|optional)\b/i.test(line.trim());
}

/**
 * Beginnt die Zeile einen neuen Listeneintrag? Bullets, Emojis (❌, ✖️, 🛒 …)
 * und Nummern zählen als Listenzeichen – sonst kleben mehrzeilige Captions
 * ihre Zutaten zu einem unlesbaren String zusammen.
 */
export function startsNewItem(line: string): boolean {
  const trimmed = line.trim();
  if (/^\d/.test(trimmed)) return true;
  return stripLeadingBullets(trimmed) !== trimmed;
}

/* ------------------------------------------------------------------ */
/* Zeilen-Typen für Zutaten- und Zubereitungslisten                    */
/* Diese Regeln lagen früher nur in der State Machine; marker_based     */
/* kannte sie nicht und zählte Überschriften/Werbezeilen als Schritte.  */
/* ------------------------------------------------------------------ */

const OVEN_OR_TEMP_RE =
  /\b(?:backofen|umluft|ober-\/unterhitze|o\/u-hitze|grad|°c|minuten?|stunden?|min\.)\b/i;

/** Beginnt mit Verb/Sequenzwort ODER enthält Kochverb bzw. Temperaturangabe? */
export function hasVerbOrSequenceStart(line: string): boolean {
  const words = line
    .toLowerCase()
    .replace(/^[0-9.\-•*):]+\s*/, "")
    .replace(/[.,!?]+$/, "")
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?]$/, ""));
  const firstWord = words[0] || "";
  const firstTwoWords = `${words[0] || ""} ${words[1] || ""}`.trim();

  const isVerbStart = vocab.stepVerbs.some((v) => firstWord === v || firstTwoWords === v);
  const isSeq = vocab.sequenceWords.some((s) => firstWord === s || firstTwoWords === s);
  const containsVerb = vocab.stepVerbs.some((v) => words.includes(v));

  return isVerbStart || isSeq || containsVerb || OVEN_OR_TEMP_RE.test(line);
}

/** Schritt-Nummerierung oder Sequenzwort am Zeilenanfang */
export function hasStepNumbering(line: string): boolean {
  return (
    /^(?:schritt\s*\d+|\d+[.)]|step\s*\d+)/i.test(line.trim()) ||
    vocab.sequenceWords.some((w) => line.toLowerCase().trim().startsWith(w))
  );
}

/**
 * Kurze Zwischenüberschrift im Zubereitungsteil ("Haselnuss-Creme", "Crunch"):
 * kein Listenzeichen, kein Verb, kein Satzzeichen, wenige Wörter – und danach
 * folgt der eigentliche Anweisungssatz.
 */
export function looksLikeHeading(line: string, nextLine?: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (startsNewItem(trimmed)) return false;
  if (hasVerbOrSequenceStart(trimmed)) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).filter(Boolean).length > 4) return false;
  const nextWords = nextLine?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  return nextWords >= 3;
}

/**
 * Einleitungszeile zu einer Aufzählung im Zubereitungsteil
 * ("Dessert schichten", "In zwei Gläser geben:") – das ist eine Überschrift
 * für die folgenden Listenpunkte, kein eigener Schritt.
 */
export function isStepLeadIn(line: string, followingLines: string[]): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).filter(Boolean).length > 4) return false;

  const nextIsListItem = followingLines
    .slice(0, 2)
    .some((l) => l !== undefined && startsNewItem(l));
  if (trimmed.endsWith(":")) return nextIsListItem;
  // "Dessert schichten" → die übernächste Zeile beginnt die Aufzählung
  return followingLines.slice(0, 3).filter((l) => l !== undefined && startsNewItem(l)).length > 0;
}

/**
 * Link-, Credit-, CTA- und Quellenzeilen ("youtube.com/c/einfachbacken",
 * "FOTO: @maria.panzer", "Das ganze Video findest du auf unserem YouTube-Kanal!",
 * "Protagonistin: Fabiana") sind keine Zubereitungsschritte.
 */
const LINK_OR_CREDIT_RE =
  /(?:^|\s)(?:https?:\/\/|www\.)\S+|(?:^|\s)[\w-]+\.(?:com|de|at|ch|net|org|tv|io|co)\b|^(?:foto|bild|video|quelle|rezept|credit|credits|source)s?\s*:/i;
const CTA_KEYWORDS_RE =
  /\b(?:youtube|youtu\.be|instagram|tiktok|facebook|pinterest|kanal|website|homepage|newsletter|link in bio|blog)\b/i;
/** "Protagonistin: Fabiana" – kurzes Label mit Wert, keine Anweisung */
const LABEL_LINE_RE = /^[\p{Lu}][\p{L}-]{2,20}\s*:\s*\S/u;

export function isCreditOrLinkLine(line: string): boolean {
  const t = line.trim();
  const words = t.split(/\s+/).filter(Boolean);

  // Zeile beginnt mit einem Link („https://…“, „www.…“) → Footer
  if (/^(?:https?:\/\/|www\.)\S+/i.test(t)) return true;

  // Kurze Zeilen: Link/Credit/CTA/Label. Lange Sätze bleiben Anweisungen,
  // auch wenn am Ende Hashtags oder Links hängen.
  if (words.length > 8) return false;
  if (LINK_OR_CREDIT_RE.test(t)) return true;
  if (CTA_KEYWORDS_RE.test(t)) return true;
  if (LABEL_LINE_RE.test(t) && words.length <= 4 && !OVEN_OR_TEMP_RE.test(t)) return true;
  return false;
}

/**
 * Aufgezählter Eintrag ohne Verb: im Zubereitungsteil eine Zutaten-/Schicht-Nennung
 * ("→ 🍫 Schoko-Creme"), keine Anweisung.
 */
export function isListItemWithoutVerb(line: string): boolean {
  const trimmed = line.trim();
  if (!startsNewItem(trimmed)) return false;
  if (hasVerbOrSequenceStart(trimmed)) return false;
  return trimmed.split(/\s+/).filter(Boolean).length <= 6;
}
