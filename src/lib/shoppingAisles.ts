// src/lib/shoppingAisles.ts

const AISLE_MAPPING: Record<string, string> = {
  // Gemüse & Obst / Produce
  "tomate": "Gemüse & Obst",
  "tomaten": "Gemüse & Obst",
  "zwiebel": "Gemüse & Obst",
  "zwiebeln": "Gemüse & Obst",
  "knoblauch": "Gemüse & Obst",
  "kartoffel": "Gemüse & Obst",
  "kartoffeln": "Gemüse & Obst",
  "apfel": "Gemüse & Obst",
  "äpfel": "Gemüse & Obst",
  "zitrone": "Gemüse & Obst",
  "zitronen": "Gemüse & Obst",
  "banane": "Gemüse & Obst",
  "bananen": "Gemüse & Obst",
  "karotte": "Gemüse & Obst",
  "karotten": "Gemüse & Obst",
  "möhre": "Gemüse & Obst",
  "möhren": "Gemüse & Obst",
  "gurke": "Gemüse & Obst",
  "gurken": "Gemüse & Obst",
  "paprika": "Gemüse & Obst",
  "lauch": "Gemüse & Obst",
  "frühlingszwiebel": "Gemüse & Obst",
  "frühlingszwiebeln": "Gemüse & Obst",
  "spinat": "Gemüse & Obst",
  "salat": "Gemüse & Obst",
  "ingwer": "Gemüse & Obst",
  "chili": "Gemüse & Obst",
  "koriander": "Gemüse & Obst",
  "petersilie": "Gemüse & Obst",
  "basilikum": "Gemüse & Obst",
  "minze": "Gemüse & Obst",
  "rosmarin": "Gemüse & Obst",
  "thymian": "Gemüse & Obst",
  
  // Kühlregal / Dairy & Fridge
  "milch": "Kühlregal",
  "butter": "Kühlregal",
  "käse": "Kühlregal",
  "joghurt": "Kühlregal",
  "sahne": "Kühlregal",
  "quark": "Kühlregal",
  "schmand": "Kühlregal",
  "crème fraîche": "Kühlregal",
  "creme fraiche": "Kühlregal",
  "ei": "Kühlregal",
  "eier": "Kühlregal",
  "mozzarella": "Kühlregal",
  "parmesan": "Kühlregal",
  "feta": "Kühlregal",
  "frischkäse": "Kühlregal",

  // Trockenprodukte / Pantry
  "nudeln": "Trockenprodukte",
  "spaghetti": "Trockenprodukte",
  "pasta": "Trockenprodukte",
  "reis": "Trockenprodukte",
  "mehl": "Trockenprodukte",
  "zucker": "Trockenprodukte",
  "salz": "Trockenprodukte",
  "haferflocken": "Trockenprodukte",
  "linsen": "Trockenprodukte",
  "kichererbsen": "Trockenprodukte",
  "bohnen": "Trockenprodukte",
  "couscous": "Trockenprodukte",
  "bulgur": "Trockenprodukte",
  "quinoa": "Trockenprodukte",
  "brot": "Trockenprodukte",
  "paniermehl": "Trockenprodukte",
  "toast": "Trockenprodukte",
  
  // Gewürze / Spices
  "pfeffer": "Gewürze & Backzutaten",
  "paprikapulver": "Gewürze & Backzutaten",
  "curry": "Gewürze & Backzutaten",
  "kurkuma": "Gewürze & Backzutaten",
  "kreuzkümmel": "Gewürze & Backzutaten",
  "zimt": "Gewürze & Backzutaten",
  "muskatnuss": "Gewürze & Backzutaten",
  "oregano": "Gewürze & Backzutaten",
  "backpulver": "Gewürze & Backzutaten",
  "vanille": "Gewürze & Backzutaten",
  "vanillezucker": "Gewürze & Backzutaten",
  "hefe": "Gewürze & Backzutaten",
  
  // Saucen & Öle / Sauces & Oils
  "öl": "Saucen & Öle",
  "olivenöl": "Saucen & Öle",
  "sonnenblumenöl": "Saucen & Öle",
  "rapsöl": "Saucen & Öle",
  "essig": "Saucen & Öle",
  "balsamico": "Saucen & Öle",
  "sojasauce": "Saucen & Öle",
  "senf": "Saucen & Öle",
  "ketchup": "Saucen & Öle",
  "mayonnaise": "Saucen & Öle",
  "tomateneinlage": "Saucen & Öle",
  "tomatenmark": "Saucen & Öle",
  "passierte tomaten": "Saucen & Öle",
  "stückige tomaten": "Saucen & Öle",
  
  // Fleisch & Fisch / Meat & Fish
  "fleisch": "Fleisch & Fisch",
  "hähnchen": "Fleisch & Fisch",
  "hähnchenbrust": "Fleisch & Fisch",
  "rindfleisch": "Fleisch & Fisch",
  "schweinefleisch": "Fleisch & Fisch",
  "hackfleisch": "Fleisch & Fisch",
  "speck": "Fleisch & Fisch",
  "wurst": "Fleisch & Fisch",
  "fisch": "Fleisch & Fisch",
  "lachs": "Fleisch & Fisch",
  "thunfisch": "Fleisch & Fisch",
  "garnelen": "Fleisch & Fisch",

  // English common
  "tomato": "Gemüse & Obst",
  "tomatoes": "Gemüse & Obst",
  "onion": "Gemüse & Obst",
  "onions": "Gemüse & Obst",
  "garlic": "Gemüse & Obst",
  "potato": "Gemüse & Obst",
  "potatoes": "Gemüse & Obst",
  "milk": "Kühlregal",
  "cheese": "Kühlregal",
  "egg": "Kühlregal",
  "eggs": "Kühlregal",
  "rice": "Trockenprodukte",
  "flour": "Trockenprodukte",
  "sugar": "Trockenprodukte",
  "salt": "Trockenprodukte",
  "pepper": "Gewürze & Backzutaten",
  "oil": "Saucen & Öle",
  "olive oil": "Saucen & Öle",
  "chicken": "Fleisch & Fisch",
  "beef": "Fleisch & Fisch",
  "pork": "Fleisch & Fisch",
  "fish": "Fleisch & Fisch",
};

export function getAisle(ingredientName: string): string {
  const normalized = ingredientName.trim().toLowerCase();
  
  if (AISLE_MAPPING[normalized]) {
    return AISLE_MAPPING[normalized];
  }
  
  const words = normalized.split(/\s+/);
  for (const word of words) {
    if (AISLE_MAPPING[word]) {
      return AISLE_MAPPING[word];
    }
  }
  
  for (const [key, aisle] of Object.entries(AISLE_MAPPING)) {
    if (normalized.includes(key)) {
      return aisle;
    }
  }

  return "Sonstiges";
}
