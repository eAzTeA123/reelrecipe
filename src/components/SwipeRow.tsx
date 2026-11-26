"use client";

import { useRef } from "react";
import { IconTrash } from "./Icons";

const THRESHOLD = 96;

/**
 * Listenzeile, die sich nach links wischen lässt, um sie zu löschen.
 * Der Löschen-Knopf in der Zeile bleibt als Alternative (Tastatur, Screenreader).
 * Nur `transform` auf der inneren Fläche; vertikales Scrollen bleibt frei (`pan-y`).
 */
export function SwipeRow({
  children,
  onSwipeDelete,
}: {
  children: React.ReactNode;
  onSwipeDelete: () => void;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const bg = useRef<HTMLDivElement>(null);
  const st = useRef<{ x: number; y: number; dx: number; lock: "x" | "y" | null } | null>(null);

  function set(dx: number, animate: boolean) {
    const el = inner.current;
    if (!el) return;
    el.style.transition = animate ? "transform 0.28s var(--ease-spring)" : "none";
    el.style.transform = dx ? `translateX(${dx}px)` : "";
    if (bg.current) bg.current.style.opacity = String(Math.min(1, Math.abs(dx) / THRESHOLD));
  }

  function onDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("input, button")) return;
    st.current = { x: e.clientX, y: e.clientY, dx: 0, lock: null };
  }

  function onMove(e: React.PointerEvent) {
    const s = st.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!s.lock) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      s.lock = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (s.lock === "x") e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (s.lock !== "x") return;
    s.dx = Math.min(0, mx);
    set(s.dx, false);
  }

  function onUp() {
    const s = st.current;
    st.current = null;
    if (!s || s.lock !== "x") return;
    if (s.dx <= -THRESHOLD) {
      set(-window.innerWidth, true);
      window.setTimeout(onSwipeDelete, 180);
    } else {
      set(0, true);
    }
  }

  return (
    <li className="relative overflow-hidden">
      <div
        ref={bg}
        aria-hidden
        className="absolute inset-0 flex items-center justify-end bg-danger px-6 text-accent-ink opacity-0"
      >
        <IconTrash size={20} />
      </div>
      <div
        ref={inner}
        className="relative flex touch-pan-y items-center gap-3 bg-surface px-4 py-1"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {children}
      </div>
    </li>
  );
}
