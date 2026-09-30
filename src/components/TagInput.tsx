"use client";

import { useEffect, useState } from "react";
import { getRecipeRepository } from "@/data";
import { collectTags, parseTagInput, removeTag } from "@/lib/tags";
import { useI18n } from "@/lib/i18n/context";

/**
 * Tag-Eingabe für Rezepte: Chips mit ×, Eingabe per Enter/Komma, Vorschläge
 * aus den bereits vergebenen Tags der eigenen Bibliothek.
 *
 * Lädt die Vorschläge selbst (ein Lesezugriff je geöffnetem Formular), damit
 * die aufrufenden Seiten unverändert bleiben.
 */
export function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    void getRecipeRepository()
      .list()
      .then((recipes) => setSuggestions(collectTags(recipes)))
      .catch((e) => console.error("tag suggestions failed", e));
  }, []);

  function commit(raw: string) {
    const next = parseTagInput(raw, value);
    if (next.length !== value.length) onChange(next);
    setInput("");
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => onChange(removeTag(value, tag))}
                className="pressable flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-[13px] font-medium text-ink-2"
                aria-label={t("form.tagRemove").replace("{tag}", tag)}
              >
                {tag}
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id="tag-input"
        list="tag-suggestions"
        value={input}
        onChange={(e) => {
          const raw = e.target.value;
          if (/[,;]$/.test(raw)) commit(raw);
          else setInput(raw);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (input.trim()) commit(input);
          }
        }}
        onBlur={() => {
          if (input.trim()) commit(input);
        }}
        placeholder={t("form.tagsPlaceholder")}
        className="h-11 rounded-xl border border-line bg-surface px-3 text-[15px] text-ink focus:border-accent focus:outline-none"
      />
      <datalist id="tag-suggestions">
        {suggestions
          .filter((tag) => !value.some((own) => own.toLowerCase() === tag.toLowerCase()))
          .map((tag) => (
            <option key={tag} value={tag} />
          ))}
      </datalist>
      <p className="text-[13px] text-ink-3">{t("form.tagsHint")}</p>
    </div>
  );
}
