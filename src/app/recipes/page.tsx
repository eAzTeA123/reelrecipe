"use client";

import { useI18n } from "@/lib/i18n/context";
import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRecipes } from "@/hooks/useRecipes";
import { PageHeader } from "@/components/PageHeader";
import { RecipeCard } from "@/components/RecipeCard";
import { Reveal } from "@/components/Reveal";
import { RecipeCardSkeleton } from "@/components/RecipeCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SearchField } from "@/components/SearchField";
import { CategoryChips } from "@/components/CategoryPicker";
import { Button } from "@/components/Button";
import { IconPlus, IconFridge, IconGrid, IconDice, IconFolder, IconFilter, IconChevronDown, IconX } from "@/components/Icons";
import { normalizeForSearch } from "@/lib/text";
import { FridgeSearch } from "@/components/FridgeSearch";

function RecipesContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "fridge" ? "fridge" : "all";

  const [mode, setMode] = useState<"all" | "fridge">(initialMode);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [sort, setSort] = useState<"newest" | "oldest" | "title" | "time">("newest");
  const [fridgeIngredients, setFridgeIngredients] = useState<string[]>([]);
  /** Auf dem Handy ist die Filterleiste eingeklappt, damit Rezepte sofort sichtbar sind. */
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = category ? 1 : 0;

  const { recipes: allRecipes, loading, error, retry } = useRecipes({
    query: mode === "fridge" ? "" : query,
    category: mode === "fridge" ? undefined : category,
  });

  /**
   * Eigene Filter (Kategorie, Zeiten, Zutaten …) gehören zu den **Sammlungen**;
   * diese Liste filtert nur nach Suche und Kategorie.
   */
  const recipes = allRecipes;

  const processedRecipes = useMemo(() => {
    if (mode === "all") {
      return [...recipes]
        .sort((a, b) => {
          if (sort === "oldest") return a.createdAt - b.createdAt;
          if (sort === "title") return a.title.localeCompare(b.title, "de");
          if (sort === "time") {
            const timeA = (a.prepTime ?? 0) + (a.cookTime ?? 0);
            const timeB = (b.prepTime ?? 0) + (b.cookTime ?? 0);
            if (timeA === 0 && timeB > 0) return 1;
            if (timeB === 0 && timeA > 0) return -1;
            return timeA - timeB;
          }
          return b.createdAt - a.createdAt;
        })
        .map((r) => ({ recipe: r, matchPercentage: undefined, missingIngredients: undefined }));
    }

    // Kühlschrank-Modus
    const normalizedUserIngredients = fridgeIngredients.map(normalizeForSearch).filter(Boolean);

    if (normalizedUserIngredients.length === 0) {
      return [];
    }

    const matched = recipes.map((recipe) => {
      let matchedCount = 0;
      const missingIngredients: string[] = [];

      recipe.ingredients.forEach((ri) => {
        const norm = normalizeForSearch(ri.name);
        const isMatch = normalizedUserIngredients.some(
          (ui) => norm.includes(ui) || ui.includes(norm)
        );
        if (isMatch) {
          matchedCount++;
        } else {
          missingIngredients.push(ri.name);
        }
      });

      const matchPercentage =
        recipe.ingredients.length > 0 ? matchedCount / recipe.ingredients.length : 0;
      return { recipe, matchPercentage, matchedCount, missingIngredients };
    }).filter(m => m.matchedCount > 0);

    // Nach Match-Prozentsatz sortieren, bei Gleichstand nach absoluter Anzahl Treffer
    matched.sort((a, b) => {
      if (b.matchPercentage !== a.matchPercentage) {
        return b.matchPercentage - a.matchPercentage;
      }
      return b.matchedCount - a.matchedCount;
    });

    return matched;
  }, [recipes, mode, sort, fridgeIngredients]);

  return (
    <>
      <PageHeader
        title={t("nav.recipes")}
        subtitle={
          // Während des Ladens keine Zahl behaupten – sonst steht dort kurz „0 Rezepte".
          loading
            ? undefined
            : `${recipes.length} ${
                recipes.length === 1 ? t("recipes.countSingular") : t("recipes.countPlural")
              }`
        }
        action={
          <div className="flex gap-2">
            <Link
              href="/collections"
              aria-label={t("collections.title")}
              className="pressable inline-flex h-11 w-11 items-center justify-center rounded-pill border border-line bg-surface text-ink-2 hover:text-ink"
            >
              <IconFolder size={20} />
            </Link>
            <Link
              href="/bingo"
              aria-label="Rezept-Bingo spielen"
              className="pressable inline-flex h-11 w-11 items-center justify-center rounded-pill border border-line bg-surface text-ink-2 hover:text-ink"
            >
              <IconDice size={20} />
            </Link>
            <Link
              href="/recipes/new"
              aria-label="Rezept manuell anlegen"
              className="pressable inline-flex h-11 w-11 items-center justify-center rounded-pill bg-accent text-accent-ink shadow-[0_1px_2px_rgba(58,38,24,0.16)] hover:bg-[#a8452c]"
            >
              <IconPlus size={20} />
            </Link>
          </div>
        }
      />

      {/* Modus-Umschalter */}
      <div className="mb-6 flex rounded-card border border-line bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => setMode("all")}
          className={`pressable flex flex-1 items-center justify-center gap-2 rounded-ctl py-2.5 text-body font-semibold transition-all ${
            mode === "all"
              ? "bg-surface text-ink shadow-card"
              : "text-ink-2 hover:text-ink"
          }`}
        >
          <IconGrid size={18} />
          <span>Alle Rezepte</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("fridge")}
          className={`pressable flex flex-1 items-center justify-center gap-2 rounded-ctl py-2.5 text-body font-semibold transition-all ${
            mode === "fridge"
              ? "bg-surface text-accent shadow-card"
              : "text-ink-2 hover:text-ink"
          }`}
        >
          <IconFridge size={18} />
          <span>
            <span className="sm:hidden">Kühlschrank</span>
            <span className="hidden sm:inline">Kühlschrank-Suche</span>
          </span>
          {fridgeIngredients.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
              {fridgeIngredients.length}
            </span>
          )}
        </button>
      </div>

      {mode === "all" ? (
        <div className="mb-5 flex flex-col gap-3">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Titel oder Zutat suchen"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls="recipe-filters"
              className={`pressable inline-flex h-11 items-center gap-2 rounded-ctl border px-3.5 text-[14px] font-semibold md:hidden ${
                activeFilterCount > 0
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-surface text-ink-2"
              }`}
            >
              <IconFilter size={17} />
              {t("recipes.filters")}
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-ink">
                  {activeFilterCount}
                </span>
              )}
              <IconChevronDown
                size={15}
                className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`}
              />
            </button>

            <label className="ml-auto flex items-center gap-2 text-[14px] font-medium text-ink-2">
              <span className="hidden sm:inline">Sortieren</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                aria-label="Sortieren"
                className="h-11 rounded-ctl border border-line bg-surface px-3 text-body text-ink focus:border-accent focus:outline-none"
              >
                <option value="newest">Neueste</option>
                <option value="oldest">Älteste</option>
                <option value="title">Titel A–Z</option>
                <option value="time">Kürzeste Zeit</option>
              </select>
            </label>
          </div>

          {/* Aktive Filter bleiben sichtbar, auch wenn die Leiste eingeklappt ist. */}
          {activeFilterCount > 0 && !filtersOpen && (
            <ul className="flex flex-wrap items-center gap-1.5 md:hidden" aria-label={t("recipes.filtersActive")}>
              {category && (
                <li>
                  <ActiveFilterChip label={category} onRemove={() => setCategory(undefined)} />
                </li>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => setCategory(undefined)}
                  className="pressable rounded-full px-2.5 py-1 text-meta font-medium text-ink-3 underline underline-offset-2"
                >
                  {t("recipes.filtersClear")}
                </button>
              </li>
            </ul>
          )}

          <div id="recipe-filters" className={`${filtersOpen ? "flex" : "hidden"} flex-col gap-3 md:flex`}>
            <CategoryChips value={category} onChange={setCategory} allowAll />
          </div>
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-4">
          <FridgeSearch
            ingredients={fridgeIngredients}
            onChange={setFridgeIngredients}
          />
          {fridgeIngredients.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[14px] font-bold text-ink-2">
                {processedRecipes.filter((r) => (r.matchPercentage ?? 0) > 0).length} passende Rezepte gefunden
              </span>
              <span className="text-label text-ink-3">
                Sortiert nach bester Übereinstimmung
              </span>
            </div>
          )}
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <RecipeCardSkeleton key={i} />
          ))}
        </div>
      ) : mode === "fridge" && fridgeIngredients.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface/50 p-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-card bg-accent-soft text-accent">
            <IconFridge size={30} />
          </div>
          <h3 className="font-display text-h2 text-ink">Dein Kühlschrank wartet auf Zutaten</h3>
          <p className="mx-auto mt-1 max-w-md text-[14px] text-ink-2">
            Füge oben ein paar Zutaten hinzu oder klicke auf die Vorschläge, um sofort zu sehen, was du kochen kannst!
          </p>
        </div>
      ) : processedRecipes.length === 0 ? (
        <div className="rounded-card bg-surface shadow-card">
          <EmptyState
            title={query || category || mode === "fridge" ? t("recipes.emptyTitle") : t("home.emptyTitle")}
            subtitle={
              mode === "fridge"
                ? "Kein Rezept passt zu deinen eingegebenen Zutaten. Füge weitere Basiszutaten hinzu."
                : query || category
                ? "Versuche einen anderen Suchbegriff oder eine andere Kategorie."
                : t("home.emptySubtitle")
            }
            action={
              !query && !category && mode === "all" ? (
                <Link href="/import">
                  <Button size="lg">{t("import.title")}</Button>
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {processedRecipes.map((r, i) => (
            <Reveal key={r.recipe.id} delay={(i % 4) * 45}>
              <RecipeCard
                recipe={r.recipe}
                matchPercentage={r.matchPercentage}
                missingIngredients={r.missingIngredients}
              />
            </Reveal>
          ))}
        </div>
      )}
    </>
  );
}

/** Zeigt einen gesetzten Filter als entfernbaren Chip (Handy, eingeklappte Leiste). */
function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="pressable inline-flex h-8 items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3 text-meta font-medium text-accent"
    >
      {label}
      <IconX size={13} />
      <span className="sr-only">Filter entfernen</span>
    </button>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<div className="skeleton-shimmer h-32 rounded-card" />}>
      <RecipesContent />
    </Suspense>
  );
}

