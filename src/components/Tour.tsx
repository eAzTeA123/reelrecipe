"use client";

import { useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useI18n } from "@/lib/i18n/context";

export function Tour() {
  const { t, lang } = useI18n();

  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined") return;

    // Check if the user has already seen the tour
    const hasSeenTour = localStorage.getItem("tourSeen") === "true";
    if (hasSeenTour) return;

    // Wait a short moment to let the UI render completely
    const timer = setTimeout(() => {
      const tourObj = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        nextBtnText: lang === "de" ? "Weiter" : "Next",
        prevBtnText: lang === "de" ? "Zurück" : "Prev",
        doneBtnText: lang === "de" ? "Fertig" : "Done",
        onDestroyed: () => {
          localStorage.setItem("tourSeen", "true");
        },
        steps: [
          {
            element: "#tour-import",
            popover: {
              title: t("tour.importTitle"),
              description: t("tour.importDesc"),
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "#tour-recipes",
            popover: {
              title: t("tour.recipesTitle"),
              description: t("tour.recipesDesc"),
              side: "top",
              align: "start",
            },
          },
          {
            element: "#tour-pwa",
            popover: {
              title: t("tour.pwaTitle"),
              description: t("tour.pwaDesc"),
              side: "left",
              align: "end",
            },
          },
        ],
      });

      tourObj.drive();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
