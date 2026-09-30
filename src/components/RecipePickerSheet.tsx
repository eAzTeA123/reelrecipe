"use client";

import { useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { IconCheck, IconSearch } from "./Icons";
import { useI18n } from "@/lib/i18n/context";
import { normalizeForSearch } from "@/lib/text";
import { totalTime } from "@/lib/collections";
import type { Recipe } from "@/domain/types";

/**
 * Rezepte per Antippen in eine Sammlung legen oder herausnehmen – mit Suche,
 * damit man auch bei vielen Rezepten schnell ans Ziel kommt. Rezepte, die der
 * Filter der Sammlung schon erfasst, sind markiert und müssen nicht doppelt
 * hinzugefügt werden.
 */
export function RecipePickerSheet({
  onClose,
  collectionName,
  recipes,
  manualIds,
  filterIds,
  onToggle,
}: {
  onClose: () => void;
  collectionName: string;
  recipes: Recipe[];
  manualIds: string[];
  filterIds: string[];
  onToggle: (recipeId: string, next: boolean) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const manual = useMemo(() => new Set(manualIds), [manualIds]);
  const viaFilter = useMemo(() => new Set(filterIds), [filterIds]);

  const visible = useMemo(() => {
    const needle = normalizeForSearch(query);
    const sorted = [...recipes].sort((a, b) => a.title.localeCompare(b.title, "de"));
    if (!needle) return sorted;
    return sorted.filter((recipe) => normalizeForSearch(recipe.title).includes(needle));
  }, [recipes, query]);

  return (
    <Sheet open onClose={onClose} title={t("collections.addRecipes")}>
      <p className="mb-3 text-[13px] text-ink-3">
        <span className="font-semibold text-ink-2">{collectionName}</span> · {manualIds.length}{" "}
        {manualIds.length === 1 ? t("collections.item") : t("collections.items")}
      </p>

      <div className="relative mb-3">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
          <IconSearch size={18} />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("collections.pickerSearch")}
          aria-label={t("collections.pickerSearch")}
          className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-[16px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-ink-3">{t("collections.pickerEmpty")}</p>
      ) : (
        <ul className="flex max-h-[52vh] flex-col gap-1 overflow-y-auto">
          {visible.map((recipe) => {
            const included = manual.has(recipe.id);
            const matching = viaFilter.has(recipe.id);
            const time = totalTime(recipe);
            return (
              <li key={recipe.id}>
                <button
                  type="button"
                  aria-pressed={included}
                  onClick={() => onToggle(recipe.id, !included)}
                  className={`pressable flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
                    included ? "border-accent bg-accent-soft" : "border-line bg-surface"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      included ? "border-accent bg-accent text-accent-ink" : "border-line text-transparent"
                    }`}
                  >
                    <IconCheck size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {recipe.title}
                    </span>
                    <span className="block text-[12px] text-ink-3">
                      {[
                        recipe.category,
                        time > 0 ? `${time} Min` : undefined,
                        matching ? t("collections.viaFilter") : undefined,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Button onClick={onClose} fullWidth className="mt-4">
        {t("collections.done")}
      </Button>
    </Sheet>
  );
}
