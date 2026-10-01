"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/Button";
import { getRecipeRepository } from "@/data";
import { getSampleRecipes } from "@/lib/sampleRecipes";
import { useToast } from "@/components/Toast";
import { useHaptic } from "@/hooks/useHaptic";
import confetti from "canvas-confetti";
import { OnboardingIllustration } from "@/components/OnboardingIllustration";

type StepNo = 1 | 2 | 3 | 4 | 5;

interface SlideData {
  badge: string;
  titleKey: `onboarding.step${StepNo}Title`;
  subtitleKey: `onboarding.step${StepNo}Subtitle`;
  highlightsKey: `onboarding.step${StepNo}Highlights`;
}

const EXIT_MS = 180;

export function OnboardingModal() {
  const { t, lang } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const haptic = useHaptic();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const dialogRef = useRef<HTMLDivElement>(null);

  const slides: SlideData[] = (
    [
      { badge: "Scroll2Cook" },
      { badge: "Import" },
      { badge: lang === "de" ? "Küche" : "Kitchen" },
      { badge: lang === "de" ? "Weitergeben" : "Sharing" },
      { badge: lang === "de" ? "Los geht's" : "Let's go" },
    ] as const
  ).map((s, i) => {
    const n = (i + 1) as StepNo;
    return {
      ...s,
      titleKey: `onboarding.step${n}Title`,
      subtitleKey: `onboarding.step${n}Subtitle`,
      highlightsKey: `onboarding.step${n}Highlights`,
    };
  });

  useEffect(() => {
    setMounted(true);
    const force = searchParams.get("onboarding") === "1" || searchParams.get("tour") === "1";
    // Versionierte Markierung, damit inhaltliche Updates alle Nutzer einmal sehen
    const hasSeenV2 = localStorage.getItem("onboardingSeenV3") === "true";

    if (force || !hasSeenV2) {
      setOpen(true);
      setCurrentSlide(0);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    if (closing) return;
    localStorage.setItem("onboardingSeenV3", "true");
    localStorage.setItem("onboardingSeen", "true");
    setClosing(true);

    closeTimer.current = window.setTimeout(() => {
      setClosing(false);
      setOpen(false);
      if (searchParams.get("onboarding") || searchParams.get("tour")) {
        router.replace("/");
      }
    }, EXIT_MS);
  }, [closing, searchParams, router]);

  /*
   * Fokusfalle: Ein `aria-modal`-Dialog darf den Fokus nicht entlassen – sonst
   * landet der erste Tab auf Elementen hinter dem Overlay. Beim Öffnen wandert
   * der Fokus in den Dialog, Tab bleibt darin, Escape schließt, und beim
   * Schließen kehrt der Fokus zum vorherigen Element zurück.
   */
  useEffect(() => {
    if (!open && !closing) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    node?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [open, closing, handleClose]);

  const handleNext = () => {
    haptic("light");
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    haptic("light");
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleLoadSamples = async () => {
    try {
      setLoadingSamples(true);
      haptic("medium");
      const samples = getSampleRecipes(lang);
      const repo = getRecipeRepository();

      for (const sample of samples) {
        await repo.create(sample);
      }

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
      haptic("success");
      toast(t("onboarding.samplesLoaded"), "success");
      handleClose();
    } catch (err) {
      console.error("Failed to load sample recipes", err);
      handleClose();
    } finally {
      setLoadingSamples(false);
    }
  };

  const handleStartOwn = () => {
    haptic("light");
    handleClose();
    setTimeout(() => {
      const input = document.getElementById("url-input") || document.querySelector("input[type='url']");
      if (input instanceof HTMLElement) {
        input.focus();
      }
    }, 200);
  };

  if (!mounted) return null;
  const isRendered = open || closing;
  if (!isRendered) return null;

  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="presentation"
      style={{ overscrollBehavior: "contain" }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 ${closing ? "overlay-out" : "overlay-in"}`}
        onClick={handleClose}
        aria-hidden
      />

      {/* Sheet Content (Responsive: Bottom Sheet on Mobile, Centered Modal on Desktop) */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t(slide.titleKey)}
        className={`relative w-full max-w-lg rounded-t-sheet bg-surface p-6 shadow-pop md:rounded-sheet md:p-7 border border-line outline-none ${
          closing ? "sheet-down" : "sheet-up"
        } max-h-[90dvh] overflow-y-auto flex flex-col justify-between`}
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        {/* Mobile Pull Indicator */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-3/40 md:hidden" aria-hidden />

        {/* Top Header / Badge & Skip Button */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-label font-semibold uppercase tracking-[0.14em] text-accent-text">
            {slide.badge}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="pressable inline-flex min-h-11 items-center rounded-ctl px-3 text-meta font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {t("onboarding.skip")}
          </button>
        </div>

        {/* Center Content */}
        <div key={currentSlide} className="page-enter my-auto flex flex-col items-center py-3 text-center">
          {/* Die Illustration trägt den Schritt – deshalb bekommt sie Fläche
              und Höhe, nicht nur ein Symbolkästchen. */}
          <div className="mb-5 aspect-[3/2] w-full max-w-[260px] sm:max-w-[288px]">
            <OnboardingIllustration step={(currentSlide + 1) as StepNo} />
          </div>

          <h2 className="mb-2 font-display text-h1 leading-[1.15] text-ink">
            {t(slide.titleKey)}
          </h2>

          <p className="mb-5 max-w-sm text-meta leading-relaxed text-ink-2 sm:text-body">
            {t(slide.subtitleKey)}
          </p>

          {/* Eigenschaften als leise Chips */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {t(slide.highlightsKey).split("|").map((h, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-ctl border border-line bg-surface-2 px-3 py-1.5 text-label font-medium text-ink-2"
              >
                <span className="font-bold text-accent-text">✓</span>
                {h}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Actions & Pagination */}
        <div className="mt-5 border-t border-line pt-4">
          {isLast ? (
            <div className="flex w-full flex-col gap-2.5">
              <Button
                variant="primary"
                size="lg"
                onClick={handleLoadSamples}
                disabled={loadingSamples}
                className="w-full text-body"
              >
                {loadingSamples ? t("onboarding.loadingSamples") : t("onboarding.loadSamples")}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleStartOwn}
                className="w-full text-meta"
              >
                {t("onboarding.startEmpty")}
              </Button>
            </div>
          ) : (
            <>
              {/* Punkte wie in Apples Tab-Bars: der aktive Punkt ist eine Pille.
                  Jeder Punkt hat trotzdem 44 px Trefferfläche. */}
              <div className="mb-1 flex items-center justify-center gap-1">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-current={currentSlide === idx ? "step" : undefined}
                    aria-label={t("onboarding.stepProgress")
                      .replace("{current}", String(idx + 1))
                      .replace("{total}", String(slides.length))}
                    onClick={() => {
                      haptic("light");
                      setCurrentSlide(idx);
                    }}
                    className="pressable flex h-11 w-11 items-center justify-center"
                  >
                    <span
                      className={`block h-2 rounded-pill transition-all duration-200 ${
                        currentSlide === idx ? "w-6 bg-accent" : "w-2 bg-line-2"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div className="flex w-full items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handlePrev}
                  disabled={currentSlide === 0}
                  className="min-w-24 text-meta"
                >
                  ← {t("onboarding.back")}
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  onClick={handleNext}
                  className="min-w-24 text-meta"
                >
                  {t("onboarding.next")} →
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

