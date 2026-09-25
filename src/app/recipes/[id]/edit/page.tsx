"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecipe } from "@/hooks/useRecipe";
import { useI18n } from "@/lib/i18n/context";
import { getRecipeRepository } from "@/data";
import type { RecipeInput } from "@/domain/types";
import {
  draftFromIngredients,
  RecipeForm,
  type RecipeDraft,
} from "@/components/RecipeForm";
import { PageHeader } from "@/components/PageHeader";
import { Spinner } from "@/components/Spinner";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/Button";

export default function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useI18n();
  const { recipe, loading, error, retry } = useRecipe(id);

  if (error) {
    return <ErrorState message={error} onRetry={retry} />;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size={30} className="text-accent" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-[19px] font-bold">{t("recipe.notFound")}</p>
        <Link href="/recipes">
          <Button variant="secondary">{t("recipe.toOverview")}</Button>
        </Link>
      </div>
    );
  }

  const draft: RecipeDraft = {
    title: recipe.title,
    description: recipe.description ?? "",
    servingsText: recipe.servings?.toString() ?? "",
    prepTimeText: recipe.prepTime?.toString() ?? "",
    cookTimeText: recipe.cookTime?.toString() ?? "",
    category: recipe.category,
    imageRef: recipe.image,
    sourceUrl: recipe.sourceUrl,
    sourceCaption: recipe.sourceCaption,
    favorite: recipe.favorite,
    ...draftFromIngredients(recipe.ingredients, recipe.steps),
  };

  async function save(input: RecipeInput, pendingImage?: Blob, previousImageRef?: string) {
    await getRecipeRepository().saveWithImage(id, input, pendingImage, previousImageRef);
    setTimeout(() => router.push(`/recipes/${id}`), 950);
  }

  return (
    <>
      <PageHeader title={t("recipe.editTitle")} />
      <RecipeForm key={recipe.id} initial={draft} onSubmit={save} submitLabel={t("recipe.saveChanges")} />
    </>
  );
}
