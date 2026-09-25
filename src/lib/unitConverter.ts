import { Recipe, Ingredient, RecipeStep } from "@/domain/types";

function convertIngredient(ing: Ingredient): Ingredient {
  if (ing.amount === undefined || !ing.unit) return ing;
  
  const unitStr = ing.unit.toLowerCase().trim();
  const nameStr = ing.name.toLowerCase();
  let amount = ing.amount;
  let unit = ing.unit;

  const isLiquid = /milk|water|milch|wasser|oil|öl|juice|saft|cream|sahne|broth|brühe|wein|wine/i.test(nameStr);
  const liquidUnit = "ml";
  const solidUnit = "g";

  let converted = false;

  if (unitStr === "cup" || unitStr === "cups") {
    unit = isLiquid ? liquidUnit : solidUnit;
    if (nameStr.includes("flour") || nameStr.includes("mehl")) {
      amount = amount * 120;
    } else if (nameStr.includes("sugar") || nameStr.includes("zucker")) {
      amount = amount * 200;
    } else if (nameStr.includes("butter")) {
      amount = amount * 225;
    } else if (isLiquid) {
      amount = amount * 240;
    } else {
      amount = amount * 240; // default
    }
    converted = true;
  } else if (unitStr === "oz" || unitStr === "ounce" || unitStr === "ounces") {
    unit = solidUnit;
    amount = amount * 28;
    converted = true;
  } else if (unitStr === "lb" || unitStr === "lbs" || unitStr === "pound" || unitStr === "pounds") {
    unit = solidUnit;
    amount = amount * 450;
    converted = true;
  } else if (unitStr === "tbsp" || unitStr === "tablespoon" || unitStr === "tablespoons") {
    unit = isLiquid ? liquidUnit : solidUnit;
    amount = amount * 15;
    converted = true;
  } else if (unitStr === "tsp" || unitStr === "teaspoon" || unitStr === "teaspoons") {
    unit = isLiquid ? liquidUnit : solidUnit;
    amount = amount * 5;
    converted = true;
  }

  if (converted) {
    amount = Math.round(amount * 10) / 10;
    if (amount % 1 === 0) amount = Math.round(amount);
    return { ...ing, amount, unit };
  }

  return ing;
}

function convertStep(step: RecipeStep): RecipeStep {
  const regex = /(\d+)\s*°?F/gi;
  let instruction = step.instruction;
  
  if (regex.test(instruction)) {
    instruction = instruction.replace(regex, (match, fStr) => {
      const f = parseInt(fStr, 10);
      const c = Math.round((f - 32) * 5/9);
      return `${c} °C`;
    });
  }

  return { ...step, instruction };
}

export function convertRecipeToMetric(recipe: Recipe): Recipe {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map(convertIngredient),
    steps: recipe.steps.map(convertStep),
  };
}
