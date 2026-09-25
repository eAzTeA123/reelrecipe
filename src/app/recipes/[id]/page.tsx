"use client";
import { useI18n } from "@/lib/i18n/context";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecipe } from "@/hooks/useRecipe";
import { getRecipeRepository, getShoppingListRepository } from "@/data";
import { formatAmount, scaleAmount } from "@/lib/scale";
import { RecipeImage } from "@/components/RecipeImage";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Spinner } from "@/components/Spinner";
import { ErrorState } from "@/components/ErrorState";
import { convertRecipeToMetric, convertRecipeToImperial } from "@/lib/unitConverter";
import { UnitToggle } from "@/components/UnitToggle";
import { useToast } from "@/components/Toast";
import {
  IconBack, IconCart, IconClock, IconHeart, IconHeartFill,
  IconCopy, IconLink, IconMinus, IconPencil, IconPlay, IconPlus, IconPrint,
  IconShare, IconTrash, IconUsers,
} from "@/components/Icons";

function formatMinutes(min?: number): string | undefined {
  if (!min) return undefined;
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} Std ${m} Min` : `${h} Std`;
}

export default function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {

  const { t, lang } = useI18n();
  const { id } = use(params);
  const router = useRouter();
  const { recipe: rawRecipe, loading, error, retry } = useRecipe(id);
  const toast = useToast();
  const [servings, setServings] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unitSystem, setUnitSystem] = useState<"eu" | "us">(lang === "de" ? "eu" : "us");
  
  const recipe = useMemo(() => {
    if (!rawRecipe) return rawRecipe;
    return unitSystem === "eu"
      ? convertRecipeToMetric(rawRecipe)
      : convertRecipeToImperial(rawRecipe);
  }, [rawRecipe, unitSystem]);

  if (error) {
    return <ErrorState message={error} onRetry={retry} />;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24" aria-live="polite">
        <Spinner size={30} className="text-accent" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-[19px] font-bold">{t("recipe.notFound")}</p>
        <p className="text-[15px] text-ink-2">{t("recipe.notFoundSub")}</p>
        <Link href="/recipes">
          <Button variant="secondary">{t("recipe.toOverview")}</Button>
        </Link>
      </div>
    );
  }

  const targetServings = servings ?? recipe.servings ?? 1;
  const time = formatMinutes((recipe.prepTime ?? 0) + (recipe.cookTime ?? 0) || undefined);

  async function addToShopping() {
    if (!recipe) return;
    const scaled = recipe.ingredients.map((i) => ({
      name: i.name,
      amount: scaleAmount(i.amount, recipe.servings, targetServings),
      unit: i.unit,
    }));
    await getShoppingListRepository().addIngredients(scaled, recipe.id);
    toast(t("toast.shoppingAdded"));
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await getRecipeRepository().delete(id);
      setConfirmDelete(false);
      router.push("/recipes");
    } catch (e) {
      console.error("delete failed", e);
      setDeleting(false);
      setConfirmDelete(false);
      toast("Das Rezept konnte nicht gelöscht werden.");
    }
  }

  async function duplicateRecipe() {
    try {
      const copy = await getRecipeRepository().duplicate(id);
      toast(t("toast.recipeDuplicated"));
      router.push(`/recipes/${copy.id}`);
    } catch (e) {
      console.error("duplicate failed", e);
      toast("Das Rezept konnte nicht dupliziert werden.");
    }
  }

  function recipeText() {
    if (!recipe) return "";
    const ingredients = recipe.ingredients
      .map((i) => {
        const scaled = scaleAmount(i.amount, recipe.servings, targetServings);
        const qty = formatAmount(scaled ?? i.amount, i.unit);
        return `- ${qty} ${i.name}${i.notes ? ` (${i.notes})` : ""}`.trim();
      })
      .join("\n");
    const steps = recipe.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s, i) => `${i + 1}. ${s.instruction}`)
      .join("\n");
    const header = [
      recipe.title,
      recipe.description,
      targetServings ? `Portionen: ${targetServings}` : undefined,
      time ? `Dauer: ${time}` : undefined,
      recipe.sourceUrl ? `Quelle: ${recipe.sourceUrl}` : undefined,
    ]
      .filter(Boolean)
      .join("\n");

    return [
      header,
      ingredients && `Zutaten:\n${ingredients}`,
      steps && `Zubereitung:\n${steps}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  async function shareRecipe() {
    if (!recipe) return;
    const text = recipeText();
    try {
      if (navigator.share) {
        await navigator.share({ title: recipe.title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast(t("toast.recipeCopied"));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error("share failed", e);
      try {
        await navigator.clipboard.writeText(text);
        toast(t("toast.recipeCopied"));
      } catch {
        toast("Teilen wird auf diesem Gerät nicht unterstützt.");
      }
    }
  }

  return (
    <article className="mx-auto max-w-5xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push("/recipes");
            }
          }}
          aria-label={t("general.back")}
          className="pressable inline-flex items-center gap-1 rounded-full py-2 pl-1 pr-3 text-[15px] font-medium text-ink-2"
        >
          <IconBack size={20} /> {t("general.back")}
        </button>
        <div className="flex gap-1">
          <button
            onClick={() => void shareRecipe()}
            aria-label={t("recipe.share")}
            className="pressable rounded-full p-2.5 text-ink-2"
          >
            <IconShare size={21} />
          </button>
          <button
            onClick={() => window.print()}
            aria-label={t("recipe.print")}
            className="pressable rounded-full p-2.5 text-ink-2"
          >
            <IconPrint size={21} />
          </button>
          <button
            onClick={() => void getRecipeRepository().toggleFavorite(id)}
            aria-label={recipe.favorite ? t("recipe.favoriteRemove") : t("recipe.favoriteAdd")}
            aria-pressed={recipe.favorite}
            className={`pressable rounded-full p-2.5 ${recipe.favorite ? "text-accent" : "text-ink-2"}`}
          >
            {recipe.favorite ? <IconHeartFill size={22} /> : <IconHeart size={22} />}
          </button>
          <button
            onClick={() => void duplicateRecipe()}
            aria-label={t("recipe.duplicate")}
            className="pressable rounded-full p-2.5 text-ink-2"
          >
            <IconCopy size={20} />
          </button>
          <Link
            href={`/recipes/${id}/edit`}
            aria-label="Rezept bearbeiten"
            className="pressable rounded-full p-2.5 text-ink-2"
          >
            <IconPencil size={21} />
          </Link>
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="Rezept löschen"
            className="pressable rounded-full p-2.5 text-ink-2 hover:text-danger"
          >
            <IconTrash size={21} />
          </button>
        </div>
      </div>

      {recipe.image && (
        <div className="mb-6 aspect-[4/3] w-full overflow-hidden rounded-card border border-line/60 shadow-card md:aspect-[21/9]">
          <RecipeImage imageRef={recipe.image} alt={recipe.title} className="h-full w-full" />
        </div>
      )}

      <div className="max-w-3xl">
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] md:text-[40px]">{recipe.title}</h1>
      {recipe.description && (
        <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{recipe.description}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-ink-2">
        {time && (
          <span className="inline-flex items-center gap-1.5">
            <IconClock size={17} /> {time}
          </span>
        )}
        {recipe.category && (
          <span className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-medium text-accent">
            {recipe.category}
          </span>
        )}
        {recipe.sourceUrl && (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-accent underline-offset-2 hover:underline"
          >
            <IconLink size={15} />{" "}
            {recipe.sourceUrl.includes("tiktok.com") ? t("recipe.originalTiktok") : t("recipe.originalSource")}
          </a>
        )}
      </div>
      </div>

      {/* Portionen */}
      <div className="mt-6 flex max-w-2xl items-center justify-between rounded-card border border-line/70 bg-surface px-4 py-3 shadow-card">
        <span className="inline-flex items-center gap-2 text-[15px] font-medium">
          <IconUsers size={18} className="text-ink-2" /> Portionen
        </span>
        <div className="flex items-center gap-3">
          <button
            aria-label="Portionen verringern"
            disabled={targetServings <= 1}
            onClick={() => setServings(Math.max(1, targetServings - 1))}
            className="pressable flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink disabled:opacity-30"
          >
            <IconMinus size={16} />
          </button>
          <span className="w-6 text-center text-[17px] font-bold" aria-live="polite">
            {targetServings}
          </span>
          <button
            aria-label="Portionen erhöhen"
            disabled={targetServings >= 50}
            onClick={() => setServings(targetServings + 1)}
            className="pressable flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink disabled:opacity-30"
          >
            <IconPlus size={16} />
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.18fr)] lg:items-start">
      {/* Zutaten */}
      <section aria-labelledby="ing-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="ing-heading" className="text-[19px] font-bold">{t("shopping.ingredientPlural")}</h2>
          <UnitToggle value={unitSystem} onChange={setUnitSystem} />
        </div>
        {recipe.ingredients.length === 0 ? (
          <p className="text-[15px] text-ink-3">{t("recipe.ingredientsEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
            {recipe.ingredients.map((ing) => {
              const scaled = scaleAmount(ing.amount, recipe.servings, targetServings);
              const qty = formatAmount(scaled, ing.unit);
              return (
                <li key={ing.id} className="flex items-baseline gap-4 px-4 py-3">
                  <span className="w-20 shrink-0 text-right text-[15px] font-semibold tabular-nums text-accent">
                    {qty || "–"}
                  </span>
                  <span className="text-[15px]">
                    {ing.name}
                    {ing.notes && <span className="text-ink-2">, {ing.notes}</span>}
                    {ing.uncertain && (
                      <span className="ml-2 rounded-full bg-[#fdf6ef] px-2 py-0.5 text-[11px] font-medium text-[#9a5b23]">
                        nicht eindeutig
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Zubereitung */}
      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="mb-3 text-[19px] font-bold">{t("recipe.steps")}</h2>
        {recipe.steps.length === 0 ? (
          <p className="text-[15px] text-ink-3">{t("recipe.stepsEmpty")}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {recipe.steps
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((s, i) => (
                <li key={s.id} className="flex gap-3.5 rounded-card bg-surface p-4 shadow-card">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <p className="text-[15px] leading-relaxed">{s.instruction}</p>
                </li>
              ))}
          </ol>
        )}
      </section>
      </div>

      <div className="no-print mt-8 grid max-w-2xl gap-2.5 sm:grid-cols-3">
        <Link href={`/recipes/${id}/cook?servings=${targetServings}`} className="w-full">
          <Button size="lg" fullWidth>
            <IconPlay size={18} /> Kochmodus
          </Button>
        </Link>
        <Button variant="secondary" size="lg" fullWidth onClick={() => void addToShopping()}>
          <IconCart size={19} /> Zur Einkaufsliste
        </Button>
        <Link href={`/recipes/${id}/edit`} className="w-full">
          <Button variant="secondary" size="lg" fullWidth>
            <IconPencil size={18} /> Bearbeiten
          </Button>
        </Link>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t("recipe.deleteConfirmTitle")}
        message={`„${recipe.title}" wird dauerhaft von diesem Gerät entfernt.`}
        confirmLabel={deleting ? "Löschen…" : t("general.delete")}
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </article>
  );
}
