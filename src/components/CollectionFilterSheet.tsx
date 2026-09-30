"use client";

import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { IconX } from "./Icons";
import { useI18n } from "@/lib/i18n/context";
import { isCollectionFilterEmpty } from "@/lib/collections";
import type { CollectionFilter } from "@/domain/types";

const TIME_STEPS = [15, 30, 45, 60] as const;

/**
 * Eigene Filter einer Sammlung setzen – ohne die Rezepte vorher zu
 * verschlagworten. Alle Regeln greifen auf vorhandene Rezeptdaten zu und
 * werden sofort gespeichert; die Trefferzahl aktualisiert sich live.
 *
 * Die Textfelder sind bewusst unkontrolliert (`defaultValue` + wechselnder
 * `key`): nach dem Zurücksetzen oder erneutem Öffnen zeigen sie den
 * gespeicherten Stand, ohne State-Effekte.
 */
export function CollectionFilterSheet({
  open,
  onClose,
  collectionName,
  filter,
  matchCount,
  categoryOptions,
  tagOptions,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  collectionName: string;
  filter: CollectionFilter | undefined;
  matchCount: number;
  /** App-Kategorien plus alle Kategorien, die in der Bibliothek vorkommen */
  categoryOptions: string[];
  tagOptions: string[];
  onChange: (filter: CollectionFilter) => void;
}) {
  const { t } = useI18n();
  const active = filter ?? {};

  function patch(next: Partial<CollectionFilter>) {
    onChange({ ...active, ...next });
  }

  /** Auch die alte einzelne Kategorie (`category`) zählt als gewählt. */
  const selectedCategories = [
    ...(active.categories ?? []),
    ...(active.category ? [active.category] : []),
  ];

  function toggleCategory(category: string) {
    const key = category.toLowerCase();
    const isOn = selectedCategories.some((entry) => entry.toLowerCase() === key);
    if (isOn) {
      patch({
        categories: (active.categories ?? []).filter((entry) => entry.toLowerCase() !== key),
        category: undefined,
      });
      return;
    }
    patch({ categories: [...(active.categories ?? []), category] });
  }

  function toggleTag(tag: string) {
    const current = active.tags ?? [];
    patch({
      tags: current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag],
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("collections.filterTitle")}>
      <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pb-1">
        <p className="text-[13px] text-ink-3">
          <span className="font-semibold text-ink-2">{collectionName}</span>
          {" · "}
          {matchCount} {matchCount === 1 ? t("collections.item") : t("collections.items")}
        </p>

        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-ink">{t("collections.filterCategory")}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {categoryOptions.map((category) => {
              const on = selectedCategories.some(
                (entry) => entry.toLowerCase() === category.toLowerCase(),
              );
              return (
                <li key={category}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCategory(category)}
                    className={`pressable rounded-full border px-3 py-2 text-[14px] font-medium ${
                      on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink-2"
                    }`}
                  >
                    {category}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-ink">{t("collections.filterTime")}</h3>
          <ul className="flex flex-wrap gap-1.5">
            <li>
              <button
                type="button"
                aria-pressed={active.maxTotalTime === undefined}
                onClick={() => patch({ maxTotalTime: undefined })}
                className={`pressable rounded-full border px-3 py-2 text-[14px] font-medium ${
                  active.maxTotalTime === undefined
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line bg-surface text-ink-2"
                }`}
              >
                {t("collections.filterTimeAny")}
              </button>
            </li>
            {TIME_STEPS.map((minutes) => {
              const on = active.maxTotalTime === minutes;
              return (
                <li key={minutes}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => patch({ maxTotalTime: minutes })}
                    className={`pressable rounded-full border px-3 py-2 text-[14px] font-medium ${
                      on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink-2"
                    }`}
                  >
                    ≤ {minutes} Min
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-ink">{t("collections.filterMore")}</h3>
          <button
            type="button"
            aria-pressed={Boolean(active.favoritesOnly)}
            onClick={() => patch({ favoritesOnly: active.favoritesOnly ? undefined : true })}
            className={`pressable flex min-h-11 items-center gap-3 rounded-xl border px-4 text-left text-[15px] font-medium ${
              active.favoritesOnly
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface text-ink-2"
            }`}
          >
            {t("collections.filterFavorites")}
          </button>

          <label className="flex flex-col gap-1.5 text-[14px] font-medium text-ink-2">
            {t("collections.filterTitleContains")}
            <input
              key={`title-${open}-${active.titleContains ?? ""}`}
              defaultValue={active.titleContains ?? ""}
              onBlur={(e) => patch({ titleContains: e.target.value.trim() || undefined })}
              onKeyDown={(e) => {
                if (e.key === "Enter") patch({ titleContains: e.currentTarget.value.trim() || undefined });
              }}
              placeholder={t("collections.filterTextPlaceholder")}
              className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-[16px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[14px] font-medium text-ink-2">
            {t("collections.filterIngredientContains")}
            <input
              key={`ingredient-${open}-${active.ingredientContains ?? ""}`}
              defaultValue={active.ingredientContains ?? ""}
              onBlur={(e) => patch({ ingredientContains: e.target.value.trim() || undefined })}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  patch({ ingredientContains: e.currentTarget.value.trim() || undefined });
              }}
              placeholder={t("collections.filterTextPlaceholder")}
              className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-[16px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
          </label>
        </section>

        {tagOptions.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-[15px] font-semibold text-ink">{t("collections.filterTags")}</h3>
            <ul className="flex flex-wrap gap-1.5">
              {(active.tags ?? []).length > 0 && (
                <li className="flex flex-wrap gap-1.5">
                  {(active.tags ?? []).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="pressable inline-flex h-9 items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3 text-[13px] font-medium text-accent"
                    >
                      {tag}
                      <IconX size={13} />
                    </button>
                  ))}
                </li>
              )}
              {tagOptions
                .filter((tag) => !(active.tags ?? []).includes(tag))
                .slice(0, 10)
                .map((tag) => (
                  <li key={tag}>
                    <button
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="pressable h-9 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink-2"
                    >
                      {tag}
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <Button
          variant="secondary"
          onClick={() => onChange({})}
          disabled={isCollectionFilterEmpty(active)}
          className="flex-1"
        >
          {t("collections.filterReset")}
        </Button>
        <Button onClick={onClose} className="flex-1">
          {t("collections.done")}
        </Button>
      </div>
    </Sheet>
  );
}
