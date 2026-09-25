"use client";

import { useI18n } from "@/lib/i18n/context";
import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRecipes } from "@/hooks/useRecipes";
import { PageHeader } from "@/components/PageHeader";
import { RecipeCard } from "@/components/RecipeCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SearchField } from "@/components/SearchField";
import { CategoryChips } from "@/components/CategoryPicker";
import { Button } from "@/components/Button";
import { IconPlus, IconFridge, IconGrid } from "@/components/Icons";
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

  const { recipes, loading, error, retry } = useRecipes({
    query: mode === "fridge" ? "" : query,
    category: mode === "fridge" ? undefined : category,
  });

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
        subtitle={`${recipes.length} ${
          recipes.length === 1 ? t("recipes.countSingular") : t("recipes.countPlural")
        }`}
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

      {/* Neuer moderner Modus-Umschalter (Segmented Bar) */}
      <div className="mb-6 flex rounded-2xl bg-surface-2 p-1.5 border border-line">
        <button
          type="button"
          onClick={() => setMode("all")}
          className={`pressable flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[15px] font-bold transition-all ${
            mode === "all"
              ? "bg-white text-ink shadow-sm"
              : "text-ink-2 hover:text-ink"
          }`}
        >
          <IconGrid size={18} />
          <span>Alle Rezepte</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("fridge")}
          className={`pressable flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[15px] font-bold transition-all ${
            mode === "fridge"
              ? "bg-white text-accent shadow-sm"
              : "text-ink-2 hover:text-ink"
          }`}
        >
          <IconFridge size={18} />
          <span>Kühlschrank-Suche</span>
          {fridgeIngredients.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
              {fridgeIngredients.length}
            </span>
          )}
        </button>
      </div>

      {mode === "all" ? (
        <div className="mb-6 flex flex-col gap-3">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Titel oder Zutat suchen"
          />
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
              <span className="text-[12px] text-ink-3">
                Sortiert nach bester Übereinstimmung
              </span>
            </div>
          )}
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="pulse-soft aspect-[4/3] rounded-card bg-black/[0.04]" />
          ))}
        </div>
      ) : mode === "fridge" && fridgeIngredients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <IconFridge size={30} />
          </div>
          <h3 className="text-[18px] font-bold text-ink">Dein Kühlschrank wartet auf Zutaten</h3>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {processedRecipes.map((r) => (
            <RecipeCard
              key={r.recipe.id}
              recipe={r.recipe}
              matchPercentage={r.matchPercentage}
              missingIngredients={r.missingIngredients}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<div className="pulse-soft h-32 rounded-card bg-black/[0.04]" />}>
      <RecipesContent />
    </Suspense>
  );
}
