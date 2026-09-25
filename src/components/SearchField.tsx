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
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
        <IconSearch size={18} />
      </span>
      <input
        type="search"
        role="searchbox"
        aria-label="Rezepte durchsuchen"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-full border border-line bg-surface pl-10 pr-10 text-[16px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Suche zurücksetzen"
          onClick={() => onChange("")}
          className="pressable absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-3"
        >
          <IconX size={16} />
        </button>
      )}
    </div>
  );
}
