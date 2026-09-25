"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react";
import { dictionaries, Language, TranslationKey } from "./dictionaries";

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("de");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let initialLang: Language = "de";
    try {
      const saved = localStorage.getItem("ReelRecipe-lang");
      if (saved === "en" || saved === "de") {
        initialLang = saved;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLangState(saved);
      } else {
        const browserLang = navigator.language.startsWith("de") ? "de" : "en";
        initialLang = browserLang;
        setLangState(browserLang);
      }
    } catch {
      // Ignore
    }
    document.documentElement.lang = initialLang;
    setMounted(true);
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem("ReelRecipe-lang", newLang);
      document.documentElement.lang = newLang;
    } catch {
      // Ignore
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return dictionaries[lang][key] || dictionaries.de[key] || key;
    },
    [lang],
  );

  const contextValue = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  if (!mounted) {
    return (
      <I18nContext.Provider value={{ lang: "de", setLang, t: (k) => dictionaries.de[k] || k }}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
