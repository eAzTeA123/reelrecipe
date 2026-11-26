"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const EXIT_MS = 180;

/** Bottom-Sheet (Mobile) / zentriertes Modal (Desktop) mit Focus-Management. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const drag = useRef<{ y: number; t: number; dy: number; v: number } | null>(null);
  const [closing, setClosing] = useState(false);
  const rendered = open || closing;

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, EXIT_MS);
  }, [closing, onClose]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  // Initialer Fokus nur einmal beim Öffnen setzen
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    el?.querySelector<HTMLElement>("button, input, [tabindex]")?.focus();
  }, [open]);

  useEffect(() => {
    if (!rendered) return;
    const el = ref.current;
    const prev = document.activeElement as HTMLElement | null;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
      if (e.key !== "Tab" || !el) return;
      const focusables = el.querySelectorAll<HTMLElement>(
        "button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])",
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [rendered, requestClose]);

  if (!rendered) return null;

  function onDragStart(e: React.PointerEvent) {
    // Nur mobil (Bottom-Sheet); am Desktop ist es ein zentriertes Modal.
    if (closing || !window.matchMedia("(max-width: 767px)").matches) return;
    const el = ref.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    el.style.animation = "none"; // sheet-up hält sonst transform fest
    el.style.transition = "none";
    drag.current = { y: e.clientY, t: performance.now(), dy: 0, v: 0 };
  }

  function onDragMove(e: React.PointerEvent) {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dy = Math.max(0, e.clientY - d.y);
    const now = performance.now();
    d.v = (dy - d.dy) / Math.max(1, now - d.t);
    d.dy = dy;
    d.t = now;
    el.style.transform = `translateY(${dy}px)`;
  }

  function onDragEnd() {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el) return;
    const ms = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220;
    el.style.transition = `transform ${ms}ms var(--ease-out)`;
    if (d.dy > 110 || d.v > 0.6) {
      el.style.transform = "translateY(105%)";
      setClosing(true);
      closeTimer.current = window.setTimeout(() => {
        setClosing(false);
        onClose();
      }, Math.max(ms, 1));
    } else {
      el.style.transform = "translateY(0)";
      window.setTimeout(() => {
        el.style.transition = "";
        el.style.transform = "";
      }, ms);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="presentation"
      style={{ overscrollBehavior: "contain" }}
    >
      <div
        className={`absolute inset-0 bg-black/35 ${closing ? "overlay-out" : "overlay-in"}`}
        onClick={requestClose}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full max-w-lg overflow-hidden rounded-t-sheet bg-surface px-5 pb-8 pt-3 shadow-pop md:rounded-sheet md:p-6 ${
          closing ? "sheet-down" : "sheet-up"
        }`}
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <div
          className="-mx-5 -mt-3 touch-none px-5 pt-3 md:mx-0 md:mt-0 md:px-0 md:pt-0"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-pill bg-ink-3/40 md:hidden" aria-hidden />
          <h2 className="mb-4 border-b border-line pb-3 text-center font-display text-h1 md:text-left">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
