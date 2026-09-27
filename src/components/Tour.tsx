"use client";

import { useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useI18n } from "@/lib/i18n/context";

export function Tour() {
  const { t, lang } = useI18n();
  const searchParams = useSearchParams();

  const runTour = useCallback(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const navPrefix = isMobile ? "nav-mobile-" : "nav-desktop-";
    const navSide = isMobile ? "top" as const : "bottom" as const;

    const allCandidateSteps = [
      {
        element: "#tour-import",
        popover: {
          title: t("tour.importTitle"),
          description: t("tour.importDesc"),
          side: "bottom" as const,
        },
      },
      {
        element: "#tour-fridge",
        popover: {
          title: t("tour.fridgeTitle"),
          description: t("tour.fridgeDesc"),
          side: "bottom" as const,
        },
      },
      {
        element: `[data-tour="${navPrefix}planner"]`,
        popover: {
          title: t("tour.plannerTitle"),
          description: t("tour.plannerDesc"),
          side: navSide,
        },
      },
      {
        element: `[data-tour="${navPrefix}shopping"]`,
        popover: {
          title: t("tour.shoppingTitle"),
          description: t("tour.shoppingDesc"),
          side: navSide,
        },
      },
      {
        element: `[data-tour="${navPrefix}recipes"]`,
        popover: {
          title: t("tour.recipesTitle"),
          description: t("tour.recipesDesc"),
          side: navSide,
        },
      },
      {
        element: "#tour-pwa",
        popover: {
          title: t("tour.pwaTitle"),
          description: t("tour.pwaDesc"),
          side: "top" as const,
        },
      },
    ];

    const activeSteps = allCandidateSteps.filter((step) => {
      if (!step.element) return true;
      return !!document.querySelector(step.element);
    });

    if (activeSteps.length === 0) return;

    const tourObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      nextBtnText: lang === "de" ? "Weiter →" : "Next →",
      prevBtnText: lang === "de" ? "← Zurück" : "← Back",
      doneBtnText: lang === "de" ? "Los geht's! 🎉" : "Get Started! 🎉",
      onDestroyed: () => {
        localStorage.setItem("tourSeen", "true");
      },
      steps: activeSteps,
    });

    tourObj.drive();
  }, [t, lang]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const forceTour = searchParams.get("tour") === "1";
    const hasSeenTour = localStorage.getItem("tourSeen") === "true";

    if (!forceTour && hasSeenTour) return;

    const timer = setTimeout(() => {
      runTour();
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchParams, runTour]);

  return null;
}
