"use client";
import { useI18n } from "@/lib/i18n/context";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { extractRecipeLinkFromText, parseRecipeLink, parseSocialUrl, type RecipeLink } from "@/lib/socialSource";
import { WEB_STATUS_MESSAGE, fetchRecipeImage, fetchWebRecipe } from "@/lib/webImport";
import { parseRecipe, PARSER_VERSION } from "@/parser";
import { translateParsedRecipe } from "@/lib/i18n/recipeTranslation";
import { getRecipeRepository } from "@/data";
import type { Recipe, RecipeInput } from "@/domain/types";
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

import { extractDominantColor } from "@/lib/color";

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
  const [failReason, setFailReason] = useState<string>();
  const [loadingHost, setLoadingHost] = useState<string>();
  const [parseError, setParseError] = useState<string>();
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [existingRecipe, setExistingRecipe] = useState<Recipe | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingSaveArgs, setPendingSaveArgs] = useState<{
    input: RecipeInput;
    pendingImage?: Blob;
    previousImageRef?: string;
  } | null>(null);
  const started = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCaption = useCallback(async (socialUrl: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFailReason(undefined);
    setLoadingHost(undefined);
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

  /** Rezeptseiten (Chefkoch, Blogs …) über den universellen Parser importieren */
  const fetchWeb = useCallback(
    async (link: string, host: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setFailReason(undefined);
      setLoadingHost(host);
      setStep("loading");

      let res;
      try {
        res = await fetchWebRecipe(link, controller.signal);
      } catch {
        return;
      }
      if (controller.signal.aborted) return;

      const r = res.recipe;
      if (res.status === "success" && r) {
        const translated = translateParsedRecipe(
          { title: r.title, servings: r.servings, prepTime: r.prepTime, cookTime: r.cookTime, ingredients: r.ingredients, steps: r.steps },
          lang,
        );
        let pendingImage: Blob | undefined;
        let color: string | undefined;
        if (r.image) {
          pendingImage = await fetchRecipeImage(r.image, "web");
          if (pendingImage) {
            try {
              color = await extractDominantColor(pendingImage);
            } catch {
              color = undefined;
            }
          }
        }
        if (controller.signal.aborted) return;
        setDraft({
          ...emptyDraft(),
          title: translated.title,
          description: r.description ?? "",
          servingsText: translated.servings?.toString() ?? "",
          prepTimeText: translated.prepTime?.toString() ?? "",
          cookTimeText: translated.cookTime?.toString() ?? "",
          sourceUrl: r.sourceUrl,
          pendingImage,
          color,
          ...draftFromIngredients(translated.ingredients, translated.steps),
        });
        setStep("review");
        return;
      }
      setFailReason(t(WEB_STATUS_MESSAGE[res.status === "success" ? "not_a_recipe" : res.status]));
      setAutoFailed(true);
      setStep("caption");
    },
    [lang, t],
  );

  const startLink = useCallback(
    (link: RecipeLink) => {
      setUrl(link.normalized);
      if (link.kind === "social") void fetchCaption(link.normalized);
      else void fetchWeb(link.normalized, link.host);
    },
    [fetchCaption, fetchWeb],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  // Entwurf aus sessionStorage wiederherstellen
  useEffect(() => {
    if (params.get("url")) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
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
  }, [params]);

  useEffect(() => {
    if (step === "caption" || step === "loading") {
      saveDraft({ url, caption, ogImage, autoFailed });
    }
  }, [url, caption, ogImage, autoFailed, step]);

  // ?url= oder share= Parameter → direkt starten
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Handle share parameter or hash
    let shareParam = params.get("share");
    if (!shareParam && typeof window !== "undefined" && window.location.hash.startsWith("#share=")) {
      shareParam = window.location.hash.slice(7);
      // Remove hash from URL to keep it clean
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else if (!shareParam && typeof window !== "undefined" && window.location.hash.length > 1) {
      // pcmb.fyi might redirect to /import#<json> if we compress the URL with the payload directly in the hash.
      // Or if the compressed url expands to /import#share=...
      // Wait, if pcmb unpacks it, it does location.replace with the unpacked URL.
      // So if the original URL was /import?share=..., it will be /import?share=...
    }

    if (shareParam) {
      try {
        const payload = JSON.parse(decodeURIComponent(shareParam));
        setDraft({
          ...emptyDraft(),
          title: payload.title || "",
          description: payload.description || "",
          servingsText: payload.servings ? String(payload.servings) : "",
          prepTimeText: payload.prepTime ? String(payload.prepTime) : "",
          cookTimeText: payload.cookTime ? String(payload.cookTime) : "",
          color: payload.color,
          sourceUrl: payload.sourceUrl || "",
          ingredients: (payload.ingredients || []).map((i: any) => ({
            id: crypto.randomUUID(),
            name: i.name || "",
            amountText: i.amount ? String(i.amount) : "",
            unit: i.unit || "",
            notes: i.notes || "",
            uncertain: false,
          })),
          steps: (payload.steps || []).map((s: string) => ({
            id: crypto.randomUUID(),
            instruction: s,
          })),
        });
        setStep("review");
        return;
      } catch (e) {
        console.error("Failed to parse share payload", e);
        toast("Fehler beim Laden des geteilten Rezepts");
      }
    }

    // Share-Target / Startseite: ?url= und/oder ?text= (geteilter Text enthält oft den Link)
    const qUrl = params.get("url");
    const qText = params.get("text");
    const combined = [qUrl, qText].filter(Boolean).join(" ");
    if (!combined) {
      started.current = false;
      return;
    }
    const link = extractRecipeLinkFromText(combined) ?? (qUrl ? parseRecipeLink(qUrl) : null);
    // Defer to avoid synchronous setState during effect
    queueMicrotask(() => {
      if (link) {
        startLink(link);
      } else {
        if (qText) setCaption(qText);
        setStep("caption");
        setAutoFailed(!qText);
      }
    });
  }, [params, startLink, toast]);

  function submitUrl(e: React.FormEvent) {
    e.preventDefault();
    const link = parseRecipeLink(url);
    if (!link) {
      setUrlError(t("import.linkError"));
      return;
    }
    setUrlError(undefined);
    startLink(link);
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
        toast(t("import.linkPasted"));
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
      const rawParsed = parseRecipe(trimmed);
      if (!rawParsed || (rawParsed.ingredients.length === 0 && rawParsed.steps.length === 0)) {
        setParseError(t("import.parseErrorFailed"));
        setStep("caption");
        return;
      }
      const parsed = translateParsedRecipe(rawParsed, lang);
      let pendingImage: Blob | undefined;
      let color: string | undefined;
      if (imgToUse && useOgImage) {
        try {
          pendingImage = await fetchRecipeImage(imgToUse, "social");
          if (pendingImage) color = await extractDominantColor(pendingImage);
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
        color,
        ...draftFromIngredients(parsed.ingredients, parsed.steps),
      });
      setStep("review");
    } catch (err) {
      console.error("analyze crashed:", err);
      setParseError("Ein Fehler ist beim Analysieren aufgetreten. Bitte manuell eingeben.");
      setStep("caption");
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

  async function save(input: RecipeInput, pendingImage?: Blob, previousImageRef?: string, forceOverwrite = false) {
    if (input.sourceUrl && !forceOverwrite) {
      const existing = await getRecipeRepository().findBySourceUrl(input.sourceUrl);
      if (existing) {
        setExistingRecipe(existing);
        setPendingSaveArgs({ input, pendingImage, previousImageRef });
        setShowDuplicateDialog(true);
        return false;
      }
    }

    input.parserVersion = PARSER_VERSION;

    const targetId = existingRecipe?.id ?? undefined;
    const recipe = await getRecipeRepository().saveWithImage(
      targetId,
      input,
      pendingImage,
      previousImageRef,
    );
    
    setExistingRecipe(null);
    setShowDuplicateDialog(false);
    setPendingSaveArgs(null);

    try {
      const allRecipes = await getRecipeRepository().list();
      if (allRecipes.length <= 1) {
        sessionStorage.setItem("scroll2cook-first-recipe", "1");
      }
    } catch {}
    
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
        
        {showDuplicateDialog && existingRecipe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
              <h3 className="text-[18px] font-bold text-ink">
                {t("import.duplicateTitle")}
              </h3>
              <p className="text-sm text-ink/70">
                {t("import.duplicateDesc").replace("{title}", existingRecipe.title)}
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowDuplicateDialog(false);
                    setExistingRecipe(null);
                    setPendingSaveArgs(null);
                  }}
                >
                  {t("import.duplicateCancel")}
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => {
                    if (pendingSaveArgs) {
                      void save(
                        pendingSaveArgs.input,
                        pendingSaveArgs.pendingImage,
                        pendingSaveArgs.previousImageRef,
                        true // forceOverwrite
                      );
                    }
                  }}
                >
                  {t("import.duplicateOverwrite")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("import.title")} />

      {step === "link" && (
        <section className="rounded-2xl bg-surface p-5 shadow-card">
          <form onSubmit={submitUrl} className="flex flex-col gap-3" noValidate>
            <Field label={t("import.linkLabel")} htmlFor="social-url">
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
                  aria-describedby={urlError ? "social-url-error" : "social-url-hint"}
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (urlError) setUrlError(undefined);
                  }}
                  placeholder={t("import.linkPlaceholder")}
                  className="pl-10 pr-28"
                />
                <button
                  type="button"
                  onClick={() => void pasteFromClipboard()}
                  className="pressable absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 py-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink border border-line"
                  aria-label={t("home.paste")}
                >
                  <IconClipboard size={14} />
                  {t("home.paste")}
                </button>
              </div>
            </Field>
            {urlError ? (
              <p id="social-url-error" role="alert" className="text-[14px] text-danger">
                {urlError}
              </p>
            ) : (
              <p id="social-url-hint" className="-mt-1 text-[13px] text-ink-3">
                {t("import.linkHint")}
              </p>
            )}
            <Button type="submit" size="lg" fullWidth>
              {t("import.submit")}
            </Button>
            <button
              type="button"
              onClick={() => {
                setFailReason(undefined);
                setAutoFailed(false);
                setStep("caption");
              }}
              className="pressable mx-auto min-h-11 py-2 text-[15px] font-medium text-ink-2 underline-offset-2 hover:underline"
            >
              {t("import.withoutLink")}
            </button>
          </form>
        </section>
      )}

      {step === "loading" && (
        <section
          className="flex flex-col items-center gap-4 rounded-2xl bg-surface py-16 shadow-card"
          aria-live="polite"
        >
          <Spinner size={30} className="text-accent" />
          <p className="px-6 text-center text-[15px] text-ink-2">
            {loadingHost ? t("import.loadingWeb").replace("{host}", loadingHost) : t("import.loading")}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              abortRef.current?.abort();
              setFailReason(undefined);
              setAutoFailed(false);
              setStep("link");
            }}
          >
            {t("import.cancel")}
          </Button>
        </section>
      )}

      {step === "caption" && (
        <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-card">
          {autoFailed && (
            <p className="rounded-xl bg-accent-soft px-4 py-3 text-[15px] text-ink" role="status">
              {failReason ?? t("import.autoFailed")}
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
              {t("import.useOgImage")}
            </label>
          )}
          {parseError && (
            <p role="alert" className="rounded-xl bg-[#fdf6ef] px-4 py-3 text-[15px] text-[#9a5b23]">
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
              {t("import.manualFill")}
            </Button>
          )}
          {url && (
            <button
              type="button"
              onClick={() => {
                setStep("link");
                setAutoFailed(false);
                setFailReason(undefined);
              }}
              className="pressable mx-auto min-h-11 py-1 text-[14px] font-medium text-ink-2 hover:underline"
            >
              {t("import.otherLink")}
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
