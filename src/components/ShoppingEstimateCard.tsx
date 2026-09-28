"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { EstimateItem, RetailerFilter, ShoppingEstimate } from "@/domain/productTypes";
import { RETAILERS, RETAILER_NAMES } from "@/lib/products/retailers";
import { useI18n } from "@/lib/i18n/context";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { IconChevronDown, IconTag } from "./Icons";

type T = (key: TranslationKey) => string;

function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));
}

function useFormatters() {
  const { lang } = useI18n();
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  return {
    money: (v: number) => money.format(v),
    date: (iso: string) => date.format(new Date(iso)),
  };
}

export function RetailerChips({ value, onChange }: { value: RetailerFilter; onChange: (r: RetailerFilter) => void }) {
  const { t } = useI18n();
  const options: { id: RetailerFilter; label: string }[] = [
    { id: "all", label: t("price.allStores") },
    ...RETAILERS.map((r) => ({ id: r.id as RetailerFilter, label: r.name })),
  ];
  const rowRef = useRef<HTMLDivElement>(null);

  // Gemerkten Markt sichtbar machen, ohne die Seite vertikal zu scrollen
  useEffect(() => {
    const row = rowRef.current;
    const active = row?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (!row || !active) return;
    const left = active.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft + 16 || left + active.offsetWidth > row.scrollLeft + row.clientWidth - 16) {
      row.scrollLeft = Math.max(0, left - (row.clientWidth - active.offsetWidth) / 2);
    }
  }, [value]);

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={t("price.storeFilter")}
      className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:flex-wrap sm:overflow-visible"
    >
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={`pressable min-h-11 shrink-0 whitespace-nowrap rounded-full px-4 text-[14px] font-semibold transition-colors pointer-fine:min-h-9 pointer-fine:px-3 pointer-fine:text-[13px] ${
              active ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-2 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ItemLine({ item, t }: { item: EstimateItem; t: T }) {
  const f = useFormatters();
  let detail: string;
  if (item.status === "priced" && item.price) {
    const typeLabel =
      item.price.priceType === "CATEGORY"
        ? t("price.typeCategory")
        : item.price.priceType === "SIMILAR_PRODUCT"
          ? t("price.typeSimilar")
          : t("price.typeProduct");
    const categoryReference =
      item.price.priceType === "CATEGORY"
        ? fill(
            t(
              item.price.basis === "kilogram"
                ? "price.perKilogram"
                : item.price.basis === "unit"
                  ? "price.perUnit"
                  : "price.perPackage",
            ),
            { v: f.money(item.price.price) },
          )
        : "";
    const parts = [
      typeLabel,
      categoryReference,
      [item.product?.brand, item.product?.name].filter(Boolean).join(" · "),
      `${item.price.storeName}${item.price.city ? ` ${item.price.city}` : ""}`,
      f.date(item.price.date),
    ];
    detail = parts.filter(Boolean).join(" · ");
  } else if (item.status === "pantry") {
    detail = t("price.pantryItem");
  } else if (item.status === "no_price") {
    detail = `${t("price.noPrice")}${item.product ? ` · ${item.product.name}` : ""}`;
  } else {
    detail = t("price.noProduct");
  }
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-snug">{item.ingredientName}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{detail}</p>
        {item.status === "priced" && (item.price?.discounted || (item.packagesNeeded ?? 1) > 1 || item.amountUnclear) && (
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-medium text-ink-2">
            {item.price?.discounted && (
              <span className="inline-flex items-center gap-1">
                <IconTag size={13} /> {t("price.discounted")}
              </span>
            )}
            {(item.packagesNeeded ?? 1) > 1 && <span>{fill(t("price.packs"), { n: item.packagesNeeded! })}</span>}
            {item.amountUnclear && <span>{t("price.amountUnclear")}</span>}
          </p>
        )}
      </div>
      <span
        className={`shrink-0 pt-0.5 text-[15px] tabular-nums ${
          item.shoppingCost !== undefined ? "font-semibold text-ink" : "text-ink-3"
        }`}
      >
        {item.shoppingCost !== undefined ? f.money(item.shoppingCost) : "–"}
      </span>
    </li>
  );
}

function NutritionTiles({ estimate, servings, t }: { estimate: ShoppingEstimate; servings: number; t: T }) {
  const { total, coveredCount, consideredCount } = estimate.nutrition;
  if (consideredCount === 0) return null;
  const per = (v?: number) => (v === undefined ? undefined : v / Math.max(1, servings));
  const tiles: { label: string; value?: number; unit: string }[] = [
    { label: t("nutrition.kcal"), value: per(total.kcal), unit: "" },
    { label: t("nutrition.protein"), value: per(total.protein), unit: " g" },
    { label: t("nutrition.fat"), value: per(total.fat), unit: " g" },
    { label: t("nutrition.carbs"), value: per(total.carbohydrates), unit: " g" },
  ];
  return (
    <div className="border-t border-line pt-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-[15px] font-semibold">{t("nutrition.title")}</h3>
        {coveredCount > 0 && (
          <span className="text-[12px] text-ink-3">
            {fill(t("nutrition.coverage"), { n: coveredCount, m: consideredCount })}
          </span>
        )}
      </div>
      {coveredCount === 0 ? (
        <p className="text-[14px] text-ink-2">{t("nutrition.none")}</p>
      ) : (
        <dl className="grid grid-cols-4 gap-2">
          {tiles.map((tile) => (
            <div key={tile.label} className="flex flex-col-reverse rounded-xl bg-surface-2 px-2 py-2.5 text-center">
              <dt className="mt-0.5 truncate text-[11px] font-medium text-ink-2">{tile.label}</dt>
              <dd className="text-[16px] font-bold tabular-nums leading-tight">
                {tile.value === undefined ? "–" : `${Math.round(tile.value)}${tile.unit}`}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function ShoppingEstimateCard({
  estimate,
  loading,
  error,
  onRetry,
  retailer,
  onRetailerChange,
  variant,
  servings = 1,
  openIds,
}: {
  estimate?: ShoppingEstimate;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  retailer: RetailerFilter;
  onRetailerChange: (r: RetailerFilter) => void;
  variant: "recipe" | "list";
  servings?: number;
  /** Nur für die Einkaufsliste: IDs der noch nicht abgehakten Artikel */
  openIds?: Set<string>;
}) {
  const { t } = useI18n();
  const f = useFormatters();
  const headingId = useId();
  const detailsId = useId();
  const [showDetails, setShowDetails] = useState(false);

  const items = estimate ? (openIds ? estimate.items.filter((i) => openIds.has(i.id)) : estimate.items) : [];
  const considered = items.filter((i) => i.status !== "pantry");
  const priced = items.filter((i) => i.status === "priced");
  const total = Math.round(priced.reduce((s, i) => s + (i.shoppingCost ?? 0), 0) * 100) / 100;
  const hasPantry = items.some((i) => i.status === "pantry");
  const discounted = priced.filter((i) => i.price?.discounted).length;
  const dates = priced.map((i) => i.price!.date).sort();
  // Portionswert nur, wenn wirklich alle Zutaten bepreist und anteilig berechenbar sind
  const perServing =
    variant === "recipe" && estimate?.ingredientValueTotal !== undefined && priced.length === considered.length
      ? estimate.ingredientValueTotal / Math.max(1, servings)
      : undefined;
  const sourceError = estimate && (estimate.sources.products === "error" || estimate.sources.prices === "error");

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={loading}
      className="flex flex-col gap-4 rounded-2xl bg-surface p-4 shadow-card"
    >
      <h2 id={headingId} className="text-[17px] font-bold">
        {variant === "list" ? t("price.openTitle") : t("price.title")}
      </h2>

      <RetailerChips value={retailer} onChange={onRetailerChange} />

      {error && !estimate ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-[14px] text-ink-2">{t("price.error")}</p>
          <button
            type="button"
            onClick={onRetry}
            className="pressable min-h-11 rounded-full bg-surface-2 px-4 text-[14px] font-semibold text-ink"
          >
            {t("price.retry")}
          </button>
        </div>
      ) : !estimate ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <span className="sr-only">{t("price.loading")}</span>
          <div className="pulse-soft h-8 w-32 rounded-lg bg-black/[0.05]" />
          <div className="pulse-soft h-4 w-48 rounded bg-black/[0.04]" />
        </div>
      ) : (
        <div className={`flex flex-col gap-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {priced.length > 0 ? (
            <div>
              <p className="text-[30px] font-extrabold leading-none tracking-tight tabular-nums">
                ≈&nbsp;{f.money(total)}
              </p>
              <p className="mt-2 text-[14px] text-ink-2">
                {fill(t("price.coverage"), { n: priced.length, m: considered.length })}
                {hasPantry && <span className="block text-[13px] text-ink-3">{t("price.pantryNote")}</span>}
              </p>
              {perServing !== undefined && (
                <p className="mt-1 text-[13px] text-ink-2">{fill(t("price.perServing"), { v: f.money(perServing) })}</p>
              )}
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
                {dates.length > 0 && (
                  <span>
                    {dates[0] === dates[dates.length - 1]
                      ? fill(t("price.dateSingle"), { date: f.date(dates[0]) })
                      : fill(t("price.dateRange"), { from: f.date(dates[0]), to: f.date(dates[dates.length - 1]) })}
                  </span>
                )}
                {discounted > 0 && (
                  <span className="inline-flex items-center gap-1 font-medium text-ink-2">
                    <IconTag size={13} /> {fill(t("price.discountedCount"), { n: discounted })}
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[17px] font-semibold">{t("price.none")}</p>
              <p className="mt-1 text-[14px] text-ink-2">
                {retailer === "all"
                  ? t("price.noneAll")
                  : fill(t("price.noneStore"), { store: RETAILER_NAMES[retailer] })}
              </p>
            </div>
          )}

          {sourceError && <p className="text-[13px] text-ink-2">{t("price.partialError")}</p>}

          {variant === "recipe" && <NutritionTiles estimate={estimate} servings={servings} t={t} />}

          {items.length > 0 && (
            <div className="border-t border-line pt-1">
              <button
                type="button"
                aria-expanded={showDetails}
                aria-controls={detailsId}
                onClick={() => setShowDetails((v) => !v)}
                className="pressable flex min-h-11 w-full items-center justify-between text-[14px] font-semibold text-ink-2"
              >
                {showDetails ? t("price.hideDetails") : t("price.showDetails")}
                <IconChevronDown
                  size={18}
                  className={`motion-safe:transition-transform ${showDetails ? "rotate-180" : ""}`}
                />
              </button>
              {showDetails && (
                <div id={detailsId}>
                  <ul className="divide-y divide-line">
                    {items.map((item) => (
                      <ItemLine key={item.id} item={item} t={t} />
                    ))}
                  </ul>
                  <p className="pt-3 text-[12px] leading-relaxed text-ink-3">{t("price.source")}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
