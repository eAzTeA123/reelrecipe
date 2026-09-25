import { Recipe, Ingredient, RecipeStep } from "@/domain/types";

// --- US -> METRIC ---
function convertIngredientToMetric(ing: Ingredient): Ingredient {
  if (ing.amount === undefined || !ing.unit) return ing;

  const unitStr = ing.unit.toLowerCase().trim();
  const nameStr = ing.name.toLowerCase();
  let amount = ing.amount;
  let unit = ing.unit;

  const isLiquid =
    /milk|water|milch|wasser|oil|öl|juice|saft|cream|sahne|broth|brühe|wein|wine|sauce|vinegar|essig/i.test(
      nameStr
    );
  const liquidUnit = "ml";
  const solidUnit = "g";

  let converted = false;

  // Cups, Tassen, Becher
  if (["cup", "cups", "tasse", "tassen", "becher"].includes(unitStr)) {
    unit = isLiquid ? liquidUnit : solidUnit;
    if (nameStr.includes("flour") || nameStr.includes("mehl")) {
      amount = amount * 120;
    } else if (nameStr.includes("powdered sugar") || nameStr.includes("puderzucker")) {
      amount = amount * 120;
    } else if (nameStr.includes("sugar") || nameStr.includes("zucker")) {
      amount = amount * 200;
    } else if (nameStr.includes("butter")) {
      amount = amount * 225;
    } else if (nameStr.includes("oat") || nameStr.includes("haferflocken")) {
      amount = amount * 90;
    } else if (nameStr.includes("rice") || nameStr.includes("reis")) {
      amount = amount * 185;
    } else if (
      nameStr.includes("honey") ||
      nameStr.includes("honig") ||
      nameStr.includes("syrup") ||
      nameStr.includes("sirup")
    ) {
      amount = amount * 340;
    } else if (isLiquid) {
      amount = amount * 240;
    } else {
      amount = amount * 220; // solider Standardwert
    }
    converted = true;
  }
  // Fluid ounces
  else if (["fl oz", "fl. oz", "fluid ounce", "fluid ounces"].includes(unitStr)) {
    unit = "ml";
    amount = amount * 30;
    converted = true;
  }
  // Dry ounces
  else if (["oz", "ounce", "ounces", "unze", "unzen"].includes(unitStr)) {
    unit = solidUnit;
    amount = amount * 28.35;
    converted = true;
  }
  // Pounds
  else if (["lb", "lbs", "pound", "pounds", "pfund"].includes(unitStr)) {
    unit = solidUnit;
    amount = amount * 450;
    converted = true;
  }
  // Tablespoons (US) -> EL oder ml
  else if (["tbsp", "tablespoon", "tablespoons"].includes(unitStr)) {
    unit = isLiquid ? "ml" : "EL";
    amount = isLiquid ? amount * 15 : amount;
    converted = true;
  }
  // Teaspoons (US) -> TL oder ml
  else if (["tsp", "teaspoon", "teaspoons"].includes(unitStr)) {
    unit = isLiquid ? "ml" : "TL";
    amount = isLiquid ? amount * 5 : amount;
    converted = true;
  }

  if (converted) {
    amount = Math.round(amount * 10) / 10;
    if (amount % 1 === 0) amount = Math.round(amount);
    return { ...ing, amount, unit };
  }

  return ing;
}

// Convert °F to °C in instructions
function convertStepToMetric(step: RecipeStep): RecipeStep {
  let instruction = step.instruction;

  // Ranges: "350-375°F" oder "350–375 F"
  const rangeRegex = /(\d+)\s*(?:–|-)\s*(\d+)\s*(?:°\s*|deg(?:rees?)?\s*)?F\b/gi;
  instruction = instruction.replace(rangeRegex, (_, f1, f2) => {
    const c1 = Math.round(((parseInt(f1, 10) - 32) * 5) / 9);
    const c2 = Math.round(((parseInt(f2, 10) - 32) * 5) / 9);
    return `${c1}–${c2} °C`;
  });

  // Single: "350°F", "350 degrees F"
  const singleRegex = /(\d+)\s*(?:°\s*|deg(?:rees?)?\s*)?F\b/gi;
  instruction = instruction.replace(singleRegex, (_, fStr) => {
    const f = parseInt(fStr, 10);
    const c = Math.round(((f - 32) * 5) / 9);
    return `${c} °C`;
  });

  return { ...step, instruction };
}

// --- METRIC -> US (IMPERIAL) ---
function convertIngredientToImperial(ing: Ingredient): Ingredient {
  if (ing.amount === undefined || !ing.unit) return ing;

  const unitStr = ing.unit.toLowerCase().trim();
  const nameStr = ing.name.toLowerCase();
  let amount = ing.amount;
  let unit = ing.unit;

  let converted = false;

  if (["g", "gramm", "grams"].includes(unitStr)) {
    if (nameStr.includes("flour") || nameStr.includes("mehl")) {
      amount = amount / 120;
      unit = amount >= 1.5 ? "cups" : "cup";
      converted = true;
    } else if (nameStr.includes("sugar") || nameStr.includes("zucker")) {
      amount = amount / 200;
      unit = amount >= 1.5 ? "cups" : "cup";
      converted = true;
    } else if (nameStr.includes("butter")) {
      amount = amount / 225;
      unit = amount >= 1.5 ? "cups" : "cup";
      converted = true;
    } else if (amount >= 450) {
      amount = amount / 453.6;
      unit = "lbs";
      converted = true;
    } else if (amount >= 28) {
      amount = amount / 28.35;
      unit = "oz";
      converted = true;
    }
  } else if (["ml", "milliliter"].includes(unitStr)) {
    if (amount >= 120) {
      amount = amount / 240;
      unit = amount >= 1.5 ? "cups" : "cup";
      converted = true;
    } else if (amount >= 30) {
      amount = amount / 30;
      unit = "fl oz";
      converted = true;
    } else if (amount >= 15) {
      amount = amount / 15;
      unit = "tbsp";
      converted = true;
    }
  } else if (unitStr === "el") {
    unit = "tbsp";
    converted = true;
  } else if (unitStr === "tl") {
    unit = "tsp";
    converted = true;
  }

  if (converted) {
    amount = Math.round(amount * 10) / 10;
    if (amount % 1 === 0) amount = Math.round(amount);
    return { ...ing, amount, unit };
  }

  return ing;
}

// Convert °C to °F in instructions
function convertStepToImperial(step: RecipeStep): RecipeStep {
  let instruction = step.instruction;

  // Ranges: "180–200°C"
  const rangeRegex = /(\d+)\s*(?:–|-)\s*(\d+)\s*(?:°\s*|deg(?:rees?)?\s*)?C\b/gi;
  instruction = instruction.replace(rangeRegex, (_, c1, c2) => {
    const f1 = Math.round((parseInt(c1, 10) * 9) / 5 + 32);
    const f2 = Math.round((parseInt(c2, 10) * 9) / 5 + 32);
    return `${f1}–${f2} °F`;
  });

  // Single: "180°C"
  const singleRegex = /(\d+)\s*(?:°\s*|deg(?:rees?)?\s*)?C\b/gi;
  instruction = instruction.replace(singleRegex, (_, cStr) => {
    const c = parseInt(cStr, 10);
    const f = Math.round((c * 9) / 5 + 32);
    return `${f} °F`;
  });

  return { ...step, instruction };
}

export function convertRecipeToMetric(recipe: Recipe): Recipe {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map(convertIngredientToMetric),
    steps: recipe.steps.map(convertStepToMetric),
  };
}

export function convertRecipeToImperial(recipe: Recipe): Recipe {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map(convertIngredientToImperial),
    steps: recipe.steps.map(convertStepToImperial),
  };
}
