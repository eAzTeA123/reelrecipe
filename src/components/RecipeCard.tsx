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

export function RecipeCard({ recipe }: { recipe: Recipe }) {
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
