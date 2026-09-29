/**
 * Zutaten → kanonische Open-Food-Facts-Kategorie.
 *
 * Zweck: unverpackte Rohware (Gemüse, Fleisch, Milchprodukte, Trockenware)
 * lässt sich über eine Kategorie bepreisen – Open Prices hat dafür deutlich
 * mehr Meldungen als für einzelne Markenprodukte. Genau daran ist die
 * Abdeckung vorher gescheitert (88 % der Zutaten hingen am exakten Produkt).
 *
 * Regeln werden nach Stiellänge absteigend geprüft, damit das spezifischere
 * Wort gewinnt: "hähnchenbrust" schlägt "hähnchen", "kokosmilch" schlägt "milch".
 */

/** Grobe Warengruppe – bestimmt den Richtwert, wenn kein Marktpreis existiert. */
export type EstimateGroup =
  | "gemuese"
  | "obst"
  | "kraeuter"
  | "fleisch"
  | "fisch"
  | "wurst"
  | "milch"
  | "kaese"
  | "ei"
  | "brot"
  | "trockenware"
  | "konserve"
  | "tiefkuehl"
  | "oel"
  | "sauce"
  | "gewuerz"
  | "suessware"
  | "backzutat"
  | "nuss"
  | "getraenk"
  | "ersatz"
  /** Markenprodukt ohne erkennbare Warengruppe */
  | "sonstiges"
  /** Brühe, Fond, Bouillon */
  | "bruehe";

export interface CategoryRule {
  tag: string;
  group: EstimateGroup;
  stems: string[];
}

const r = (tag: string, group: EstimateGroup, ...stems: string[]): CategoryRule => ({ tag, group, stems });

export const CATEGORY_RULES: CategoryRule[] = [
  // --- Milchprodukte (vor "milch"-freien Treffern, spezifische zuerst) ---
  r("en:coconut-milks", "konserve", "kokosmilch", "kokosnussmilch"),
  r("en:cream-cheeses", "kaese", "frischkäse", "frischkaese", "philadelphia", "streukäse", "streukaese", "hüttenkäse", "huettenkaese"),
  r("en:creme-fraiche", "milch", "crème fraîche", "creme fraiche", "crèmefraîche", "schmand", "sauerrahm", "saure sahne"),
  r("en:cream", "milch", "schlagsahne", "sahne", "kochsahne", "süße sahne"),
  r("en:yogurts", "milch", "joghurt", "yoghurt", "skyr", "quark", "magerquark"),
  r("en:milks", "milch", "milch", "vollmilch", "hafermilch", "mandelmilch", "sojamilch", "buttermilch"),
  r("en:butters", "milch", "butter", "margarine"),
  r("en:gouda-cheese", "kaese", "gouda", "gouda"),
  r("en:emmentaler-cheese", "kaese", "emmentaler", "bergkäse"),
  r("en:parmesan", "kaese", "parmesan", "parmigiano", "grana padano", "pecorino"),
  r("en:feta", "kaese", "feta", "hirtenkäse", "hirtenkaese", "schafskäse"),
  r("en:mozzarella", "kaese", "mozzarella", "büffelmozzarella"),
  r("en:grated-cheese", "kaese", "geriebener käse", "reibekäse", "schmelzkäse", "schmelzkaese", "käse", "kaese"),
  r("en:eggs", "ei", "ei", "eier", "eiklar", "eigelb"),

  // --- Fleisch & Wurst ---
  r("en:chicken-breasts", "fleisch", "hähnchenbrust", "haehnchenbrust", "hühnerbrust", "huehnerbrust", "hähnchenfilet", "hähnchen filet", "hühnerfilet", "pute", "putenbrust", "truthahn", "geflügel"),
  r("en:chickens", "fleisch", "hähnchen", "haehnchen", "huhn", "hühner", "huehner"),
  r("en:ground-meat", "fleisch", "hackfleisch", "faschiertes", "geflügelhack", "gehacktes", "rinderhack", "schweinehack"),
  r("en:beef", "fleisch", "rind", "rinder", "steak", "gulasch", "braten"),
  r("en:pork", "fleisch", "schwein", "schweine", "kotelett", "schnitzel"),
  r("en:ham", "wurst", "schinken", "schinkenwürfel", "kochschinken", "katenschinken"),
  r("en:bacon", "wurst", "speck", "bacon", "pancetta"),
  r("en:sausages", "wurst", "wurst", "salami", "wiener", "bratwurst", "chorizo", "leberwurst", "mortadella"),

  // --- Fisch ---
  r("en:salmon", "fisch", "lachs", "räucherlachs"),
  r("en:tunas", "fisch", "thunfisch", "tuna"),
  r("en:fish", "fisch", "fisch", "forelle", "kabeljau", "garnele", "garnelen", "shrimps", "muschel"),

  // --- Gemüse ---
  r("en:cherry-tomatoes", "gemuese", "cherrytomaten", "kirschtomaten", "cocktailtomaten", "rispentomaten"),
  r("en:tomato-pastes", "konserve", "tomatenmark", "passata", "passierte", "tomatensugo", "tomatensauce"),
  r("en:tomatoes", "gemuese", "tomate", "tomaten"),
  r("en:potatoes", "gemuese", "kartoffel", "kartoffeln", "kartöffelchen"),
  r("en:sweet-potatoes", "gemuese", "süßkartoffel", "suesskartoffel", "batate"),
  r("en:onions", "gemuese", "zwiebel", "zwiebeln", "schalotte", "schalotten", "frühlingszwiebel", "fruehlingszwiebel", "lauchzwiebel", "porree", "lauch"),
  r("en:garlic", "gemuese", "knoblauch", "knoblauchzehe", "knoblauchzehen"),
  r("en:carrots", "gemuese", "karotte", "karotten", "möhre", "moehre", "möhren"),
  r("en:cucumbers", "gemuese", "salatgurke", "gurke", "gurken", "gewürzgurke", "gewuerzgurke", "essiggurke"),
  r("en:sweet-peppers", "gemuese", "paprika", "spitzpaprika", "paprikaschote"),
  r("en:chili-peppers", "gemuese", "chili", "peperoni", "chilischote", "jalapeno"),
  r("en:zucchini", "gemuese", "zucchini", "courgette"),
  r("en:eggplants", "gemuese", "aubergine", "melanzani"),
  r("en:broccoli", "gemuese", "brokkoli", "broccoli"),
  r("en:cauliflowers", "gemuese", "blumenkohl", "karfiol"),
  r("en:cabbages", "gemuese", "weißkohl", "weisskohl", "rotkohl", "spitzkohl", "wirsing", "kohl"),
  r("en:kales", "gemuese", "grünkohl", "gruenkohl", "kale", "mangold"),
  r("en:spinachs", "gemuese", "spinat"),
  r("en:lettuces", "gemuese", "kopfsalat", "salat", "eisbergsalat", "rucola", "feldsalat", "romana"),
  r("en:mushrooms", "gemuese", "champignon", "pilze", "pilz", "austernpilz", "shii-take"),
  r("en:celeriacs", "gemuese", "sellerie", "knollensellerie", "staudensellerie"),
  r("en:green-beans", "gemuese", "grüne bohnen", "gruene bohnen", "bohnen", "buschbohnen"),
  r("en:peas", "gemuese", "erbsen", "erbsen"),
  r("en:maizes", "gemuese", "mais", "zuckermais"),
  r("en:pumpkins", "gemuese", "kürbis", "kuerbis", "hokkaido", "butternut"),
  r("en:beetroots", "gemuese", "rote bete", "randen", "rote rüben"),
  r("en:asparaguses", "gemuese", "spargel"),
  r("en:radishes", "gemuese", "radieschen", "rettich"),
  r("en:gingers", "gemuese", "ingwer"),
  r("en:avocados", "gemuese", "avocado", "avocados"),
  r("en:olives", "konserve", "oliven", "olive"),
  r("en:pickles", "konserve", "eingelegte", "essig", "cornichons"),

  // --- Obst ---
  r("en:apples", "obst", "apfel", "äpfel", "aepfel"),
  r("en:bananas", "obst", "banane", "bananen"),
  r("en:oranges", "obst", "orange", "orangen", "blutorange"),
  r("en:lemons", "obst", "zitrone", "zitronen", "limette", "limetten"),
  r("en:strawberries", "obst", "erdbeer"),
  r("en:blueberries", "obst", "heidelbeer", "blaubeer", "blueberry"),
  r("en:raspberries", "obst", "himbeer"),
  r("en:grapes", "obst", "trauben", "weintrauben"),
  r("en:pears", "obst", "birne", "birnen"),
  r("en:peaches", "obst", "pfirsich", "nektarine"),
  r("en:melons", "obst", "melone", "wassermelone"),
  r("en:pineapples", "obst", "ananas"),
  r("en:mangos", "obst", "mango"),
  r("en:kiwifruits", "obst", "kiwi"),
  r("en:cherries", "obst", "kirschen", "kirsche"),
  r("en:berries", "obst", "beeren", "beere", "obst"),

  // --- Kräuter & Gewürze ---
  r("en:parsley", "kraeuter", "petersilie"),
  r("en:basil", "kraeuter", "basilikum", "basil"),
  r("en:dill", "kraeuter", "dill"),
  r("en:chives", "kraeuter", "schnittlauch"),
  r("en:thyme", "kraeuter", "thymian"),
  r("en:oregano", "kraeuter", "oregano"),
  r("en:rosemary", "kraeuter", "rosmarin"),
  r("en:mint", "kraeuter", "minze", "pfefferminze"),
  r("en:coriander-leaves", "kraeuter", "koriander", "cilantro"),
  r("en:cinnamon", "gewuerz", "zimt"),
  r("en:paprika-powder", "gewuerz", "paprikapulver", "paprikagewürz", "geräuchertes paprika", "geraeuchertes paprika"),
  r("en:curry-powder", "gewuerz", "currypulver", "curry", "currypaste"),
  r("en:turmeric", "gewuerz", "kurkuma", "gelbwurz"),
  r("en:nutmeg", "gewuerz", "muskat"),
  r("en:cumin", "gewuerz", "kreuzkümmel", "kümmel", "cumin"),
  r("en:garlic-powder", "gewuerz", "knoblauchpulver", "knoblauchgewürz"),
  r("en:seasonings", "gewuerz", "gewürz", "gewuerz", "würzmischung", "wuerzmischung", "tomatengewürz", "hackfleischgewürz", "brühpulver"),
  r("en:peppers", "gewuerz", "pfeffer", "pfefferkörner"),
  r("en:salt", "gewuerz", "salz", "meersalz"),
  r("en:yeasts", "backzutat", "hefe", "trockenhefe"),

  // --- Backen & Trockenware ---
  r("en:wheat-flours", "trockenware", "weizenmehl", "mehl", "dinkelmehl", "vollkornmehl", "instant rice flour", "reismehl"),
  r("en:starch", "backzutat", "stärke", "staerke", "speisestärke", "maisstärke"),
  r("en:baking-powders", "backzutat", "backpulver", "backpulvet", "natron", "backnatron", "weinstein"),
  r("en:sugars", "backzutat", "zucker", "puderzucker", "brauner zucker", "rohrzucker"),
  r("en:vanilla", "backzutat", "vanille", "vanilleschote", "vanillezucker", "vanilleextrakt"),
  r("en:cocoa-powders", "backzutat", "kakao", "backkakao", "kakaopulver"),
  r("en:chocolate", "suessware", "schokolade", "schokoli", "schokolinse", "schokolinsen", "bueno", "riegel", "waffel", "waffeln"),
  r("en:pastas", "trockenware", "pasta", "nudel", "nudeln", "spaghetti", "penne", "rigatoni", "lasagne", "lasagneplatten", "makkaroni", "tagliatelle"),
  r("en:rices", "trockenware", "reis", "jasminreis", "paella-reis", "basmatireis", "milchreis"),
  r("en:oats", "trockenware", "haferflocken", "hafer", "porridge"),
  r("en:couscous", "trockenware", "couscous", "bulgur", "polenta", "grieß", "griess"),
  r("en:bread", "brot", "brot", "brötchen", "broetchen", "baguette", "toast", "bun", "buns", "pita", "fladenbrot", "laugenstange", "laugenstangen", "kaiserbrötchen", "semmel"),
  r("en:breadcrumbs", "brot", "semmelbrösel", "brösel", "broesel", "panko", "paniermehl"),
  r("en:cereals", "trockenware", "cornflakes", "kellogs", "müsli", "muesli", "cerealien", "flocken"),
  r("en:legumes", "konserve", "linsen", "kichererbsen", "bohnen", "kidneybohnen", "weiße bohnen"),
  r("en:canned-corns", "konserve", "mais", "dosemais"),
  r("en:tofu", "ersatz", "tofu", "tempeh", "seitan"),
  r("en:protein-powders", "ersatz", "proteinpulver", "protein", "whey", "eiweißpulver"),

  // --- Nüsse & Samen ---
  r("en:hazelnuts", "nuss", "haselnuss", "haselnüsse", "haselnuesse"),
  r("en:almonds", "nuss", "mandel", "mandeln"),
  r("en:walnuts", "nuss", "walnuss", "walnüsse"),
  r("en:peanuts", "nuss", "erdnuss", "erdnüsse", "peanut"),
  r("en:cashews", "nuss", "cashew"),
  r("en:pistachios", "nuss", "pistazie"),
  r("en:sesame-seeds", "nuss", "sesam"),
  r("en:sunflower-seeds", "nuss", "sonnenblumenkerne"),
  r("en:pumpkin-seeds", "nuss", "kürbiskerne", "kuerbiskerne"),
  r("en:chia-seeds", "nuss", "chia"),
  r("en:flax-seeds", "nuss", "leinsamen", "flohsamenschalen"),
  r("en:dried-fruits", "obst", "rosinen", "datteln", "getrocknete"),

  // --- Öle, Saucen, Süßungsmittel ---
  r("en:olive-oils", "oel", "olivenöl", "olivenoel"),
  r("en:sunflower-oils", "oel", "sonnenblumenöl", "sonnenblumenoel", "rapsöl", "raps", "pflanzenöl", "öl", "oel", "sprühstöße öl"),
  r("en:vinegars", "sauce", "essig", "balsamico", "apfelessig"),
  r("en:ketchup", "sauce", "ketchup", "tomatenketchup"),
  r("en:mustards", "sauce", "senf", "dijonsenf"),
  r("en:mayonnaises", "sauce", "mayonnaise", "mayo", "miracle whip", "remoulade"),
  r("en:soy-sauces", "sauce", "sojasauce", "sojasoße", "teriyaki"),
  r("en:hot-sauces", "sauce", "sriracha", "tabasco", "chilisauce", "harissa"),
  r("en:pesto", "sauce", "pesto"),
  r("en:chutneys", "sauce", "chutney", "relish", "salsa"),
  r("en:honeys", "suessware", "honig", "ahornsirup", "agavendicksaft", "sirup", "zuckerrübensirup"),
  r("en:jams", "suessware", "marmelade", "konfitüre", "konfituere", "gelee", "nutella", "nussnougatcreme", "haselnuss-crème", "haselnusscreme", "schoko-creme", "bueno creme"),
  r("en:sweeteners", "suessware", "süßungsmittel", "suessungsmittel", "real flavor", "stevia", "erythrit", "xylit", "yummy drops", "zero"),
  r("en:peanut-butters", "suessware", "erdnussbutter", "nussmus", "mandelmus", "tahin", "tahini"),

  // --- Tiefkühl & Fertig ---
  r("en:frozen-vegetables", "tiefkuehl", "tk-", "tiefgekühlt", "tiefgekuehlt", "gefroren"),
  r("en:chips-and-fries", "suessware", "chips", "ofen chips", "pommes", "flips"),
  r("en:puddings", "suessware", "pudding", "dessert", "creme"),
  r("en:instant-noodles", "trockenware", "instant", "fertiggericht", "suppe", "brühe", "bruehe", "fond"),
  r("en:sweeteners-tablets", "suessware", "süßstoff", "suessstoff"),
];

const NON_RAW_FORMS = /\b(?:passiert|dosiert|dose|getrocknet|eingelegt|gefüllt|pulver|mark|paste|pesto|saft|sauce|soße)\w*\b/i;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[„“”"'`]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9äöüß\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Breitere Kategorien als Rückfall, wenn ein spezifischer Tag in Deutschland
 * keine gemeldeten Preise hat (z. B. "en:cherry-tomatoes" → "en:tomatoes").
 */
const CATEGORY_FALLBACKS: Record<string, string[]> = {
  "en:cherry-tomatoes": ["en:tomatoes", "en:vegetables"],
  "en:tomatoes": ["en:vegetables"],
  "en:chicken-breasts": ["en:chickens", "en:poultry", "en:meats"],
  "en:chickens": ["en:poultry", "en:meats"],
  "en:ground-meat": ["en:meats"],
  "en:beef": ["en:meats"],
  "en:pork": ["en:meats"],
  "en:salmon": ["en:fishes", "en:seafood"],
  "en:tunas": ["en:fishes", "en:seafood"],
  "en:fish": ["en:seafood"],
  "en:ham": ["en:meats", "en:prepared-meats"],
  "en:sausages": ["en:prepared-meats"],
  "en:bacon": ["en:prepared-meats"],
  "en:cream-cheeses": ["en:cheeses", "en:dairies"],
  "en:grated-cheese": ["en:cheeses", "en:dairies"],
  "en:gouda-cheese": ["en:cheeses", "en:dairies"],
  "en:emmentaler-cheese": ["en:cheeses", "en:dairies"],
  "en:parmesan": ["en:cheeses", "en:dairies"],
  "en:feta": ["en:cheeses", "en:dairies"],
  "en:mozzarella": ["en:cheeses", "en:dairies"],
  "en:yogurts": ["en:dairies"],
  "en:milks": ["en:dairies"],
  "en:butters": ["en:dairies"],
  "en:cream": ["en:dairies"],
  "en:creme-fraiche": ["en:dairies"],
  "en:eggs": ["en:eggs-and-egg-products"],
  "en:rices": ["en:cereals-and-potatoes"],
  "en:pastas": ["en:cereals-and-potatoes"],
  "en:wheat-flours": ["en:cereals-and-potatoes"],
  "en:oats": ["en:cereals-and-potatoes"],
  "en:potatoes": ["en:cereals-and-potatoes"],
  "en:sweet-potatoes": ["en:cereals-and-potatoes"],
  "en:bread": ["en:breads", "en:cereals-and-potatoes"],
  "en:olive-oils": ["en:vegetable-oils"],
  "en:sunflower-oils": ["en:vegetable-oils"],
  "en:coconut-milks": ["en:canned-foods"],
  "en:tomato-pastes": ["en:canned-foods", "en:sauces"],
  "en:pesto": ["en:sauces"],
  "en:ketchup": ["en:sauces"],
  "en:mayonnaises": ["en:sauces"],
  "en:mustards": ["en:sauces"],
  "en:hot-sauces": ["en:sauces"],
  "en:chutneys": ["en:sauces"],
  "en:broths": ["en:sauces", "en:canned-foods"],
  "en:paprika-powder": ["en:spices"],
  "en:curry-powder": ["en:spices"],
  "en:seasonings": ["en:spices"],
  "en:cinnamon": ["en:spices"],
  "en:turmeric": ["en:spices"],
  "en:peppers": ["en:spices"],
  "en:broccoli": ["en:vegetables"],
  "en:cauliflowers": ["en:vegetables"],
  "en:peas": ["en:vegetables"],
  "en:maizes": ["en:vegetables"],
  "en:pumpkins": ["en:vegetables"],
  "en:sweet-peppers": ["en:vegetables"],
  "en:cucumbers": ["en:vegetables"],
  "en:carrots": ["en:vegetables"],
  "en:onions": ["en:vegetables"],
  "en:garlic": ["en:vegetables"],
  "en:zucchini": ["en:vegetables"],
  "en:spinachs": ["en:vegetables"],
  "en:mushrooms": ["en:vegetables"],
  "en:lettuces": ["en:vegetables"],
  "en:green-beans": ["en:vegetables"],
  "en:apples": ["en:fruits"],
  "en:bananas": ["en:fruits"],
  "en:lemons": ["en:fruits"],
  "en:berries": ["en:fruits"],
  "en:hazelnuts": ["en:nuts"],
  "en:almonds": ["en:nuts"],
  "en:walnuts": ["en:nuts"],
  "en:peanuts": ["en:nuts"],
};

/**
 * Kategorie-Kandidaten in Reihenfolge: spezifisch zuerst, dann breitere
 * Kategorien. So bekommt eine Zutat auch dann einen Marktpreis, wenn der
 * genaue Tag in Deutschland keine Meldungen hat.
 */
export function categoryTagCandidates(name: string, notes?: string): string[] {
  const match = resolveCategory(name, notes);
  if (!match) return [];
  return [match.tag, ...(CATEGORY_FALLBACKS[match.tag] ?? [])];
}

/** Kategorie-Tag für eine Zutat, oder undefined wenn keine Rohware erkannt wird. */
export function resolveCategoryTag(name: string, notes?: string): string | undefined {
  return resolveCategory(name, notes)?.tag;
}

export interface CategoryMatch {
  tag: string;
  group: EstimateGroup;
  stem: string;
}

export function resolveCategory(name: string, notes?: string): CategoryMatch | undefined {
  const haystack = normalize(`${name} ${notes && !/^(?:oder|alternativ|optional)\b/i.test(notes) ? notes : ""}`);
  if (!haystack) return undefined;

  // Verarbeitungsformen zuerst prüfen: "Hähnchenbrühe" ist keine Hähnchenbrust.
  // Sonst gewinnt der längere Stamm ("hähnchen") und die Brühe würde mit
  // Fleischpreis berechnet – genau der Fehler, den der Brühe-Test absichert.
  if (/(?:brühe|bruehe|bouillon|fond|brühpulver)/.test(haystack) && !/fondue/.test(haystack)) {
    return { tag: "en:broths", group: "bruehe", stem: "form:brühe" };
  }

  // Regeln mit längeren Stämmen zuerst → spezifischere Treffer gewinnen
  const candidates: { rule: CategoryRule; stem: string }[] = [];
  for (const rule of CATEGORY_RULES) {
    for (const stem of rule.stems) {
      const needle = normalize(stem);
      if (needle.length >= 3) {
        if (haystack.includes(needle)) candidates.push({ rule, stem: needle });
      } else if (needle.length === 2) {
        // Kurze Stämme ("ei") nur als ganzes Wort – sonst träfe "ei" auch "Eiscreme" oder "Reis"
        if (new RegExp(`(^|\\s)${needle}(\\s|$)`).test(haystack)) candidates.push({ rule, stem: needle });
      }
    }
  }
  if (candidates.length === 0) return undefined;

  // Wortgrenzen-Treffer bevorzugen ("salat" in "salatgurke" ist schwächer als "gurke")
  candidates.sort((a, b) => {
    const aWord = new RegExp(`(^|\\s)${a.stem}`).test(haystack) ? 1 : 0;
    const bWord = new RegExp(`(^|\\s)${b.stem}`).test(haystack) ? 1 : 0;
    if (aWord !== bWord) return bWord - aWord;
    return b.stem.length - a.stem.length;
  });

  const best = candidates[0];
  return { tag: best.rule.tag, group: best.rule.group, stem: best.stem };
}

/** Nur für Tests/Diagnose: erkennt verarbeitete Formen (Tomatenmark ≠ Tomate). */
export function isProcessedForm(name: string, notes?: string): boolean {
  return NON_RAW_FORMS.test(`${name} ${notes ?? ""}`);
}


