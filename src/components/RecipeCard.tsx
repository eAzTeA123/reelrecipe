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
    <article className="card-hover group relative overflow-hidden rounded-card border border-line/70 bg-surface shadow-card">
      <Link href={`/recipes/${recipe.id}`} className="block" aria-label={recipe.title}>
        {recipe.image && (
          <div className="relative aspect-[16/9] w-full">
            <RecipeImage
              imageRef={recipe.image}
              alt=""
              className="absolute inset-0 h-full w-full"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          </div>
        )}
        <div className="flex min-h-24 flex-col justify-between gap-4 p-4">
          <div>
            <div className="mb-2 flex min-h-7 items-start justify-between gap-10">
              {recipe.category ? (
                <span className="max-w-full truncate rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">
                  {recipe.category}
                </span>
              ) : (
                <span />
              )}
            </div>
            <h3 className="line-clamp-2 text-[19px] font-semibold leading-snug tracking-[-0.01em]">
              {recipe.title}
            </h3>
            {recipe.description && (
              <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-ink-2">
                {recipe.description}
              </p>
            )}
          </div>
          {(time !== undefined || recipe.servings !== undefined) && (
            <div className="flex items-center gap-4 text-[13px] font-medium text-ink-2">
              {time !== undefined && (
                <span className="inline-flex items-center gap-1.5">
                  <IconClock size={15} /> {time} Min
                </span>
              )}
              {recipe.servings !== undefined && (
                <span className="inline-flex items-center gap-1.5">
                  <IconUsers size={15} /> {recipe.servings} Portionen
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
        className={`pressable absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 backdrop-blur ${
          recipe.favorite ? "text-accent" : "text-ink-2"
        }`}
      >
        {recipe.favorite ? <IconHeartFill size={18} /> : <IconHeart size={18} />}
      </button>
    </article>
  );
}
