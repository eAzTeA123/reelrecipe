"use client";

import { CATEGORIES } from "@/domain/categories";

export function CategoryChips({
  value,
  onChange,
  allowAll,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  allowAll?: boolean;
}) {
  return (
    <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label="Kategorien">
      {allowAll && (
        <Chip active={!value} onClick={() => onChange(undefined)}>Alle</Chip>
      )}
      {CATEGORIES.map((c) => (
        <Chip key={c} active={value === c} onClick={() => onChange(value === c ? undefined : c)}>
          {c}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`pressable h-9 shrink-0 rounded-full border px-4 text-[14px] font-medium ${
        active
          ? "border-accent bg-accent text-accent-ink"
          : "border-line bg-surface text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}
