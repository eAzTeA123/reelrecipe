"use client";

import { useRouter } from "next/navigation";
import { getRecipeRepository } from "@/data";
import type { RecipeInput } from "@/domain/types";
import { emptyDraft, RecipeForm } from "@/components/RecipeForm";
import { PageHeader } from "@/components/PageHeader";

export default function NewRecipePage() {
  const router = useRouter();

  async function save(input: RecipeInput, pendingImage?: Blob, previousImageRef?: string) {
    const recipe = await getRecipeRepository().saveWithImage(
      undefined,
      input,
      pendingImage,
      previousImageRef,
    );
    setTimeout(() => router.push(`/recipes/${recipe.id}`), 950);
  }

  return (
    <>
      <PageHeader title="Neues Rezept" subtitle="Lege ein Rezept manuell an." />
      <RecipeForm initial={emptyDraft()} onSubmit={save} submitLabel="Rezept speichern" />
    </>
  );
}
