"use client";

import { IconSearch, IconX } from "./Icons";

export function SearchField({
  value,
  onChange,
  placeholder = "Suchen",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">
        <IconSearch size={18} />
      </span>
      <input
        type="search"
        role="searchbox"
        aria-label="Rezepte durchsuchen"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[52px] w-full rounded-ctl border border-line bg-surface pl-11 pr-14 text-[16px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Suche zurücksetzen"
          onClick={() => onChange("")}
          className="pressable absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-pill text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <IconX size={18} />
        </button>
      )}
    </div>
  );
}
