"use client";

import { useEffect, useRef } from "react";

/**
 * Blendet Elemente beim Scrollen einmalig ein – dezent und ohne Flackern:
 * Inhalte, die schon im Viewport stehen, werden gar nicht erst versteckt.
 * Bei `prefers-reduced-motion` passiert nichts.
 *
 * Die Klasse `.reveal` kommt bewusst per JS dazu: ohne JavaScript bleibt der
 * Inhalt sichtbar statt unsichtbar hängen.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Schon sichtbar? Dann nicht verstecken (kein Aufblitzen beim Laden).
    const box = el.getBoundingClientRect();
    if (box.top < window.innerHeight * 0.92) return;

    el.classList.add("reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  /** Staffelung in Millisekunden, z. B. Index × 40. */
  delay?: number;
  className?: string;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={className}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
