"use client";
import { useI18n } from "@/lib/i18n/context";

import { useState } from "react";
import Link from "next/link";
import { useRecipes } from "@/hooks/useRecipes";
import { PageHeader } from "@/components/PageHeader";
import { RecipeCard } from "@/components/RecipeCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SearchField } from "@/components/SearchField";
import { CategoryChips } from "@/components/CategoryPicker";
import { Button } from "@/components/Button";
import { IconPlus } from "@/components/Icons";

export default function RecipesPage() {

  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [sort, setSort] = useState<"newest" | "oldest" | "title" | "time">("newest");
  const { recipes, loading, error, retry } = useRecipes({ query, category });
  const sorted = [...recipes].sort((a, b) => {
    if (sort === "oldest") return a.createdAt - b.createdAt;
    if (sort === "title") return a.title.localeCompare(b.title, "de");
    if (sort === "time") {
      const timeA = (a.prepTime ?? 0) + (a.cookTime ?? 0);
      const timeB = (b.prepTime ?? 0) + (b.cookTime ?? 0);
      // Rezepte ohne Zeitangabe (0) sollen ganz nach hinten!
      if (timeA === 0 && timeB > 0) return 1;
      if (timeB === 0 && timeA > 0) return -1;
      return timeA - timeB;
    }
    return b.createdAt - a.createdAt;
  });

  return (
    <>
      <PageHeader
        title={t("nav.recipes")}
        subtitle={`${recipes.length} ${recipes.length === 1 ? t("nav.home") : t("nav.recipes")}`}
        action={
          <Link
            href="/recipes/new"
            aria-label="Rezept manuell anlegen"
            className="pressable inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-ink"
          >
            <IconPlus size={20} />
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="Titel oder Zutat suchen" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CategoryChips value={category} onChange={setCategory} allowAll />
          <label className="flex items-center gap-2 text-[14px] font-medium text-ink-2">
            Sortieren
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-11 rounded-ctl border border-line bg-surface px-3 text-[15px] text-ink focus:border-accent focus:outline-none"
            >
              <option value="newest">Neueste</option>
              <option value="oldest">Älteste</option>
              <option value="title">Titel A–Z</option>
              <option value="time">Kürzeste Zeit</option>
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="pulse-soft aspect-[4/3] rounded-card bg-black/[0.04]" />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="rounded-card bg-surface shadow-card">
          <EmptyState
            title={query || category ? t("recipes.emptyTitle") : t("home.emptyTitle")}
            subtitle={
              query || category
                ? "Versuche einen anderen Suchbegriff oder eine andere Kategorie."
                : t("home.emptySubtitle")
            }
            action={
              !query && !category ? (
                <Link href="/import">
                  <Button size="lg">{t("import.title")}</Button>
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {sorted.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </>
  );
}
