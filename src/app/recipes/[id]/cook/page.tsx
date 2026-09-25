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
import { StepTextWithTimers } from "./StepTextWithTimers";
import { convertRecipeToMetric } from "@/lib/unitConverter";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

export default function CookModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { recipe: rawRecipe, loading, error, retry } = useRecipe(id);
  const [isEu, setIsEu] = useState(false);
  const recipe = isEu && rawRecipe ? convertRecipeToMetric(rawRecipe) : rawRecipe;
  const servingsParam = searchParams.get("servings");
  const targetServings = servingsParam ? parseInt(servingsParam, 10) : undefined;
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [wakeLockOn, setWakeLockOn] = useState(false);
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);
  
  // Timer state
  const [timers, setTimers] = useState<{ id: string; label: string; endTime: number }[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (timers.length === 0) return;
    const interval = setInterval(() => {
      setNow(Date.now());
      setTimers(prev => {
        let changed = false;
        const next = prev.filter(t => {
          if (Date.now() >= t.endTime) {
            alert(`Timer abgelaufen: ${t.label}`);
            changed = true;
            return false;
          }
          return true;
        });
        return changed ? next : prev;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [timers.length]);

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
  if (!recipe) return <ErrorState title="Rezept nicht gefunden" message="Es wurde möglicherweise gelöscht." />;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-11rem)] max-w-3xl flex-col">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          href={`/recipes/${id}`}
          className="pressable inline-flex min-h-11 items-center gap-1 rounded-full pr-3 text-[15px] font-medium text-ink-2"
        >
          <IconBack size={20} /> Beenden
        </Link>
        {wakeLockSupported && wakeLockOn && (
          <span className="text-xs text-ink-3">Bildschirm aktiv</span>
        )}
      </div>

      <p className="mb-2 text-[14px] font-semibold uppercase tracking-[0.08em] text-accent">
        Kochmodus
      </p>
      <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em]">{recipe.title}</h1>

      <section className="mt-6 rounded-card border border-line/70 bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[17px] font-bold">Zutaten</h2>
            <button
              onClick={() => setIsEu(!isEu)}
              className="pressable rounded-full border border-line bg-surface px-2 py-0.5 text-[12px] font-medium text-ink-2 shadow-sm"
            >
              {isEu ? "🇪🇺 EU" : "🇺🇸 US"}
            </button>
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
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[15px] hover:bg-surface-2">
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

      <section className="mt-5 flex flex-1 flex-col rounded-card border border-line/70 bg-surface p-6 shadow-card">
        <div className="mb-5 flex items-center justify-between gap-4">
          <span className="text-[14px] font-semibold text-ink-2">
            Schritt {Math.min(currentIndex + 1, steps.length)} von {steps.length}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${steps.length ? ((currentIndex + 1) / steps.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        {step ? (
          <div className="flex-1 text-[24px] font-semibold leading-snug tracking-[-0.01em] md:text-[32px]">
            <StepTextWithTimers 
              text={step.instruction} 
              onStartTimer={(sec, lbl) => setTimers(t => [...t, { id: Math.random().toString(), label: lbl, endTime: Date.now() + sec * 1000 }])} 
            />
          </div>
        ) : (
          <p className="flex-1 text-[20px] text-ink-2">Keine Zubereitungsschritte vorhanden.</p>
        )}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            Zurück
          </Button>
          {currentIndex >= steps.length - 1 ? (
            <Button
              size="lg"
              onClick={() => router.push(`/recipes/${recipe?.id ?? id}`)}
            >
              <IconCheck size={20} />
              Fertig
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
            >
              Weiter
            </Button>
          )}
        </div>
      </section>
      {timers.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {timers.map((t) => {
            const remaining = Math.max(0, Math.ceil((t.endTime - now) / 1000));
            const m = Math.floor(remaining / 60);
            const s = remaining % 60;
            return (
              <div
                key={t.id}
                className="bg-surface border border-line shadow-lg rounded-xl p-3 flex items-center justify-between pointer-events-auto"
              >
                <div className="flex items-center gap-3">
                  <IconClock size={22} className="text-accent animate-pulse" />
                  <span className="text-[17px] font-semibold tabular-nums">
                    {m}:{s.toString().padStart(2, "0")}
                  </span>
                  <span className="text-[14px] text-ink-2 truncate max-w-[150px]">
                    {t.label}
                  </span>
                </div>
                <button
                  onClick={() => setTimers((prev) => prev.filter((x) => x.id !== t.id))}
                  className="text-ink-3 hover:text-ink-1 p-2"
                >
                  <IconX size={20} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
