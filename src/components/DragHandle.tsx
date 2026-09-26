"use client";

import type { PointerEvent } from "react";

interface DragHandleProps {
  entryId: string;
  onDragStart: (entryId: string) => void;
}

export function DragHandle({ entryId, onDragStart }: DragHandleProps) {
  return (
    <button
      className="touch-none cursor-grab active:cursor-grabbing p-1 text-ink/30 hover:text-ink/60 transition-colors shrink-0"
      onPointerDown={(e: PointerEvent) => {
        e.preventDefault();
        onDragStart(entryId);
      }}
      aria-label="Rezept verschieben"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="5" cy="3" r="1.5" />
        <circle cx="11" cy="3" r="1.5" />
        <circle cx="5" cy="8" r="1.5" />
        <circle cx="11" cy="8" r="1.5" />
        <circle cx="5" cy="13" r="1.5" />
        <circle cx="11" cy="13" r="1.5" />
      </svg>
    </button>
  );
}
