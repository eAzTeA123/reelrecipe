import type { Recipe } from "@/domain/types";

export async function generateShareLink(recipe: Recipe): Promise<string> {
  const payload = {
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    ingredients: recipe.ingredients.map((i) => ({
      name: i.name,
      amount: i.amount,
      unit: i.unit,
      notes: i.notes,
    })),
    steps: recipe.steps.map((s) => s.instruction),
    color: recipe.color,
    sourceUrl: recipe.sourceUrl,
  };

  const json = JSON.stringify(payload);
  const baseUrl = window.location.origin;
  const fullUrl = `${baseUrl}/import?share=${encodeURIComponent(json)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const res = await fetch("https://pcmb.fyi/api/compress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: fullUrl }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const shortUrl = await res.text();
      return shortUrl.trim();
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("Link compression failed", err);
  }

  return fullUrl;
}
