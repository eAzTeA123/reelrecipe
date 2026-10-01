"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecipes } from "@/hooks/useRecipes";
import { RecipeCard, RecipeCover } from "@/components/RecipeCard";
import { Reveal } from "@/components/Reveal";
import { RecipeCardSkeleton } from "@/components/RecipeCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/Button";
import { ExtractionLoader } from "@/components/ExtractionLoader";
import { IconClipboard, IconFridge, IconLink, IconSettings, IconX, IconDice } from "@/components/Icons";
import { extractRecipeLinkFromText, parseRecipeLink } from "@/lib/socialSource";
import { looksLikeShareCode } from "@/lib/shareCode";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n/context";
import dynamic from "next/dynamic";
import { getRecipeRepository } from "@/data";
import type { Recipe, RecipeInput } from "@/domain/types";

const OnboardingModal = dynamic(
  () => import("@/components/OnboardingModal").then((m) => m.OnboardingModal),
  { ssr: false },
);

export default function HomePage() {
  const router = useRouter();
  const toast = useToast();
  const { recipes, loading, error, retry } = useRecipes();
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [showBingoBanner, setShowBingoBanner] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem("bingoBannerDismissed") === "true";
      if (!dismissed) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowBingoBanner(true);
      }
    }
  }, []);

  function dismissBingoBanner() {
    setShowBingoBanner(false);
    localStorage.setItem("bingoBannerDismissed", "true");
  }

  async function saveImported(recipeInput: RecipeInput, pendingImage?: Blob) {
    const existing = recipeInput.sourceUrl ? await getRecipeRepository().findBySourceUrl(recipeInput.sourceUrl) : undefined;
    if (existing) {
      toast(t("toast.recipeExists"));
      router.push(`/recipes/${existing.id}`);
      return;
    }
    const saved = await getRecipeRepository().saveWithImage(undefined, recipeInput, pendingImage);
    const allRecipes = await getRecipeRepository().list();
    if (allRecipes.length <= 1) {
      try { sessionStorage.setItem("scroll2cook-first-recipe", "1"); } catch {}
    }
    toast(t("toast.recipeSaved"));
    router.push(`/recipes/${saved.id}`);
  }

  /** Rezeptseiten: universeller Parser; nur sichere Ergebnisse direkt speichern, sonst prüfen lassen */
  async function importWeb(link: string) {
    // Parser und Webimport erst hier laden – sie gehören nicht ins Startbundle.
    const { fetchWebRecipe, fetchRecipeImage } = await import("@/lib/webImport");
    const res = await fetchWebRecipe(link);
    const r = res.recipe;
    if (res.status === "success" && r && r.highConfidence) {
      const pendingImage = r.image ? await fetchRecipeImage(r.image, "web") : undefined;
      await saveImported(
        {
          title: r.title || "Neues Rezept",
          description: r.description,
          ingredients: r.ingredients,
          steps: r.steps,
          servings: r.servings,
          prepTime: r.prepTime,
          cookTime: r.cookTime,
          sourceUrl: r.sourceUrl,
          favorite: false,
        },
        pendingImage,
      );
      return;
    }
    router.push(`/import?url=${encodeURIComponent(link)}`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Weitergabe-Code? Dann in den Import geben – dort wird er eingelesen.
    if (looksLikeShareCode(url)) {
      setUrlError(undefined);
      setImporting(true);
      router.push(`/import?code=${encodeURIComponent(url.trim())}`);
      return;
    }
    const link = parseRecipeLink(url);
    if (!link) {
      setUrlError(t("import.linkError"));
      return;
    }
    setUrlError(undefined);
    setImporting(true);

    if (link.kind === "web") {
      try {
        await importWeb(link.normalized);
      } catch (err) {
        console.error("web import error", err);
        router.push(`/import?url=${encodeURIComponent(link.normalized)}`);
      } finally {
        setImporting(false);
      }
      return;
    }

    const parsed = link.social;
    try {
      const endpoint = parsed.platform === "tiktok" ? "/api/tiktok" : "/api/instagram";
      const res = await fetch(`${endpoint}?url=${encodeURIComponent(parsed.normalized)}`);
      const data = (await res.json()) as {
        ok?: boolean;
        caption?: string;
        image?: string;
        resolvedUrl?: string;
      };

      if (data.ok && data.caption && data.caption.trim().length >= 15) {
        // Beide Pakete erst beim echten Bedarf laden (Bundle-Größe der Startseite).
        const [{ parseRecipe }, { fetchRecipeImage }] = await Promise.all([
          import("@/parser"),
          import("@/lib/webImport"),
        ]);
        const recipeData = parseRecipe(data.caption.trim());
        if (recipeData && (recipeData.ingredients.length > 0 || recipeData.steps.length > 0)) {
          const pendingImage = data.image ? await fetchRecipeImage(data.image, "social") : undefined;
          await saveImported(
            {
              title: recipeData.title || "Neues Rezept",
              ingredients: recipeData.ingredients,
              steps: recipeData.steps,
              servings: recipeData.servings,
              prepTime: recipeData.prepTime,
              cookTime: recipeData.cookTime,
              sourceUrl: data.resolvedUrl || parsed.normalized,
              sourceCaption: data.caption.trim(),
              favorite: false,
            },
            pendingImage,
          );
          return;
        }
      }

      // Falls die automatische Erkennung nicht alle Felder gefunden hat:
      router.push(`/import?url=${encodeURIComponent(parsed.normalized)}`);
    } catch (err) {
      console.error("direct import error", err);
      router.push(`/import?url=${encodeURIComponent(parsed.normalized)}`);
    } finally {
      setImporting(false);
    }
  }

  async function pasteFromClipboard() {
    setUrlError(undefined);
    try {
      if (!navigator.clipboard?.readText) {
        setUrlError(t("import.clipErrorNotSupported"));
        return;
      }
      const text = await navigator.clipboard.readText();
      const extracted = extractRecipeLinkFromText(text) ?? parseRecipeLink(text);
      if (extracted) {
        setUrl(extracted.normalized);
        toast(t("toast.linkCopied"));
      } else if (text.trim().startsWith("http")) {
        setUrl(text.trim());
        setUrlError(t("import.clipErrorInvalid"));
      } else {
        setUrlError(t("import.clipErrorNoLink"));
      }
    } catch (err) {
      console.error("clipboard read failed", err);
      setUrlError(t("import.clipErrorDenied"));
    }
  }

  return (
    <>
      <Suspense fallback={null}>
        <OnboardingModal />
      </Suspense>
      <section
        aria-labelledby="import-heading"
        className="texture-grain relative mb-14 overflow-hidden rounded-frame bg-paper-wash px-5 py-8 shadow-card sm:px-8 sm:py-10 lg:px-12 lg:py-14"
      >
        <Link
          href="/settings"
          aria-label={t("settings.title")}
          className="pressable absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-pill bg-surface/70 text-ink-2 backdrop-blur hover:text-ink"
        >
          <IconSettings size={20} />
        </Link>
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch lg:gap-12">
          <div>
            <p className="text-label font-semibold uppercase text-accent-text">
              {recipes.length > 0
                ? `${recipes.length} ${recipes.length === 1 ? t("recipes.countSingular") : t("recipes.countPlural")}`
                : t("brand.name")}
            </p>
            <h1 id="import-heading" className="mt-3 font-display text-display text-ink">
              Rezept-Link
              <br />
              <span className="text-accent-text">einfügen &amp; kochen.</span>
            </h1>
            <p className="mt-4 max-w-[46ch] text-h3 font-medium text-ink-2">
              {t("home.importSubtitle")}
            </p>

            <form
              id="tour-import"
              onSubmit={submit}
              className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-stretch"
              noValidate
            >
              {/* Eine Glas-Kapsel für Feld und Einfügen-Knopf – wie eine Suchleiste */}
              <div className="glass flex min-h-14 flex-1 items-center gap-2 rounded-ctl border border-line pl-4 pr-2 shadow-card focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/25">
                <span className="pointer-events-none shrink-0 text-ink-3">
                  <IconLink size={20} />
                </span>
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  disabled={importing}
                  aria-label={t("home.importPlaceholder")}
                  aria-invalid={!!urlError}
                  aria-describedby={urlError ? "url-error" : undefined}
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (urlError) setUrlError(undefined);
                  }}
                  placeholder={t("home.importPlaceholder")}
                  className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-ink-3 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => void pasteFromClipboard()}
                  className="pressable inline-flex h-11 shrink-0 items-center gap-1.5 rounded-ctl bg-surface-2 px-3 text-meta font-semibold text-ink-2 transition-colors hover:text-ink disabled:opacity-50"
                  aria-label={t("home.paste")}
                >
                  <IconClipboard size={15} />
                  {t("home.paste")}
                </button>
              </div>
              <Button type="submit" size="lg" disabled={importing} className="sm:w-auto">
                {importing ? t("home.importing") : t("home.importButton")}
              </Button>
            </form>
            {urlError && (
              <p id="url-error" role="alert" className="mt-3 text-body font-medium text-danger">
                {urlError}
              </p>
            )}
            {importing && (
              <div className="mt-5">
                <ExtractionLoader label={t("home.importing")} />
              </div>
            )}
          </div>

          <RecipeMosaic recipes={recipes} />
        </div>
      </section>

      {/* Bingo Update-Banner (einmalig, schließbar) */}
      {showBingoBanner && (
        <section
          id="tour-fridge"
          className="relative mb-12 flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <div className="flex items-start gap-3.5 pr-8 sm:items-center sm:pr-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-ctl bg-accent-soft text-accent-text">
              <IconDice size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-label font-semibold uppercase text-accent-text">Neu</span>
                <h2 className="text-h3 font-bold text-ink">Keine Idee, was du kochen sollst?</h2>
              </div>
              <p className="mt-0.5 text-meta text-ink-2">
                Lass den Zufall entscheiden: Spiel eine Runde Rezept-Bingo.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/bingo" onClick={dismissBingoBanner}>
              <Button variant="secondary">Bingo spielen →</Button>
            </Link>
            <button
              type="button"
              onClick={dismissBingoBanner}
              aria-label="Hinweis schließen"
              className="pressable absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-pill text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink sm:static"
            >
              <IconX size={16} />
            </button>
          </div>
        </section>
      )}

      <section id="tour-recipes" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="mb-5 font-display text-h1 text-ink">
          {t("home.recent")}
        </h2>
        {error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : loading ? (
          <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <RecipeCardSkeleton key={i} />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="rounded-card bg-surface shadow-card">
            <EmptyState
              title={t("home.emptyTitle")}
              subtitle={t("home.emptySubtitle")}
              action={
                <Link href="/import">
                  <Button size="lg">{t("home.emptyAction")}</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recipes.slice(0, 6).map((r, i) => (
              <Reveal key={r.id} delay={(i % 4) * 45}>
                <RecipeCard recipe={r} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/**
 * Cover-Collage aus den neuesten Rezepten. Auf dem Handy bewusst ausgeblendet:
 * dort zählt, dass Eingabe und Button sofort sichtbar sind. Ohne Rezepte
 * bleibt eine ruhige Papier-Komposition statt eines leeren Loches.
 */
function RecipeMosaic({ recipes }: { recipes: Recipe[] }) {
  const recent = recipes.slice(0, 3);

  if (recent.length === 0) {
    return (
      <div className="hidden h-full grid-cols-2 grid-rows-[1.35fr_1fr] gap-4 lg:grid" aria-hidden>
        <div className="texture-grain relative col-span-2 rounded-frame bg-accent-soft/70" />
        <div className="texture-grain relative rounded-frame bg-surface-2" />
        <div className="texture-grain relative rounded-frame bg-accent-soft/40" />
      </div>
    );
  }

  return (
    <div className="hidden h-full grid-cols-2 grid-rows-[1.35fr_1fr] gap-4 lg:grid" aria-hidden>
      <div className="col-span-2 rotate-[-0.5deg]">
        <RecipeCover recipe={recent[0]} className="h-full w-full shadow-card" sizes="45vw" />
      </div>
      {recent[1] && (
        <div className="rotate-[1deg]">
          <RecipeCover recipe={recent[1]} className="h-full w-full shadow-card" sizes="22vw" />
        </div>
      )}
      {recent[2] && (
        <div className="rotate-[-0.8deg]">
          <RecipeCover recipe={recent[2]} className="h-full w-full shadow-card" sizes="22vw" />
        </div>
      )}
    </div>
  );
}

