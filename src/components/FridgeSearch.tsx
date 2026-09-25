"use client";

import { useState } from "react";
import { IconPlus, IconX, IconFridge } from "./Icons";

const QUICK_STAPLES = [
  "Eier",
  "Milch",
  "Zwiebeln",
  "Knoblauch",
  "Tomaten",
  "Nudeln",
  "Reis",
  "Käse",
  "Kartoffeln",
  "Butter",
  "Feta",
  "Hähnchen",
];

export function FridgeSearch({
  ingredients,
  onChange,
}: {
  ingredients: string[];
  onChange: (ingredients: string[]) => void;
}) {
  const [inputVal, setInputVal] = useState("");

  const addIngredient = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Mehrere Zutaten mit Komma trennen
    const parts = trimmed
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const next = [...ingredients];
    for (const part of parts) {
      if (!next.some((existing) => existing.toLowerCase() === part.toLowerCase())) {
        next.push(part);
      }
    }
    onChange(next);
    setInputVal("");
  };

  const removeIngredient = (indexToRemove: number) => {
    onChange(ingredients.filter((_, idx) => idx !== indexToRemove));
  };

  const clearAll = () => {
    onChange([]);
    setInputVal("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addIngredient(inputVal);
    }
  };

  // Schnellauswahl: nur Zutaten anzeigen, die noch nicht gewählt sind
  const availableQuickPicks = QUICK_STAPLES.filter(
    (staple) => !ingredients.some((item) => item.toLowerCase() === staple.toLowerCase())
  );

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <IconFridge size={22} />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-ink">Was ist im Kühlschrank?</h2>
            <p className="text-[13px] text-ink-2">
              Füge deine Reste hinzu – wir finden passende Rezepte aus deiner Bibliothek.
            </p>
          </div>
        </div>

        {ingredients.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="pressable shrink-0 text-[13px] font-medium text-ink-3 hover:text-danger"
          >
            Alle löschen
          </button>
        )}
      </div>

      {/* Eingabefeld */}
      <div className="relative mb-3 flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Zutat eintippen (z. B. Feta, Paprika)..."
          className="h-11 flex-1 rounded-xl border border-line bg-white px-4 text-[15px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => addIngredient(inputVal)}
          disabled={!inputVal.trim()}
          className="pressable inline-flex h-11 items-center gap-1.5 rounded-xl bg-accent px-4 text-[14px] font-bold text-accent-ink hover:opacity-95 disabled:opacity-40"
        >
          <IconPlus size={18} />
          <span>Hinzufügen</span>
        </button>
      </div>

      {/* Ausgewählte Zutaten (Chips) */}
      {ingredients.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {ingredients.map((ing, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft py-1 pl-3 pr-1.5 text-[14px] font-semibold text-accent"
            >
              {ing}
              <button
                type="button"
                onClick={() => removeIngredient(idx)}
                className="pressable inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-accent/20"
                aria-label={`${ing} entfernen`}
              >
                <IconX size={14} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-[13px] text-ink-3 italic">
          Noch keine Zutaten gewählt. Tippe oben etwas ein oder nutze die Schnellauswahl:
        </p>
      )}

      {/* Schnellauswahl Vorschläge */}
      {availableQuickPicks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[12px] font-bold uppercase tracking-wider text-ink-3 mr-1">
            Vorschläge:
          </span>
          {availableQuickPicks.slice(0, 8).map((staple) => (
            <button
              key={staple}
              type="button"
              onClick={() => addIngredient(staple)}
              className="pressable inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:border-accent hover:text-accent"
            >
              <IconPlus size={12} />
              {staple}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
