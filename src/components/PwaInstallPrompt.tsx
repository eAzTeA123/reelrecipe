"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Sheet } from "./Sheet";

export function PwaInstallPrompt() {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // default true to avoid flash
  const [hasPulsed, setHasPulsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if already installed (PWA standalone mode)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && (window.navigator as any).standalone === true);
    
    setIsStandalone(standalone);

    if (!standalone) {
      const seen = localStorage.getItem("saveMeSeen") === "true";
      // If we haven't seen it, we'll pulse the button
      if (!seen) {
        // Automatically set it as seen after first visit
        localStorage.setItem("saveMeSeen", "true");
        // Trigger pulse animation
        setHasPulsed(false);
        const timer = setTimeout(() => setHasPulsed(true), 4000);
        return () => clearTimeout(timer);
      } else {
        setHasPulsed(true); // Already seen, no pulse
      }
    }
  }, []);

  if (!mounted || isStandalone) return null;

  return (
    <>
      <button
        id="tour-pwa"
        onClick={() => setShowPrompt(true)}
        className={`fixed z-30 bottom-24 right-4 md:bottom-6 md:right-6 flex items-center justify-center gap-2 rounded-full bg-ink text-white px-4 py-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-transform hover:scale-105 active:scale-95 ${
          !hasPulsed ? "animate-pulse ring-4 ring-ink/20" : ""
        }`}
        aria-label={t("pwa.saveMe")}
      >
        <span className="text-[14px] font-bold tracking-wide">{t("pwa.saveMe").replace(" 👋", "")}</span>
        <span className="text-[16px] origin-bottom-right animate-[wave_2.5s_infinite]">👋</span>
      </button>

      <Sheet
        open={showPrompt}
        onClose={() => setShowPrompt(false)}
        title={t("pwa.title")}
      >
        <div className="flex flex-col gap-6">
          <p className="text-[15px] text-ink-2 leading-relaxed">
            {t("pwa.subtitle")}
          </p>

          <div className="rounded-card bg-surface p-4 shadow-sm">
            <h3 className="font-bold text-[16px] mb-3">{t("pwa.iosTitle")}</h3>
            <ol className="list-decimal list-inside space-y-2 text-[14px] text-ink-2 marker:font-medium marker:text-ink">
              <li>{t("pwa.iosStep1")}</li>
              <li>{t("pwa.iosStep2")} <span className="inline-flex items-center justify-center p-1 bg-surface-2 rounded-md"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></span></li>
              <li>{t("pwa.iosStep3")} <span className="inline-flex items-center justify-center p-1 bg-surface-2 rounded-md"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></span></li>
              <li>{t("pwa.iosStep4")}</li>
            </ol>
          </div>

          <div className="rounded-card bg-surface p-4 shadow-sm mb-4">
            <h3 className="font-bold text-[16px] mb-3">{t("pwa.androidTitle")}</h3>
            <ol className="list-decimal list-inside space-y-2 text-[14px] text-ink-2 marker:font-medium marker:text-ink">
              <li>{t("pwa.androidStep1")}</li>
              <li>{t("pwa.androidStep2")} <span className="inline-flex items-center justify-center px-1 font-serif">⋮</span></li>
              <li>{t("pwa.androidStep3")}</li>
              <li>{t("pwa.androidStep4")}</li>
            </ol>
          </div>
        </div>
      </Sheet>
    </>
  );
}
