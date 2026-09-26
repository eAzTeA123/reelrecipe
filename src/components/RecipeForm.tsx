"use client";
import { useI18n } from "@/lib/i18n/context";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Ingredient, RecipeInput, RecipeStep } from "@/domain/types";
import { newId } from "@/lib/text";
import { createPortal } from "react-dom";
import { compressImage } from "@/lib/image";
import { parseAmountString } from "@/parser";
import { normalizeCaption } from "@/parser/normalize";
import { UNIT_LABELS } from "@/parser/units";

import { Button } from "./Button";
import { Field, Input, Textarea } from "./Input";
import { CategoryChips } from "./CategoryPicker";
import { IconArrowDown, IconArrowUp, IconCamera, IconCheck, IconPlus, IconTrash, IconX } from "./Icons";
import { Spinner } from "./Spinner";
import { useImageUrl } from "@/hooks/useImageUrl";
import { useHaptic } from "@/hooks/useHaptic";

export interface IngredientDraft {
  id: string;
  amountText: string;
  unit: string;
  name: string;
  notes?: string;
  uncertain?: boolean;
}

export interface StepDraft {
  id: string;
  instruction: string;
}

export interface RecipeDraft {
  title: string;
  description: string;
  color?: string;
  servingsText: string;
  prepTimeText: string;
  cookTimeText: string;
  category?: string;
  imageRef?: string;
  pendingImage?: Blob;
  sourceUrl?: string;
  sourceCaption?: string;
  favorite: boolean;
  ingredients: IngredientDraft[];
  steps: StepDraft[];
}

export function draftFromIngredients(
  ingredients: Ingredient[],
  steps: RecipeStep[],
): Pick<RecipeDraft, "ingredients" | "steps"> {
  return {
    ingredients: ingredients.map((i) => ({
      id: i.id,
      amountText: i.amount !== undefined ? String(i.amount).replace(".", ",") : "",
      unit: i.unit ?? "",
      name: i.name,
      notes: i.notes,
      uncertain: i.uncertain,
    })),
    steps: steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ id: s.id, instruction: s.instruction })),
  };
}

export function emptyDraft(): RecipeDraft {
  return {
    title: "",
    description: "",
    servingsText: "",
    prepTimeText: "",
    cookTimeText: "",
    favorite: false,
    ingredients: [{ id: newId(), amountText: "", unit: "", name: "" }],
    steps: [{ id: newId(), instruction: "" }],
  };
}

function toInput(draft: RecipeDraft): RecipeInput {
  const num = (s: string) => {
    const v = parseAmountString(normalizeCaption(s));
    return v !== undefined && v > 0 ? v : undefined;
  };
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || undefined,
    color: draft.color,
    servings: num(draft.servingsText),
    prepTime: num(draft.prepTimeText),
    cookTime: num(draft.cookTimeText),
    category: draft.category,
    image: draft.imageRef,
    sourceUrl: draft.sourceUrl,
    sourceCaption: draft.sourceCaption,
    favorite: draft.favorite,
    ingredients: draft.ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({
        id: i.id,
        amount: parseAmountString(normalizeCaption(i.amountText)),
        unit: i.unit.trim() || undefined,
        name: i.name.trim(),
        notes: i.notes,
        uncertain: i.uncertain || undefined,
      })),
    steps: draft.steps
      .filter((s) => s.instruction.trim())
      .map((s, idx) => ({ id: s.id, order: idx + 1, instruction: s.instruction.trim() })),
  };
}

import { extractDominantColor } from "@/lib/color";

export function RecipeForm({
  initial,
  onSubmit,
  submitLabel,
  onImagePicked,
}: {
  initial: RecipeDraft;
  onSubmit: (
    input: RecipeInput,
    pendingImage?: Blob,
    previousImageRef?: string,
  ) => Promise<boolean | void>;
  submitLabel?: string;
  onImagePicked?: (blob: Blob) => void;
}) {
  const { t } = useI18n();
  const haptic = useHaptic();
  const [draft, setDraft] = useState<RecipeDraft>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string>();
  const [hasDraft, setHasDraft] = useState<RecipeDraft | null>(null);
  const isFirstRender = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingUrl, setPendingUrl] = useState<string>();

  useEffect(() => {
    if (draft.pendingImage) {
      const url = URL.createObjectURL(draft.pendingImage);
      setPendingUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPendingUrl(undefined);
    }
  }, [draft.pendingImage]);

  const existingUrl = useImageUrl(draft.pendingImage ? undefined : draft.imageRef);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("reelrecipe_draft");
      if (stored) {
        const parsed = JSON.parse(stored) as RecipeDraft;
        setHasDraft(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      localStorage.setItem("reelrecipe_draft", JSON.stringify({ ...draft, pendingImage: undefined }));
    } catch {}
  }, [draft]);

  const set = <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const setIng = (id: string, patch: Partial<IngredientDraft>) =>
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));

  const moveStep = (id: string, dir: -1 | 1) =>
    setDraft((d) => {
      const idx = d.steps.findIndex((s) => s.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= d.steps.length) return d;
      const steps = [...d.steps];
      [steps[idx], steps[target]] = [steps[target], steps[idx]];
      return { ...d, steps };
    });

  async function pickImage(file: File | undefined) {
    if (!file) return;
    try {
      const blob = await compressImage(file);
      const color = await extractDominantColor(blob);
      setDraft((d) => ({ ...d, pendingImage: blob, color }));
      onImagePicked?.(blob);
    } catch (e) {
      console.error("image compress failed", e);
      setError("Das Bild konnte nicht verarbeitet werden.");
    }
  }

  async function submit() {
    if (!draft.title.trim()) {
      setError("Bitte gib dem Rezept einen Titel.");
      return;
    }
    setError(undefined);
    setStatus("saving");
    try {
      const result = await onSubmit(toInput(draft), draft.pendingImage, initial.imageRef);
      if (result === false) {
        setStatus("idle");
      } else {
        haptic('success');
        setStatus("saved");
        try {
          localStorage.removeItem("reelrecipe_draft");
        } catch {}
      }
    } catch (e) {
      console.error("save failed", e);
      setStatus("error");
      setError("Das Rezept konnte nicht gespeichert werden. Bitte versuche es erneut.");
    }
  }

  const imageUrl = pendingUrl ?? existingUrl;

  return (
    <div className="flex flex-col gap-7">
      {hasDraft && (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-100 dark:border-blue-900/50">
          <p className="font-semibold text-blue-900 dark:text-blue-100 mb-3 text-[15px]">
            Du hast einen ungespeicherten Rezept-Entwurf.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setDraft(hasDraft);
                setHasDraft(null);
              }}
            >
              Wiederherstellen
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setHasDraft(null);
                try {
                  localStorage.removeItem("reelrecipe_draft");
                } catch {}
              }}
            >
              Verwerfen
            </Button>
          </div>
        </div>
      )}

      {initial.sourceCaption && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold">📋 Vorschau – Bitte prüfen</p>
            <p className="mt-1 text-blue-700/80 dark:text-blue-300/80">
              Der Parser hat dieses Rezept aus dem Social-Media-Text erkannt.
              Zutaten mit <span className="inline-flex items-center bg-amber-400 text-white rounded-full w-4 h-4 text-[10px] justify-center font-bold mx-0.5">?</span> waren unklar – bitte prüfen und ggf. korrigieren.
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 font-medium"
              onClick={() => {
                setDraft(prev => ({ ...prev, ingredients: prev.ingredients.filter(i => !i.uncertain) }));
              }}
            >
              ⚠️ Unsichere entfernen
            </button>
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400 font-medium"
              onClick={() => {
                setDraft(prev => ({ ...prev, ingredients: prev.ingredients.map(i => ({ ...i, uncertain: false })) }));
              }}
            >
              ✓ Alle bestätigen
            </button>
          </div>

          <details className="rounded-xl bg-gray-50 dark:bg-gray-900/30 p-3">
            <summary className="cursor-pointer text-sm font-medium text-ink/60">
              Original-Text anzeigen
            </summary>
            <pre className="mt-2 text-xs text-ink/50 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
              {initial.sourceCaption}
            </pre>
          </details>
        </div>
      )}

      {status === "saved" && typeof document !== "undefined" && createPortal(
        <div className="overlay-in fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="check-pop flex flex-col items-center gap-3">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white">
              <IconCheck size={30} />
            </span>
            <p className="text-[19px] font-bold">{t("toast.recipeSaved")}</p>
          </div>
        </div>,
        document.body,
      )}

      {/* Bild */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Rezeptbild auswählen"
          onChange={(e) => {
            void pickImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {imageUrl ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-card border border-line/70 shadow-card md:aspect-[16/9]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Rezeptbild" className="h-full w-full object-cover" />
            <div className="absolute bottom-3 right-3 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="bg-white/90 backdrop-blur"
              >
                <IconCamera size={16} />
                Bild ändern
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Bild entfernen"
                onClick={() =>
                  setDraft((d) => ({ ...d, imageRef: undefined, pendingImage: undefined }))
                }
                className="bg-white/90 backdrop-blur"
              >
                <IconX size={16} />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="pressable flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-surface-2 text-ink-2"
          >
            <IconCamera size={22} />
            <span className="text-[15px] font-medium">Bild hinzufügen (optional)</span>
          </button>
        )}
      </div>

      <Field label="Titel" htmlFor="recipe-title">
        <Input
          id="recipe-title"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="z. B. Creamy Garlic Chicken"
          required
        />
      </Field>

      <Field label="Beschreibung" htmlFor="recipe-desc">
        <Textarea
          id="recipe-desc"
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Kurze Beschreibung (optional)"
          className="min-h-20"
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label={t("recipe.servings")} htmlFor="recipe-servings">
          <Input
            id="recipe-servings"
            inputMode="decimal"
            value={draft.servingsText}
            onChange={(e) => set("servingsText", e.target.value)}
            placeholder="2"
          />
        </Field>
        <Field label="Vorbereitung" htmlFor="recipe-prep" hint="in Minuten">
          <Input
            id="recipe-prep"
            inputMode="numeric"
            value={draft.prepTimeText}
            onChange={(e) => set("prepTimeText", e.target.value)}
            placeholder="15"
          />
        </Field>
        <Field label="Kochzeit" htmlFor="recipe-cook" hint="in Minuten">
          <Input
            id="recipe-cook"
            inputMode="numeric"
            value={draft.cookTimeText}
            onChange={(e) => set("cookTimeText", e.target.value)}
            placeholder="25"
          />
        </Field>
      </div>

      <Field label="Kategorie">
        <CategoryChips value={draft.category} onChange={(v) => set("category", v)} />
      </Field>

      {/* Zutaten */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[15px] font-semibold text-ink">{t("shopping.ingredientPlural")}</legend>
        <datalist id="unit-list">
          {UNIT_LABELS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        {draft.ingredients.map((ing, i) => (
          <div
            key={ing.id}
            className={`relative rounded-ctl border p-2.5 ${
              ing.uncertain ? "border-[#e8b48a] bg-[#fdf6ef]" : "border-line bg-surface"
            }`}
          >
            {ing.uncertain && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-[10px] text-white font-bold"
                title="Parser war sich unsicher – bitte prüfen"
              >
                ?
              </span>
            )}
            <div className="grid grid-cols-[minmax(4.5rem,0.8fr)_minmax(5rem,0.9fr)_2.75rem] gap-2 sm:grid-cols-[5.5rem_7rem_minmax(0,1fr)_2.75rem]">
              <label className="sr-only" htmlFor={`ing-amount-${ing.id}`}>Menge {i + 1}</label>
              <input
                id={`ing-amount-${ing.id}`}
                inputMode="decimal"
                value={ing.amountText}
                onChange={(e) => setIng(ing.id, { amountText: e.target.value })}
                placeholder={t("shopping.editAmount")}
                className="col-start-1 row-start-1 h-11 min-w-0 rounded-lg border border-line bg-white px-2 text-center text-[15px] focus:border-accent focus:outline-none"
              />
              <label className="sr-only" htmlFor={`ing-unit-${ing.id}`}>Einheit {i + 1}</label>
              <input
                id={`ing-unit-${ing.id}`}
                list="unit-list"
                value={ing.unit}
                onChange={(e) => setIng(ing.id, { unit: e.target.value })}
                placeholder={t("shopping.editUnit")}
                className="col-start-2 row-start-1 h-11 min-w-0 rounded-lg border border-line bg-white px-2 text-[15px] focus:border-accent focus:outline-none"
              />
              <label className="sr-only" htmlFor={`ing-name-${ing.id}`}>Zutat {i + 1}</label>
              <input
                id={`ing-name-${ing.id}`}
                value={ing.name}
                onChange={(e) => setIng(ing.id, { name: e.target.value })}
                placeholder={t("shopping.ingredientSingular")}
                className="col-span-3 col-start-1 row-start-2 h-11 min-w-0 rounded-lg border border-line bg-white px-3 text-[15px] focus:border-accent focus:outline-none sm:col-span-1 sm:col-start-3 sm:row-start-1"
              />
              <button
                type="button"
                aria-label={`Zutat ${i + 1} löschen`}
                onClick={() =>
                  setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((x) => x.id !== ing.id) }))
                }
                className="pressable col-start-3 row-start-1 flex h-11 w-11 items-center justify-center rounded-lg text-ink-3 hover:text-danger sm:col-start-4 sm:row-start-1"
              >
                <IconTrash size={18} />
              </button>
            </div>
          </div>
        ))}
        <Button
          variant="secondary"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              ingredients: [...d.ingredients, { id: newId(), amountText: "", unit: "", name: "" }],
            }))
          }
        >
          <IconPlus size={17} /> Zutat hinzufügen
        </Button>
      </fieldset>

      {/* Schritte */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[15px] font-semibold text-ink">{t("recipe.steps")}</legend>
        {draft.steps.map((step, i) => (
          <div key={step.id} className="flex items-start gap-2">
            <span className="mt-2.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent">
              {i + 1}
            </span>
            <label className="sr-only" htmlFor={`step-${step.id}`}>Schritt {i + 1}</label>
            <textarea
              id={`step-${step.id}`}
              value={step.instruction}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  steps: d.steps.map((s) =>
                    s.id === step.id ? { ...s, instruction: e.target.value } : s,
                  ),
                }))
              }
              placeholder="Schritt beschreiben"
              rows={Math.min(4, Math.max(2, Math.ceil(step.instruction.length / 45)))}
              className="min-w-0 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-[15px] focus:border-accent focus:outline-none"
            />
            <div className="flex shrink-0 flex-col gap-0.5">
              <button
                type="button"
                aria-label={`Schritt ${i + 1} nach oben`}
                disabled={i === 0}
                onClick={() => moveStep(step.id, -1)}
                className="pressable flex h-11 w-11 items-center justify-center rounded-lg text-ink-3 hover:text-ink disabled:opacity-30"
              >
                <IconArrowUp size={15} />
              </button>
              <button
                type="button"
                aria-label={`Schritt ${i + 1} nach unten`}
                disabled={i === draft.steps.length - 1}
                onClick={() => moveStep(step.id, 1)}
                className="pressable flex h-11 w-11 items-center justify-center rounded-lg text-ink-3 hover:text-ink disabled:opacity-30"
              >
                <IconArrowDown size={15} />
              </button>
              <button
                type="button"
                aria-label={`Schritt ${i + 1} löschen`}
                onClick={() =>
                  setDraft((d) => ({ ...d, steps: d.steps.filter((x) => x.id !== step.id) }))
                }
                className="pressable flex h-11 w-11 items-center justify-center rounded-lg text-ink-3 hover:text-danger"
              >
                <IconTrash size={15} />
              </button>
            </div>
          </div>
        ))}
        <Button
          variant="secondary"
          onClick={() =>
            setDraft((d) => ({ ...d, steps: [...d.steps, { id: newId(), instruction: "" }] }))
          }
        >
          <IconPlus size={17} /> Schritt hinzufügen
        </Button>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-ctl bg-[#fdeeec] px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      )}

      <div className="sticky bottom-[76px] pb-2 md:bottom-6">
        <Button
          size="lg"
          fullWidth
          onClick={() => void submit()}
          disabled={status === "saving"}
          className="shadow-pop"
        >
          {status === "saving" ? <Spinner size={18} /> : <IconCheck size={19} />}
          {status === "saving" ? t("general.save") : (submitLabel || t("general.save"))}
        </Button>
      </div>
    </div>
  );
}
