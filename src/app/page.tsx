"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecipes } from "@/hooks/useRecipes";
import { PageHeader } from "@/components/PageHeader";
import { RecipeCard } from "@/components/RecipeCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { IconClipboard, IconLink, IconSettings, IconSparkle } from "@/components/Icons";
import { extractSocialUrlFromText, parseSocialUrl } from "@/lib/socialSource";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n/context";

export default function HomePage() {
  const router = useRouter();
  const toast = useToast();
  const { recipes, loading, error, retry } = useRecipes();
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string>();
  const { t } = useI18n();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      router.push("/import");
      return;
    }
    const parsed = parseSocialUrl(trimmed);
    if (!parsed) {
      setUrlError(t("import.linkError"));
      return;
    }
    setUrlError(undefined);
    router.push(`/import?url=${encodeURIComponent(parsed.normalized)}`);
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
        className="mb-9 rounded-card bg-surface p-5 shadow-card"
      >
        <h2 id="import-heading" className="mb-1 flex items-center gap-2 text-[19px] font-bold">
          <IconSparkle size={19} className="text-accent" />
          {t("home.importTitle")}
        </h2>
        <p className="mb-4 text-[14px] text-ink-2">
          {t("home.importSubtitle")}
        </p>
        <form onSubmit={submit} className="flex flex-col gap-2.5 sm:flex-row" noValidate>
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
              <IconLink size={17} />
            </span>
            <Input
              type="url"
              inputMode="url"
              autoComplete="url"
              aria-label={t("home.importPlaceholder")}
              aria-invalid={!!urlError}
              aria-describedby={urlError ? "url-error" : undefined}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (urlError) setUrlError(undefined);
              }}
              placeholder={t("home.importPlaceholder")}
              className="pl-10 pr-28"
            />
            <button
              type="button"
              onClick={() => void pasteFromClipboard()}
              className="pressable absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink border border-line"
              aria-label={t("home.paste")}
            >
              <IconClipboard size={14} />
              {t("home.paste")}
            </button>
          </div>
          <Button type="submit" size="lg" className="sm:w-auto">
            {t("home.importButton")}
          </Button>
        </form>
        {urlError && (
          <p id="url-error" role="alert" className="mt-2 text-[14px] text-danger">
            {urlError}
          </p>
        )}
      </section>

      <section aria-labelledby="recent-heading">
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
