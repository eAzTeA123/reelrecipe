"use client";

import Link from "next/link";
import type { Recipe } from "@/domain/types";
import { getRecipeRepository } from "@/data";
import { RecipeImage } from "./RecipeImage";
import { IconClock, IconHeart, IconHeartFill, IconUsers } from "./Icons";

function totalTime(r: Recipe): number | undefined {
  const t = (r.prepTime ?? 0) + (r.cookTime ?? 0);
  return t > 0 ? t : undefined;
}

export function RecipeCard({
  recipe,
  matchPercentage,
  missingIngredients,
}: {
  recipe: Recipe;
  matchPercentage?: number;
  missingIngredients?: string[];
}) {
  const time = totalTime(recipe);
  return (
    <article className="group relative block border-b-2 border-line pb-8 mb-8 last:border-b-0">
      <Link href={`/recipes/${recipe.id}`} className="block pressable" aria-label={recipe.title}>
        {recipe.image && (
          <div className="relative aspect-[4/5] w-full overflow-hidden mb-4">
            <RecipeImage
              imageRef={recipe.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          {recipe.category && (
            <span className="text-[14px] font-bold uppercase tracking-widest text-accent">
              {recipe.category}
            </span>
          )}
          <h3 className="text-[28px] font-extrabold leading-none tracking-tight group-hover:text-accent transition-colors">
            {recipe.title}
          </h3>
          
          {matchPercentage !== undefined && (
            <div className="mt-3 flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-2.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 font-bold ${
                    matchPercentage >= 0.8
                      ? "text-emerald-600"
                      : matchPercentage >= 0.5
                      ? "text-amber-600"
                      : "text-ink-2"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      matchPercentage >= 0.8
                        ? "bg-emerald-500"
                        : matchPercentage >= 0.5
                        ? "bg-amber-500"
                        : "bg-ink-3"
                    }`}
                  />
                  {Math.round(matchPercentage * 100)}% Match
                  {matchPercentage >= 1 && " • Alles da!"}
                </span>
                {missingIngredients && (
                  <span className="text-[12px] text-ink-3">
                    {recipe.ingredients.length - missingIngredients.length}/{recipe.ingredients.length} Zutaten
                  </span>
                )}
              </div>
              {missingIngredients && missingIngredients.length > 0 && (
                <p className="text-[12px] text-ink-2 line-clamp-1">
                  <span className="font-semibold text-ink">Fehlt noch:</span>{" "}
                  {missingIngredients.slice(0, 3).join(", ")}
                  {missingIngredients.length > 3 ? ` (+${missingIngredients.length - 3})` : ""}
                </p>
              )}
            </div>
          )}

          {(time !== undefined || recipe.servings !== undefined) && (
            <div className="mt-2 flex items-center gap-6 text-[15px] font-medium text-ink-2">
              {time !== undefined && (
                <span className="inline-flex items-center gap-2">
                  <IconClock size={18} /> {time} Min
                </span>
              )}
              {recipe.servings !== undefined && (
                <span className="inline-flex items-center gap-2">
                  <IconUsers size={18} /> {recipe.servings}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => void getRecipeRepository().toggleFavorite(recipe.id)}
        aria-label={recipe.favorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
        aria-pressed={recipe.favorite}
        className={`pressable absolute right-2 top-2 flex h-14 w-14 items-center justify-center bg-surface ${
          recipe.favorite ? "text-accent" : "text-ink"
        } hover:bg-line transition-colors`}
      >
        {recipe.favorite ? <IconHeartFill size={24} /> : <IconHeart size={24} />}
      </button>
    </article>
  );
}
