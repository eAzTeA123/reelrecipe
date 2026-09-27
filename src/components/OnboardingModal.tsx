"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/Button";
import { getRecipeRepository } from "@/data";
import { getSampleRecipes } from "@/lib/sampleRecipes";
import { useToast } from "@/components/Toast";
import { useHaptic } from "@/hooks/useHaptic";
import confetti from "canvas-confetti";
import { IconCheck } from "@/components/Icons";

interface SlideData {
  emoji: string;
  badge: string;
  titleKey: "onboarding.step1Title" | "onboarding.step2Title" | "onboarding.step3Title" | "onboarding.step4Title";
  subtitleKey: "onboarding.step1Subtitle" | "onboarding.step2Subtitle" | "onboarding.step3Subtitle" | "onboarding.step4Subtitle";
  highlights: string[];
}

export function OnboardingModal() {
  const { t, lang } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const haptic = useHaptic();

  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loadingSamples, setLoadingSamples] = useState(false);

  // Touch tracking for swipe gestures
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const slides: SlideData[] = [
    {
      emoji: "🍳",
      badge: "ReelRecipe",
      titleKey: "onboarding.step1Title",
      subtitleKey: "onboarding.step1Subtitle",
      highlights: lang === "de" 
        ? ["100% Lokal & Privat", "Kein Account nötig", "Völlig werbefrei"]
        : ["100% Local & Private", "No Account Needed", "Zero Ads"],
    },
    {
      emoji: "⚡",
      badge: "Smart Parser",
      titleKey: "onboarding.step2Title",
      subtitleKey: "onboarding.step2Subtitle",
      highlights: lang === "de"
        ? ["Instagram & TikTok", "Automatische Zutaten", "Mengen-Skalierung"]
        : ["Instagram & TikTok", "Auto Ingredient Parsing", "Portion Scaler"],
    },
    {
      emoji: "🛒",
      badge: "Kitchen Power",
      titleKey: "onboarding.step3Title",
      subtitleKey: "onboarding.step3Subtitle",
      highlights: lang === "de"
        ? ["Drag & Drop Planer", "Supermarkt-Gänge", "Kochmodus & Timer"]
        : ["Drag & Drop Planner", "Supermarket Aisles", "Cook Mode & Timers"],
    },
    {
      emoji: "🚀",
      badge: "Ready!",
      titleKey: "onboarding.step4Title",
      subtitleKey: "onboarding.step4Subtitle",
      highlights: lang === "de"
        ? ["3 Vorlagen inklusive", "PWA Homescreen-App", "Haptisches Feedback"]
        : ["3 Templates Included", "Homescreen Web App", "Haptic Interactions"],
    },
  ];

  useEffect(() => {
    const force = searchParams.get("onboarding") === "1" || searchParams.get("tour") === "1";
    const hasSeen = localStorage.getItem("onboardingSeen") === "true" || localStorage.getItem("tourSeen") === "true";

    if (force || !hasSeen) {
      setIsOpen(true);
      setCurrentSlide(0);
    }
  }, [searchParams]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    localStorage.setItem("onboardingSeen", "true");
    localStorage.setItem("tourSeen", "true");
    setIsOpen(false);

    // If query param was present, clean it up without reload
    if (searchParams.get("onboarding") || searchParams.get("tour")) {
      router.replace("/");
    }
  }, [searchParams, router]);

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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance && currentSlide < slides.length - 1) {
      // Swiped left -> next
      handleNext();
    } else if (distance < -minSwipeDistance && currentSlide > 0) {
      // Swiped right -> prev
      handlePrev();
    }

    touchStartX.current = null;
    touchEndX.current = null;
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
    }, 150);
  };

  if (!isOpen) return null;

  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-line/80 bg-surface p-6 sm:p-8 shadow-2xl transition-all duration-300 flex flex-col justify-between min-h-[480px] max-h-[90vh]"
      >
        {/* Top Header / Skip Button */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent tracking-wide uppercase">
            {slide.badge}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="text-xs font-semibold text-ink-3 hover:text-ink px-2 py-1 rounded-lg transition-colors pressable"
          >
            {t("onboarding.skip")}
          </button>
        </div>

        {/* Slide Content */}
        <div className="my-auto py-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-200 key={currentSlide}">
          {/* Animated Emoji Badge */}
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-surface-2 border border-line text-5xl shadow-sm transform transition-transform hover:scale-105">
            {slide.emoji}
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mb-3 leading-snug">
            {t(slide.titleKey)}
          </h2>

          <p className="text-[15px] sm:text-[16px] text-ink-2 leading-relaxed max-w-sm mb-6">
            {t(slide.subtitleKey)}
          </p>

          {/* Highlights Chips */}
          <div className="flex flex-wrap justify-center gap-2">
            {slide.highlights.map((h, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-xl bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-2 border border-line/60"
              >
                <IconCheck size={13} className="text-accent" />
                {h}
              </span>
            ))}
          </div>
        </div>

        {/* Footer Actions / Pagination */}
        <div className="flex flex-col gap-4 pt-4 border-t border-line/50">
          {/* Slide 4 specific action buttons */}
          {isLast ? (
            <div className="flex flex-col gap-2.5 w-full">
              <Button
                variant="primary"
                size="lg"
                onClick={handleLoadSamples}
                disabled={loadingSamples}
                className="w-full text-[16px] h-13 shadow-md"
              >
                {loadingSamples ? t("onboarding.loadingSamples") : t("onboarding.loadSamples")}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleStartOwn}
                className="w-full text-[15px] h-12"
              >
                {t("onboarding.startEmpty")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              {currentSlide > 0 ? (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={handlePrev}
                  className="text-ink-2"
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
                    aria-label={`Go to slide ${idx + 1}`}
                    onClick={() => {
                      haptic("light");
                      setCurrentSlide(idx);
                    }}
                    className={`h-2 transition-all rounded-full ${
                      currentSlide === idx
                        ? "w-6 bg-accent"
                        : "w-2 bg-ink-3/30 hover:bg-ink-3/60"
                    }`}
                  />
                ))}
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleNext}
                className="min-w-20"
              >
                {t("onboarding.next")} →
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
