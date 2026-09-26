"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecipes } from "@/hooks/useRecipes";
import { PageHeader } from "@/components/PageHeader";
import { RecipeCard } from "@/components/RecipeCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { IconClipboard, IconFridge, IconLink, IconSettings, IconX } from "@/components/Icons";
import { extractSocialUrlFromText, parseSocialUrl } from "@/lib/socialSource";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n/context";
import { Tour } from "@/components/Tour";
import { parseRecipe } from "@/parser";
import { getRecipeRepository } from "@/data";
import { compressImage } from "@/lib/image";
import { Spinner } from "@/components/Spinner";
import type { RecipeInput } from "@/domain/types";

export default function HomePage() {
  const router = useRouter();
  const toast = useToast();
  const { recipes, loading, error, retry } = useRecipes();
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [showFridgeBanner, setShowFridgeBanner] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem("fridgeBannerDismissed") === "true";
      if (!dismissed) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowFridgeBanner(true);
      }
    }
  }, []);

  function dismissFridgeBanner() {
    setShowFridgeBanner(false);
    localStorage.setItem("fridgeBannerDismissed", "true");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError(t("import.linkError") || "Bitte füge einen TikTok- oder Instagram-Link ein.");
      return;
    }
    const parsed = parseSocialUrl(trimmed);
    if (!parsed) {
      setUrlError(t("import.linkError") || "Ungültiger Social-Media-Link.");
      return;
    }
    setUrlError(undefined);
    setImporting(true);

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
        const recipeData = parseRecipe(data.caption.trim());
        if (recipeData && (recipeData.ingredients.length > 0 || recipeData.steps.length > 0)) {
          let pendingImage: Blob | undefined;
          if (data.image) {
            try {
              const imgRes = await fetch(`/api/instagram/image?url=${encodeURIComponent(data.image)}`);
              if (imgRes.ok) {
                pendingImage = await compressImage(await imgRes.blob());
              }
            } catch (err) {
              console.error("image compress error", err);
            }
          }

          const finalUrl = data.resolvedUrl || parsed.normalized;
          
          // DUPLIKAT-CHECK FÜR DIE HOMEPAGE
          const existing = await getRecipeRepository().findBySourceUrl(finalUrl);
          if (existing) {
            toast(t("toast.recipeExists") || "Rezept existiert bereits in deiner Bibliothek.");
            router.push(`/recipes/${existing.id}`);
            return;
          }

          const recipeInput: RecipeInput = {
            title: recipeData.title || "Neues Rezept",
            ingredients: recipeData.ingredients,
            steps: recipeData.steps,
            servings: recipeData.servings,
            prepTime: recipeData.prepTime,
            cookTime: recipeData.cookTime,
            sourceUrl: finalUrl,
            sourceCaption: data.caption.trim(),
            favorite: false,
          };

          const saved = await getRecipeRepository().saveWithImage(undefined, recipeInput, pendingImage);
          toast(t("toast.recipeSaved") || "Rezept erfolgreich importiert!");
          router.push(`/recipes/${saved.id}`);
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
      const extracted = extractSocialUrlFromText(text) ?? parseSocialUrl(text);
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
        <Tour />
      </Suspense>
      <PageHeader
        title={t("home.title")}
        action={
          <Link
            href="/settings"
            aria-label={t("settings.title")}
            className="pressable inline-flex rounded-full p-2.5 text-ink-2 hover:bg-surface"
          >
            <IconSettings size={22} />
          </Link>
        }
      />

      <section
        aria-labelledby="import-heading"
        className="mb-16 mt-8"
      >
        <h2 id="import-heading" className="mb-2 text-[32px] md:text-[48px] font-extrabold leading-tight tracking-tighter text-ink">
          Rezept-Link <br/><span className="text-brand-gradient">einfügen & kochen.</span>
        </h2>
        <p className="mb-6 text-[16px] text-ink-2 font-medium">
          {t("home.importSubtitle")}
        </p>
        <form id="tour-import" onSubmit={submit} className="flex flex-col gap-3 sm:flex-row" noValidate>
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">
              <IconLink size={20} />
            </span>
            <Input
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
              className="h-14 pl-12 pr-28 text-[17px] bg-surface border border-line rounded-none focus:border-ink transition-colors disabled:opacity-50"
            />
            <button
              type="button"
              disabled={importing}
              onClick={() => void pasteFromClipboard()}
              className="pressable absolute right-2 top-2 bottom-2 flex items-center justify-center gap-1.5 bg-surface-2 px-3 text-[12px] font-bold uppercase tracking-wider text-ink hover:bg-line transition-colors disabled:opacity-50"
              aria-label={t("home.paste")}
            >
              <IconClipboard size={14} />
              {t("home.paste")}
            </button>
          </div>
          <Button
            type="submit"
            disabled={importing}
            className="h-14 sm:w-auto rounded-none bg-brand-gradient text-[16px] font-extrabold uppercase tracking-widest px-8 flex items-center justify-center gap-2.5"
          >
            {importing ? (
              <>
                <Spinner size={18} />
                <span>Importiere...</span>
              </>
            ) : (
              t("home.importButton")
            )}
          </Button>
        </form>
        {urlError && (
          <p id="url-error" role="alert" className="mt-3 text-[15px] font-medium text-danger">
            {urlError}
          </p>
        )}
      </section>

      {/* Kühlschrank Reste-Verwertung Update-Banner (einmalig, schließbar) */}
      {showFridgeBanner && (
        <section
          id="tour-fridge"
          className="relative mb-12 rounded-2xl border border-line bg-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-card"
        >
          <div className="flex items-start sm:items-center gap-3.5 pr-8 sm:pr-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <IconFridge size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-accent">
                  Neu
                </span>
                <h3 className="font-bold text-[17px] text-ink">Was ist im Kühlschrank?</h3>
              </div>
              <p className="mt-0.5 text-[14px] text-ink-2">
                Finde blitzschnell Rezepte für Zutaten, die du noch zu Hause hast.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/recipes?mode=fridge"
              onClick={dismissFridgeBanner}
              className="pressable inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[14px] font-bold text-surface hover:bg-accent hover:text-white transition-colors"
            >
              <span>Reste verwerten</span>
              <span>→</span>
            </Link>
            <button
              type="button"
              onClick={dismissFridgeBanner}
              aria-label="Hinweis schließen"
              className="pressable absolute right-3 top-3 sm:static flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
            >
              <IconX size={16} />
            </button>
          </div>
        </section>
      )}

      <section id="tour-recipes" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="mb-4 text-[21px] font-bold">
          {t("home.recent")}
        </h2>
        {error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="pulse-soft aspect-[4/3] rounded-card bg-black/[0.04]" />
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.slice(0, 6).map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
