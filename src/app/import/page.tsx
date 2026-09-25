"use client";
import { useI18n } from "@/lib/i18n/context";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { extractSocialUrlFromText, parseSocialUrl } from "@/lib/socialSource";
import { parseRecipe } from "@/parser";
import { getRecipeRepository } from "@/data";
import { compressImage } from "@/lib/image";
import type { RecipeInput } from "@/domain/types";
import {
  emptyDraft,
  draftFromIngredients,
  RecipeForm,
  type RecipeDraft,
} from "@/components/RecipeForm";
import { Button } from "@/components/Button";
import { Field, Input, Textarea } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { Spinner } from "@/components/Spinner";
import { IconBack, IconClipboard, IconLink } from "@/components/Icons";
import { useToast } from "@/components/Toast";

type Step = "link" | "loading" | "caption" | "review";

interface DraftState {
  url: string;
  caption: string;
  ogImage?: string;
  autoFailed?: boolean;
}

const STORAGE_KEY = "rezept-import-draft";

function loadDraft(): DraftState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DraftState) : null;
  } catch {
    return null;
  }
}

function saveDraft(d: DraftState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

function ImportFlow() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("link");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [ogImage, setOgImage] = useState<string | undefined>();
  const [useOgImage, setUseOgImage] = useState(true);
  const [autoFailed, setAutoFailed] = useState(false);
  const [urlError, setUrlError] = useState<string>();
  const [parseError, setParseError] = useState<string>();
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const started = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCaption = useCallback(async (socialUrl: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStep("loading");

    const parsed = parseSocialUrl(socialUrl);
    const endpoint = parsed?.platform === "tiktok" ? "/api/tiktok" : "/api/instagram";

    try {
      const res = await fetch(`${endpoint}?url=${encodeURIComponent(socialUrl)}`, {
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        caption?: string;
        image?: string;
        resolvedUrl?: string;
      };
      if (controller.signal.aborted) return;
      if (data.ok && data.caption) {
        setCaption(data.caption);
        setOgImage(data.image);
        const resolved = data.resolvedUrl || socialUrl;
        if (data.resolvedUrl) setUrl(data.resolvedUrl);
        setAutoFailed(false);
        void analyze(data.caption, data.image, resolved);
      } else {
        setAutoFailed(true);
        setStep("caption");
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      console.error("fetch failed", e);
      setAutoFailed(true);
      setStep("caption");
    }
  }, [analyze]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Entwurf aus sessionStorage wiederherstellen
  useEffect(() => {
    const saved = loadDraft();
    if (!saved) return;
    const t = setTimeout(() => {
      setUrl(saved.url);
      setCaption(saved.caption);
      setOgImage(saved.ogImage);
      setAutoFailed(!!saved.autoFailed);
      if (saved.caption) setStep("caption");
    }, 0);
    return () => clearTimeout(t);
  }, [analyze]);

  useEffect(() => {
    if (step === "caption" || step === "loading") {
      saveDraft({ url, caption, ogImage, autoFailed });
    }
  }, [url, caption, ogImage, autoFailed, step]);

  // ?url= Parameter → direkt starten
  useEffect(() => {
    const q = params.get("url");
    if (!q || started.current) return;
    started.current = true;
    const t = setTimeout(() => {
      const parsed = parseSocialUrl(q);
      if (parsed) {
        setUrl(parsed.normalized);
        void fetchCaption(parsed.normalized);
      } else {
        setStep("caption");
        setAutoFailed(true);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [params, fetchCaption]);

  function submitUrl(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseSocialUrl(url);
    if (!parsed) {
      setUrlError(t("import.linkError"));
      return;
    }
    setUrlError(undefined);
    setUrl(parsed.normalized);
    void fetchCaption(parsed.normalized);
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
        toast("Link eingefügt");
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

  async function analyze(
    overrideCaption?: string,
    overrideImage?: string,
    overrideUrl?: string
  ) {
    const textToParse = overrideCaption ?? caption;
    const imgToUse = overrideImage !== undefined ? overrideImage : ogImage;
    const urlToUse = overrideUrl ?? url;

    const trimmed = textToParse.trim();
    if (trimmed.length < 20) {
      setParseError(t("import.parseErrorLength"));
      setStep("caption");
      return;
    }
    setParseError(undefined);
    setAnalyzing(true);
    try {
      const parsed = parseRecipe(trimmed);
      if (!parsed || (parsed.ingredients.length === 0 && parsed.steps.length === 0)) {
        setParseError(t("import.parseErrorFailed"),
        );
        setStep("caption");
        return;
      }
      let pendingImage: Blob | undefined;
      if (useOgImage && imgToUse) {
        try {
          const res = await fetch(`/api/instagram/image?url=${encodeURIComponent(imgToUse)}`);
          if (res.ok) pendingImage = await compressImage(await res.blob());
        } catch (e) {
          console.error("og image fetch failed", e);
        }
      }
      setDraft({
        ...emptyDraft(),
        title: parsed.title,
        servingsText: parsed.servings?.toString() ?? "",
        prepTimeText: parsed.prepTime?.toString() ?? "",
        cookTimeText: parsed.cookTime?.toString() ?? "",
        sourceUrl: parseSocialUrl(urlToUse)?.normalized ?? urlToUse.trim(),
        sourceCaption: trimmed,
        pendingImage,
        ...draftFromIngredients(parsed.ingredients, parsed.steps),
      });
      setStep("review");
    } finally {
      setAnalyzing(false);
    }
  }

  function startManual() {
    setParseError(undefined);
    setDraft({
      ...emptyDraft(),
      sourceUrl: parseSocialUrl(url)?.normalized ?? (url.trim() || undefined),
      sourceCaption: caption.trim() || undefined,
    });
    setStep("review");
  }

  async function save(input: RecipeInput, pendingImage?: Blob, previousImageRef?: string) {
    const recipe = await getRecipeRepository().saveWithImage(
      undefined,
      input,
      pendingImage,
      previousImageRef,
    );
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setTimeout(() => router.push(`/recipes/${recipe.id}`), 950);
  }

  if (step === "review" && draft) {
    return (
      <>
        <PageHeader
          title={t("import.reviewTitle")}
          subtitle={t("import.reviewSubtitle")}
          action={
            <button
              onClick={() => setStep("caption")}
              aria-label={t("general.back")}
              className="pressable rounded-full p-2 text-ink-2 hover:bg-surface"
            >
              <IconBack size={22} />
            </button>
          }
        />
        <RecipeForm initial={draft} onSubmit={save} submitLabel={t("import.save")} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("import.title")} />

      {step === "link" && (
        <section className="rounded-card bg-surface p-5 shadow-card">
          <form onSubmit={submitUrl} className="flex flex-col gap-3" noValidate>
            <Field label="Instagram- oder TikTok-Link" htmlFor="social-url">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
                  <IconLink size={17} />
                </span>
                <Input
                  id="social-url"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  aria-invalid={!!urlError}
                  aria-describedby={urlError ? "social-url-error" : undefined}
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (urlError) setUrlError(undefined);
                  }}
                  placeholder="https://www.instagram.com/reel/… oder TikTok-Link"
                  className="pl-10 pr-28"
                />
                <button
                  type="button"
                  onClick={() => void pasteFromClipboard()}
                  className="pressable absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink border border-line"
                  aria-label="Link aus Zwischenablage einfügen"
                >
                  <IconClipboard size={14} />
                  Einfügen
                </button>
              </div>
            </Field>
            {urlError && (
              <p id="social-url-error" role="alert" className="text-[14px] text-danger">
                {urlError}
              </p>
            )}
            <Button type="submit" size="lg" fullWidth>
              Importieren
            </Button>
            <button
              type="button"
              onClick={() => setStep("caption")}
              className="pressable mx-auto py-2 text-[15px] font-medium text-ink-2 underline-offset-2 hover:underline"
            >
              Ohne Link fortfahren
            </button>
          </form>
        </section>
      )}

      {step === "loading" && (
        <section
          className="flex flex-col items-center gap-4 rounded-card bg-surface py-16 shadow-card"
          aria-live="polite"
        >
          <Spinner size={30} className="text-accent" />
          <p className="text-[15px] text-ink-2">{t("import.loading")}</p>
          <Button
            variant="secondary"
            onClick={() => {
              abortRef.current?.abort();
              setAutoFailed(true);
              setStep("caption");
            }}
          >
            Abbrechen
          </Button>
        </section>
      )}

      {step === "caption" && (
        <section className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card">
          {autoFailed && (
            <p className="rounded-ctl bg-accent-soft px-4 py-3 text-[15px] text-ink" role="status">
              Die Beschreibung konnte nicht automatisch abgerufen werden.
              Füge sie bitte manuell ein.
            </p>
          )}
          <Field label={t("import.captionLabel")} htmlFor="caption">
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("import.captionPlaceholder")}
              className="min-h-56 font-mono text-[14px] leading-relaxed"
              autoFocus
            />
          </Field>
          {ogImage && (
            <label className="flex cursor-pointer items-center gap-2.5 text-[15px] text-ink-2">
              <input
                type="checkbox"
                checked={useOgImage}
                onChange={(e) => setUseOgImage(e.target.checked)}
                className="h-5 w-5 accent-accent"
              />
              Vorschaubild übernehmen
            </label>
          )}
          {parseError && (
            <p role="alert" className="rounded-ctl bg-[#fdf6ef] px-4 py-3 text-[15px] text-[#9a5b23]">
              {parseError}
            </p>
          )}
          <Button
            size="lg"
            fullWidth
            onClick={() => void analyze()}
            disabled={!caption.trim() || analyzing}
          >
            {analyzing ? <Spinner size={18} /> : null}
            {analyzing ? t("import.analyzing") : t("import.analyze")}
          </Button>
          {parseError && (
            <Button variant="secondary" fullWidth onClick={startManual}>
              Manuell ausfüllen
            </Button>
          )}
          {url && (
            <button
              type="button"
              onClick={() => {
                setStep("link");
                setAutoFailed(false);
              }}
              className="pressable mx-auto py-1 text-[14px] font-medium text-ink-2 hover:underline"
            >
              Anderen Link verwenden
            </button>
          )}
        </section>
      )}
    </>
  );
}

export default function ImportPage() {

  const { t, lang, setLang } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Spinner size={28} className="text-accent" />
        </div>
      }
    >
      <ImportFlow />
    </Suspense>
  );
}
