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
import { IconCheck, IconLink, IconCalendar, IconSparkle } from "@/components/Icons";

type StepNo = 1 | 2 | 3 | 4 | 5;

interface SlideData {
  icon: "sparkle" | "link" | "calendar" | "check";
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

  const slides: SlideData[] = (
    [
      { icon: "check", badge: "Scroll2Cook" },
      { icon: "link", badge: "Import" },
      { icon: "calendar", badge: lang === "de" ? "Küche" : "Kitchen" },
      { icon: "link", badge: lang === "de" ? "Weitergeben" : "Sharing" },
      { icon: "sparkle", badge: lang === "de" ? "Los geht's" : "Let's go" },
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

  const renderIcon = () => {
    switch (slide.icon) {
      case "link":
        return <IconLink size={30} />;
      case "calendar":
        return <IconCalendar size={30} />;
      case "sparkle":
        return <IconSparkle size={30} />;
      default:
        return <IconCheck size={30} />;
    }
  };

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
        role="dialog"
        aria-modal="true"
        aria-label={t(slide.titleKey)}
        className={`relative w-full max-w-lg rounded-t-3xl bg-surface p-6 shadow-pop md:rounded-card md:p-7 border border-line ${
          closing ? "sheet-down" : "sheet-up"
        } max-h-[90dvh] overflow-y-auto flex flex-col justify-between`}
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        {/* Mobile Pull Indicator */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-3/40 md:hidden" aria-hidden />

        {/* Top Header / Badge & Skip Button */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-label font-semibold text-accent">
            {slide.badge}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="pressable text-meta font-medium text-ink-3 hover:text-ink px-2 py-1 rounded-lg transition-colors"
          >
            {t("onboarding.skip")}
          </button>
        </div>

        {/* Center Content */}
        <div className="my-auto py-3 flex flex-col items-center text-center">
          {/* Theme-aligned Icon Container */}
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-card bg-accent-soft text-accent shadow-card">
            {renderIcon()}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink mb-2 leading-snug">
            {t(slide.titleKey)}
          </h2>

          <p className="text-[14px] sm:text-body text-ink-2 leading-relaxed max-w-sm mb-5">
            {t(slide.subtitleKey)}
          </p>

          {/* Highlights Chips */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {t(slide.highlightsKey).split("|").map((h, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-ctl bg-surface-2 px-3 py-1.5 text-label font-medium text-ink-2 border border-line/60"
              >
                <span className="text-accent font-bold">✓</span>
                {h}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Actions & Pagination */}
        <div className="mt-6 pt-4 border-t border-line/60">
          {isLast ? (
            <div className="flex flex-col gap-2.5 w-full">
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
                className="w-full text-[14px]"
              >
                {t("onboarding.startEmpty")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              {currentSlide > 0 ? (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handlePrev}
                  className="text-ink-2 text-xs"
                >
                  ← {t("onboarding.back")}
                </Button>
              ) : (
                <div className="w-16" />
              )}

              {/* Progress Dots */}
              <div className="flex items-center gap-1.5">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Slide ${idx + 1}`}
                    onClick={() => {
                      haptic("light");
                      setCurrentSlide(idx);
                    }}
                    className={`h-1.5 transition-all rounded-full ${
                      currentSlide === idx
                        ? "w-6 bg-accent"
                        : "w-2 bg-line hover:bg-ink-3/40"
                    }`}
                  />
                ))}
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleNext}
                className="min-w-20 text-xs"
              >
                {t("onboarding.next")} →
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

