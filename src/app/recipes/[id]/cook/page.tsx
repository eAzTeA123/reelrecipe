"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRecipe } from "@/hooks/useRecipe";
import { formatAmount, scaleAmount } from "@/lib/scale";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { Spinner } from "@/components/Spinner";
import { IconBack, IconCheck, IconClock, IconX } from "@/components/Icons";
import { useI18n } from "@/lib/i18n/context";
import { StepTextWithTimers } from "./StepTextWithTimers";
import { convertRecipeToMetric, convertRecipeToImperial } from "@/lib/unitConverter";
import { UnitToggle } from "@/components/UnitToggle";
import confetti from "canvas-confetti";
import { useHaptic } from "@/hooks/useHaptic";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

export default function CookModePage({ params }: { params: Promise<{ id: string }> }) {
  const { lang, t } = useI18n();
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { recipe: rawRecipe, loading, error, retry } = useRecipe(id);
  const [unitSystem, setUnitSystem] = useState<"eu" | "us">(lang === "de" ? "eu" : "us");
  const recipe = useMemo(() => {
    if (!rawRecipe) return rawRecipe;
    return unitSystem === "eu"
      ? convertRecipeToMetric(rawRecipe)
      : convertRecipeToImperial(rawRecipe);
  }, [rawRecipe, unitSystem]);
  const servingsParam = searchParams.get("servings");
  const targetServings = servingsParam ? parseInt(servingsParam, 10) : undefined;
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(new Set());
  const haptic = useHaptic();
  const [wakeLockOn, setWakeLockOn] = useState(false);
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);
  
  // Local state for index, checked, checkedSteps

  const steps = useMemo(
    () => recipe?.steps.slice().sort((a, b) => a.order - b.order) ?? [],
    [recipe],
  );
  const currentIndex = Math.min(index, Math.max(0, steps.length - 1));
  const step = steps[currentIndex];
  const wakeLockSupported =
    typeof navigator !== "undefined" &&
    !!(navigator as unknown as WakeLockNavigator).wakeLock?.request;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.key === "ArrowRight") setIndex((i) => Math.min(steps.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  useEffect(() => {
    const nav = navigator as unknown as WakeLockNavigator;
    const requestWakeLock = async () => {
      if (!nav.wakeLock) return;
      try {
        if (!wakeLock.current) {
          wakeLock.current = await nav.wakeLock.request("screen");
          setWakeLockOn(true);
        }
      } catch (e) {
        console.error("wake lock failed", e);
      }
    };
    const releaseWakeLock = () => {
      if (wakeLock.current) {
        wakeLock.current.release().catch(() => {});
        wakeLock.current = null;
        setWakeLockOn(false);
      }
    };

    requestWakeLock();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      } else {
        releaseWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock();
    };
  }, []);

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (loading) {
    return <div className="flex justify-center py-24"><Spinner size={30} className="text-accent" /></div>;
  }
  if (!recipe) return <ErrorState title={t("recipe.notFound")} message={t("recipe.notFoundSub")} />;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-11rem)] max-w-3xl flex-col">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          href={`/recipes/${id}`}
          className="pressable inline-flex min-h-11 items-center gap-1 rounded-full pr-3 text-[15px] font-medium text-ink-2"
        >
          <IconBack size={20} /> {t("general.back")}
        </Link>
        {wakeLockSupported && wakeLockOn && (
          <span className="text-xs text-ink-3">{t("cook.wakeLock")}</span>
        )}
      </div>

      <p className="mb-2 text-[14px] font-semibold uppercase tracking-[0.08em] text-accent">{t("cook.title")}</p>
      <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em]">{recipe.title}</h1>

      <section className="mt-6 rounded-2xl border border-line/70 bg-surface p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[17px] font-bold">{t("cook.ingredients")}</h2>
            <UnitToggle value={unitSystem} onChange={setUnitSystem} />
          </div>
          <span className="text-[13px] font-medium text-ink-3">
            {checked.size}/{recipe.ingredients.length} bereit
          </span>
        </div>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {recipe.ingredients.map((ing) => {
            const scaled = targetServings
              ? scaleAmount(ing.amount, recipe.servings, targetServings)
              : ing.amount;
            return (
              <li key={ing.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-2 text-[15px] hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={checked.has(ing.id)}
                    onChange={() =>
                      setChecked((old) => {
                        const next = new Set(old);
                        if (next.has(ing.id)) next.delete(ing.id);
                        else next.add(ing.id);
                        return next;
                      })
                    }
                    className="h-5 w-5 accent-accent"
                  />
                  <span>
                    <strong className="tabular-nums">
                      {formatAmount(scaled ?? ing.amount, ing.unit)}
                    </strong>{" "}
                    {ing.name}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-5 flex flex-1 flex-col rounded-2xl border border-line/70 bg-surface p-6 shadow-card">
        <div className="mb-5 flex items-center justify-between gap-4">
          <span className="text-[14px] font-semibold text-ink-2">
            {t("cook.step")} {Math.min(currentIndex + 1, steps.length)} {t("cook.of")} {steps.length}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${steps.length ? ((currentIndex + 1) / steps.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        {step ? (
          <div 
            onClick={() => {
              setCheckedSteps(prev => {
                const next = new Set(prev);
                if (next.has(step.id)) {
                  next.delete(step.id);
                } else {
                  next.add(step.id);
                  if (currentIndex === steps.length - 1) {
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                    haptic('success');
                  }
                }
                return next;
              });
            }}
            className={`flex-1 flex items-start gap-4 text-[24px] font-semibold leading-snug tracking-[-0.01em] md:text-[32px] cursor-pointer transition-opacity ${checkedSteps.has(step.id) ? 'line-through opacity-50' : ''}`}
          >
            <div className={`mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${checkedSteps.has(step.id) ? 'border-accent bg-accent text-accent-ink' : 'border-ink-3'}`}>
              {checkedSteps.has(step.id) && <IconCheck size={18} />}
            </div>
            <div className="flex-1">
              <StepTextWithTimers 
                text={step.instruction} 
                recipeId={recipe.id}
              />
            </div>
          </div>
        ) : (
          <p className="flex-1 text-[20px] text-ink-2">{t("cook.noSteps")}</p>
        )}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >{t("cook.back")}</Button>
          {currentIndex >= steps.length - 1 ? (
            <Button
              size="lg"
              onClick={() => router.push(`/recipes/${recipe?.id ?? id}`)}
            >
              <IconCheck size={20} />{t("cook.finish")}</Button>
          ) : (
            <Button
              size="lg"
              onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
            >{t("cook.next")}</Button>
          )}
        </div>
      </section>
    </div>
  );
}
