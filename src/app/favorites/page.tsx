"use client";

import Link from "next/link";
import { useRecipes } from "@/hooks/useRecipes";
import { useI18n } from "@/lib/i18n/context";
import { PageHeader } from "@/components/PageHeader";
import { RecipeCard } from "@/components/RecipeCard";
import { RecipeCardSkeleton } from "@/components/RecipeCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/Button";
import { IconHeart } from "@/components/Icons";

export default function FavoritesPage() {
  const { t } = useI18n();
  const { recipes, loading, error, retry } = useRecipes({ favoritesOnly: true });

  return (
    <>
      <PageHeader title={t("favorites.title")} />
      {error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <RecipeCardSkeleton key={i} />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="rounded-card bg-surface shadow-card">
          <EmptyState
            icon={<IconHeart size={40} />}
            title={t("favorites.emptyTitle")}
            subtitle={t("favorites.emptySubtitle")}
            action={
              <Link href="/recipes">
                <Button variant="secondary" size="lg">{t("favorites.emptyAction")}</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {recipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </>
  );
}
