import type { ParsedRecipe } from "@/domain/types";

// --- UNIT DICTIONARY ---
const UNIT_DE_TO_EN: Record<string, string> = {
  "EL": "tbsp",
  "TL": "tsp",
  "Msp.": "pinch",
  "Stück": "pcs",
  "Prise": "pinch",
  "Bund": "bunch",
  "Dose": "can",
  "Packung": "pkg",
  "Tüte": "bag",
  "Scheibe": "slice",
  "Zehe": "clove",
  "Knolle": "bulb",
  "Kopf": "head",
  "Glas": "jar",
  "Becher": "cup",
  "Handvoll": "handful",
  "Spritzer": "splash",
  "Tropfen": "drop",
  "Blatt": "leaf",
  "Zweig": "sprig",
  "Stange": "stalk",
  "Pfund": "lb",
};

const UNIT_EN_TO_DE: Record<string, string> = {
  "tbsp": "EL",
  "tsp": "TL",
  "pinch": "Prise",
  "pcs": "Stück",
  "bunch": "Bund",
  "can": "Dose",
  "pkg": "Packung",
  "bag": "Tüte",
  "slice": "Scheibe",
  "clove": "Zehe",
  "bulb": "Knolle",
  "head": "Kopf",
  "jar": "Glas",
  "cup": "Tasse", 
  "handful": "Handvoll",
  "splash": "Spritzer",
  "drop": "Tropfen",
  "leaf": "Blatt",
  "sprig": "Zweig",
  "stalk": "Stange",
  "lb": "Pfund",
  "ounce": "Unze",
  "oz": "Unze",
};


// --- INGREDIENT DICTIONARY ---
const ING_EN_TO_DE: Record<string, string> = {
  "garlic": "Knoblauch",
  "onion": "Zwiebel",
  "onions": "Zwiebeln",
  "tomato": "Tomate",
  "tomatoes": "Tomaten",
  "potato": "Kartoffel",
  "potatoes": "Kartoffeln",
  "carrot": "Karotte",
  "carrots": "Karotten",
  "salt": "Salz",
  "pepper": "Pfeffer",
  "sugar": "Zucker",
  "flour": "Mehl",
  "butter": "Butter",
  "oil": "Öl",
  "olive oil": "Olivenöl",
  "water": "Wasser",
  "milk": "Milch",
  "egg": "Ei",
  "eggs": "Eier",
  "cheese": "Käse",
  "chicken": "Hähnchen",
  "beef": "Rindfleisch",
  "pork": "Schweinefleisch",
  "rice": "Reis",
  "pasta": "Nudeln",
  "noodles": "Nudeln",
  "bread": "Brot",
  "lemon": "Zitrone",
  "lime": "Limette",
  "apple": "Apfel",
  "apples": "Äpfel",
  "banana": "Banane",
  "bananas": "Bananen",
  "cream": "Sahne",
  "heavy cream": "Schlagsahne",
  "sour cream": "Schmand",
  "yogurt": "Joghurt",
  "honey": "Honig",
  "vinegar": "Essig",
  "soy sauce": "Sojasauce",
  "mustard": "Senf",
  "mayonnaise": "Mayonnaise",
  "ketchup": "Ketchup",
  "cinnamon": "Zimt",
  "vanilla": "Vanille",
  "ginger": "Ingwer",
  "parsley": "Petersilie",
  "basil": "Basilikum",
  "cilantro": "Koriander",
  "coriander": "Koriander",
  "thyme": "Thymian",
  "rosemary": "Rosmarin",
  "oregano": "Oregano",
  "paprika": "Paprika",
  "cumin": "Kreuzkümmel",
  "nutmeg": "Muskatnuss",
  "baking powder": "Backpulver",
  "baking soda": "Natron",
  "yeast": "Hefe",
  "chocolate": "Schokolade",
  "strawberries": "Erdbeeren",
  "blueberries": "Blaubeeren",
  "spinach": "Spinat",
  "broccoli": "Brokkoli",
  "bell pepper": "Paprika",
  "cucumber": "Gurke",
  "zucchini": "Zucchini",
  "mushroom": "Pilz",
  "mushrooms": "Pilze",
  "almond": "Mandel",
  "almonds": "Mandeln",
  "walnut": "Walnuss",
  "walnuts": "Walnüsse",
  "peanut": "Erdnuss",
  "peanuts": "Erdnüsse",
  "pecan": "Pekannuss",
  "pecans": "Pekannüsse",
  "oats": "Haferflocken",
  "maple syrup": "Ahornsirup",
  "peanut butter": "Erdnussbutter",
  "jam": "Marmelade",
  "beef broth": "Rinderbrühe",
  "chicken broth": "Hühnerbrühe",
  "vegetable broth": "Gemüsebrühe",
  "stock": "Brühe",
  "ground beef": "Rinderhackfleisch",
  "ground pork": "Schweinehackfleisch",
  "ground meat": "Hackfleisch",
  "bouillon": "Brühe",
  "seasoning": "Gewürz",
  "garlic powder": "Knoblauchpulver",
  "onion powder": "Zwiebelpulver",
  "chili powder": "Chilipulver",
  "paprika powder": "Paprikapulver",
  "sweet corn": "Zuckermais",
  "cream cheese": "Frischkäse",
  "cottage cheese": "Hüttenkäse",
  "cheddar cheese": "Cheddar",
  "shredded cheese": "Streukäse",
  "chicken breast": "Hähnchenbrust",
  "thigh": "Keule",
  "pork chop": "Schweinekotelett",
  "sausage": "Wurst",
  "wine": "Wein",
  "red wine": "Rotwein",
  "white wine": "Weißwein",
  "beer": "Bier",
  "sausage": "Wurst",
  "bacon": "Speck",
  "ham": "Schinken",
  "salmon": "Lachs",
  "tuna": "Thunfisch",
  "shrimp": "Garnelen",
  "lentils": "Linsen",
  "chickpeas": "Kichererbsen",
  "beans": "Bohnen",
  "black beans": "schwarze Bohnen",
  "kidney beans": "Kidneybohnen",
  "peas": "Erbsen",
  "corn": "Mais",
  "avocado": "Avocado",
  "cherry tomatoes": "Kirschtomaten",
  "feta": "Feta",
  "mozzarella": "Mozzarella",
  "parmesan": "Parmesan",
  "cheddar": "Cheddar",
  "mint": "Minze",
  "chives": "Schnittlauch",
  "dill": "Dill",
};

const ING_DE_TO_EN: Record<string, string> = {};
for (const [en, de] of Object.entries(ING_EN_TO_DE)) {
  if (!ING_DE_TO_EN[de.toLowerCase()]) {
    ING_DE_TO_EN[de.toLowerCase()] = en;
  }
}
ING_DE_TO_EN["tomatenmark"] = "tomato paste";
ING_DE_TO_EN["schmand"] = "sour cream";
ING_DE_TO_EN["quark"] = "quark cheese";

function detectLanguage(recipe: ParsedRecipe): "en" | "de" {
  let enCount = 0;
  let deCount = 0;

  const textToAnalyze = [
    recipe.title,
    ...recipe.ingredients.map(i => i.name),
    ...recipe.steps.map(s => s.instruction)
  ].join(" ").toLowerCase();

  const enWords = /\b(and|with|the|in|for|of|to|a|cup|tbsp|tsp|add|mix|bake)\b/g;
  const deWords = /\b(und|mit|der|die|das|in|für|von|zu|ein|eine|el|tl|dazu|mischen|backen)\b/g;

  enCount = (textToAnalyze.match(enWords) || []).length;
  deCount = (textToAnalyze.match(deWords) || []).length;

  return enCount > deCount ? "en" : "de";
}

function translateWord(word: string, dict: Record<string, string>): string {
  const lower = word.toLowerCase().trim();
  if (dict[lower]) {
    const isCapitalized = word.charAt(0) === word.charAt(0).toUpperCase();
    const translated = dict[lower];
    if (isCapitalized && translated.length > 0) {
      return translated.charAt(0).toUpperCase() + translated.slice(1);
    }
    return translated;
  }
  
  if (lower.endsWith('s') && dict[lower.slice(0, -1)]) {
    return dict[lower.slice(0, -1)];
  }
  
  return word;
}

function translateIngredientName(name: string, targetLang: "en" | "de"): string {
  const dict = targetLang === "de" ? ING_EN_TO_DE : ING_DE_TO_EN;
  
  if (dict[name.toLowerCase()]) {
    return translateWord(name, dict);
  }
  
  let translatedName = name;
  const words = Object.keys(dict).sort((a, b) => b.length - a.length); 
  
  for (const word of words) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(translatedName)) {
      translatedName = translatedName.replace(regex, (match) => {
        const isCapitalized = match.charAt(0) === match.charAt(0).toUpperCase();
        const t = dict[word];
        return isCapitalized ? t.charAt(0).toUpperCase() + t.slice(1) : t;
      });
    }
  }
  
  return translatedName;
}

export function translateParsedRecipe(recipe: ParsedRecipe, targetLang: "de" | "en"): ParsedRecipe {
  const sourceLang = detectLanguage(recipe);
  
  if (sourceLang === targetLang) {
    return recipe;
  }

  const unitDict = targetLang === "de" ? UNIT_EN_TO_DE : UNIT_DE_TO_EN;

  return {
    ...recipe,
    ingredients: recipe.ingredients.map(ing => {
      let newUnit = ing.unit;
      if (newUnit) {
        newUnit = unitDict[newUnit] || unitDict[newUnit.toLowerCase()] || newUnit;
      }
      
      const newName = translateIngredientName(ing.name, targetLang);
      
      return {
        ...ing,
        unit: newUnit,
        name: newName
      };
    }),
  };
}
