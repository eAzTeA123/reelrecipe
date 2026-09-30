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

/**
 * Cover einer Karte: echtes Bild, sonst eine warme Papierfläche. Den Titel
 * trägt immer die Überschrift unter dem Cover – so steht jeder Titel genau
 * einmal im Text (wichtig für Screenreader und für die Textsuche im Browser).
 */
export function RecipeCover({
  recipe,
  className = "",
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}: {
  recipe: Recipe;
  className?: string;
  sizes?: string;
}) {
  const tone = recipe.color ?? "#c0563a";
  return (
    <div
      className={`relative overflow-hidden rounded-frame ${className}`}
      style={recipe.image ? { backgroundColor: `${tone}1f` } : undefined}
    >
      {recipe.image ? (
        <>
          <RecipeImage
            imageRef={recipe.image}
            alt=""
            sizes={sizes}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
          {/* Scrim: gibt dem Herz oben rechts Halt, ohne das Foto zu verdecken */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 to-black/5" />
        </>
      ) : (
        <div
          className="texture-grain absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 18% 0%, ${tone}2e 0%, transparent 62%), linear-gradient(160deg, #f6ede1 0%, #ecdfcd 100%)`,
          }}
        />
      )}
      {/* Innenkante statt Rahmen: hält das Foto auch bei hellen Motiven zusammen */}
      <div className="pointer-events-none absolute inset-0 rounded-frame ring-1 ring-inset ring-ink/10" />
    </div>
  );
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
    <article className="group relative flex flex-col">
      <Link href={`/recipes/${recipe.id}`} className="block pressable" aria-label={recipe.title}>
        <RecipeCover
          recipe={recipe}
          className={`aspect-[4/3] w-full shadow-card sm:aspect-[4/5] ${
            matchPercentage === undefined ? "card-hover" : ""
          }`}
        />

        <div className="mt-3.5 flex flex-col gap-1.5">
          {recipe.category && (
            <span className="text-label font-semibold text-accent">{recipe.category}</span>
          )}
          <h3 className="font-display text-card text-ink transition-colors group-hover:text-accent">
            {recipe.title}
          </h3>

          {matchPercentage !== undefined && (
            <div className="mt-2 flex flex-col gap-1.5 rounded-ctl border border-line bg-surface p-3 text-meta">
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 font-bold ${
                    matchPercentage >= 0.8
                      ? "text-good"
                      : matchPercentage >= 0.5
                        ? "text-warn"
                        : "text-ink-2"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-pill ${
                      matchPercentage >= 0.8
                        ? "bg-good"
                        : matchPercentage >= 0.5
                          ? "bg-warn"
                          : "bg-ink-3"
                    }`}
                  />
                  {Math.round(matchPercentage * 100)}% Match
                  {matchPercentage >= 1 && " · Alles da"}
                </span>
                {missingIngredients && (
                  <span className="nums text-label text-ink-3">
                    {recipe.ingredients.length - missingIngredients.length}/
                    {recipe.ingredients.length} Zutaten
                  </span>
                )}
              </div>
              {missingIngredients && missingIngredients.length > 0 && (
                <p className="line-clamp-1 text-label text-ink-2">
                  <span className="font-semibold text-ink">Fehlt noch:</span>{" "}
                  {missingIngredients.slice(0, 3).join(", ")}
                  {missingIngredients.length > 3 ? ` (+${missingIngredients.length - 3})` : ""}
                </p>
              )}
            </div>
          )}

          {(time !== undefined || recipe.servings !== undefined) && (
            <div className="nums mt-1 flex items-center gap-5 text-meta font-medium text-ink-2">
              {time !== undefined && (
                <span className="inline-flex items-center gap-1.5">
                  <IconClock size={16} /> {time} Min
                </span>
              )}
              {recipe.servings !== undefined && (
                <span className="inline-flex items-center gap-1.5">
                  <IconUsers size={16} /> {recipe.servings}
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
        className={`pressable absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-pill backdrop-blur transition-colors ${
          recipe.favorite
            ? "bg-surface/90 text-accent"
            : "bg-surface/80 text-ink/70 hover:bg-surface hover:text-ink"
        }`}
      >
        {recipe.favorite ? <IconHeartFill size={20} /> : <IconHeart size={20} />}
      </button>
    </article>
  );
}
