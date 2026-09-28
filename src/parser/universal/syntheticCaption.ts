export interface GroundTruthRecipe {
  titel: string;
  zutaten: string[];
  zubereitung: string[];
  portionen?: number;
}

export type CaptionStyle =
  | "markers"
  | "no_markers"
  | "continuous_text"
  | "emojis"
  | "newlines_sparse"
  | "newlines_dense"
  | "social_media";

/**
 * Generates synthetic captions from structured recipe ground truth in various styles
 * without any external AI or network calls.
 */
export function generateSyntheticCaption(
  recipe: GroundTruthRecipe,
  style: CaptionStyle
): string {
  switch (style) {
    case "markers": {
      const parts: string[] = [];
      parts.push(recipe.titel);
      parts.push("");
      parts.push("Zutaten:");
      recipe.zutaten.forEach((z) => parts.push(`- ${z}`));
      parts.push("");
      parts.push("Zubereitung:");
      recipe.zubereitung.forEach((s, idx) => parts.push(`${idx + 1}. ${s}`));
      return parts.join("\n");
    }

    case "no_markers": {
      const parts: string[] = [];
      parts.push(recipe.titel);
      parts.push("");
      recipe.zutaten.forEach((z) => parts.push(z));
      parts.push("");
      recipe.zubereitung.forEach((s) => parts.push(s));
      return parts.join("\n");
    }

    case "continuous_text": {
      const ingsText = recipe.zutaten.join(", ");
      const stepsText = recipe.zubereitung.join(" Danach ");
      return `${recipe.titel}. Dafür brauchst du: ${ingsText}. Zubereitung: ${stepsText}. Guten Appetit!`;
    }

    case "emojis": {
      const parts: string[] = [];
      parts.push(`✨ ${recipe.titel} ✨`);
      parts.push("");
      parts.push("🛒 ZUTATEN:");
      recipe.zutaten.forEach((z) => parts.push(`👉 ${z}`));
      parts.push("");
      parts.push("👩‍🍳 SO GEHT'S:");
      recipe.zubereitung.forEach((s) => parts.push(`🔥 ${s}`));
      return parts.join("\n");
    }

    case "newlines_sparse": {
      const parts: string[] = [];
      parts.push(recipe.titel);
      parts.push(`Zutaten: ${recipe.zutaten.join(" • ")}`);
      parts.push(`Schritte: ${recipe.zubereitung.join(" | ")}`);
      return parts.join("\n");
    }

    case "newlines_dense": {
      const parts: string[] = [];
      parts.push(recipe.titel);
      parts.push("");
      parts.push("");
      parts.push("Zutaten");
      parts.push("");
      recipe.zutaten.forEach((z) => {
        parts.push(z);
        parts.push("");
      });
      parts.push("Zubereitung");
      parts.push("");
      recipe.zubereitung.forEach((s) => {
        parts.push(s);
        parts.push("");
      });
      return parts.join("\n");
    }

    case "social_media": {
      const parts: string[] = [];
      parts.push(`Das müsst ihr probieren: ${recipe.titel}! 😍`);
      parts.push("");
      parts.push("Speichert euch das Rezept direkt ab 📌");
      parts.push("");
      parts.push("Zutaten:");
      recipe.zutaten.forEach((z) => parts.push(`• ${z}`));
      parts.push("");
      parts.push("Zubereitung:");
      recipe.zubereitung.forEach((s, idx) => parts.push(`${idx + 1}) ${s}`));
      parts.push("");
      parts.push("#rezept #lecker #kochen #foodie #einfacherezepte");
      return parts.join("\n");
    }
  }
}
