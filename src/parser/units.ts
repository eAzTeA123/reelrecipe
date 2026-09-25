export interface UnitDef {
  /** kanonische Darstellung */
  label: string;
  aliases: string[];
}

export const UNITS: UnitDef[] = [
  { label: "kg", aliases: ["kg", "kilo", "kilogramm", "kilogram", "kilograms"] },
  { label: "g", aliases: ["g", "gr", "gramm", "gram", "grams"] },
  { label: "mg", aliases: ["mg", "milligramm", "milligram"] },
  { label: "l", aliases: ["l", "liter", "litre", "liters", "litres"] },
  { label: "dl", aliases: ["dl", "deziliter", "deciliter", "decilitre"] },
  { label: "ml", aliases: ["ml", "milliliter", "millilitre", "milliliters"] },
  { label: "cl", aliases: ["cl", "centiliter", "centilitre"] },
  { label: "EL", aliases: ["el", "el.", "esslöffel", "essloeffel", "tbsp", "tbsp.", "tablespoon", "tablespoons"] },
  { label: "TL", aliases: ["tl", "tl.", "teelöffel", "teeloeffel", "tsp", "tsp.", "teaspoon", "teaspoons"] },
  { label: "Msp.", aliases: ["msp", "msp.", "messerspitze"] },
  { label: "cup", aliases: ["cup", "cups", "tasse", "tassen"] },
  { label: "oz", aliases: ["oz", "ounce", "ounces", "unze", "unzen"] },
  { label: "fl oz", aliases: ["fl oz", "fl. oz.", "fluid ounce", "fluid ounces"] },
  { label: "lb", aliases: ["lb", "lbs", "pound", "pounds", "pfund"] },
  { label: "stick", aliases: ["stick", "sticks"] },
  { label: "Stück", aliases: ["stück", "stueck", "st", "stk", "stk.", "pcs", "pcs.", "piece", "pieces"] },
  { label: "Prise", aliases: ["prise", "prisen", "pinch", "pinches"] },
  { label: "Bund", aliases: ["bund", "bündel", "bunch", "bunches"] },
  { label: "Dose", aliases: ["dose", "dosen", "can", "cans"] },
  { label: "Packung", aliases: ["packung", "pck", "pck.", "päckchen", "paeckchen", "package", "pack", "packet", "pkg"] },
  { label: "Tüte", aliases: ["tüte", "tüten", "tuete", "tueten", "beutel", "sachet", "sachets"] },
  { label: "Scheibe", aliases: ["scheibe", "scheiben", "slice", "slices"] },
  { label: "Zehe", aliases: ["zehe", "zehen", "clove", "cloves"] },
  { label: "Knolle", aliases: ["knolle", "knollen", "bulb", "bulbs"] },
  { label: "Kopf", aliases: ["kopf", "köpfe", "koepfe", "head", "heads"] },
  { label: "Glas", aliases: ["glas", "gläser", "glaeser", "jar", "jars"] },
  { label: "Becher", aliases: ["becher"] },
  { label: "Handvoll", aliases: ["handvoll", "handful", "handfuls"] },
  { label: "Spritzer", aliases: ["spritzer", "splash", "splashes", "schuss"] },
  { label: "Tropfen", aliases: ["tropfen", "drop", "drops"] },
  { label: "Blatt", aliases: ["blatt", "blätter", "blaetter", "leaf", "leaves", "sheet", "sheets"] },
  { label: "Zweig", aliases: ["zweig", "zweige", "sprig", "sprigs"] },
  { label: "Stange", aliases: ["stange", "stangen", "stalk", "stalks"] },
];

const sortedAliases = UNITS.flatMap((u) => u.aliases.map((a) => ({ alias: a, label: u.label })))
  .sort((a, b) => b.alias.length - a.alias.length);

const aliasToLabel = new Map(sortedAliases.map((a) => [a.alias, a.label]));

// Word-Boundary für Unicode-Buchstaben
const LB = "(?<![\\p{L}])";
const LA = "(?![\\p{L}])";

export const UNIT_REGEX = new RegExp(
  `${LB}(${sortedAliases.map((a) => a.alias.replace(".", "\\.")).join("|")})${LA}`,
  "iu",
);

export const UNIT_START_REGEX = new RegExp(`^${UNIT_REGEX.source}`, "iu");

export function canonicalUnit(raw: string): string | undefined {
  return aliasToLabel.get(raw.toLowerCase().replace(/\.$/, ""));
}

export const UNIT_LABELS = UNITS.map((u) => u.label);
