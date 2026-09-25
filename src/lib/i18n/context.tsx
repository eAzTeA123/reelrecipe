"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
    try {
      const saved = localStorage.getItem("ReelRecipe-lang");
      if (saved === "en" || saved === "de") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLangState(saved);
      } else {
        const browserLang = navigator.language.startsWith("de") ? "de" : "en";
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLangState(browserLang);
      }
    } catch {
      // Ignore
    }
    setMounted(true);
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem("ReelRecipe-lang", newLang);
      document.documentElement.lang = newLang;
    } catch {
      // Ignore
    }
  };

  const t = (key: TranslationKey): string => {
    return dictionaries[lang][key] || dictionaries.de[key] || key;
  };

  // Prevent hydration mismatch by rendering children without context first if needed, 
  // but since we want to translate text, returning children immediately is fine, 
  // but it might flash German if SSG. We accept the small flash for a local MVP.
  
  if (!mounted) {
    // Avoid hydration mismatch on first render
    return (
      <I18nContext.Provider value={{ lang, setLang, t }}>
        <div style={{ visibility: "hidden" }}>{children}</div>
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
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
