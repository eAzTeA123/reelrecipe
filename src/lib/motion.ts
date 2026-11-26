/**
 * Bewegungs-Helfer. anime.js wird nur bei Bedarf nachgeladen (eigener Chunk),
 * damit Listen und Erstaufbau davon unberührt bleiben. Unter
 * `prefers-reduced-motion` passiert nie etwas.
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function loadAnime() {
  return import("animejs");
}

const BURST_COUNT = 8;

/**
 * Kleiner Partikel-Burst aus dem Mittelpunkt von `host` (z. B. Favoriten-Herz).
 * Nur transform/opacity, Partikel entfernen sich selbst wieder.
 */
export async function burstParticles(host: HTMLElement): Promise<void> {
  if (prefersReducedMotion()) return;
  const { animate } = await loadAnime();
  const dots: HTMLElement[] = [];
  for (let i = 0; i < BURST_COUNT; i++) {
    const dot = document.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    dot.className =
      "pointer-events-none absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-pill bg-accent";
    host.appendChild(dot);
    dots.push(dot);
    const angle = (Math.PI * 2 * i) / BURST_COUNT;
    const dist = 22 + (i % 2) * 6;
    animate(dot, {
      translateX: Math.cos(angle) * dist,
      translateY: Math.sin(angle) * dist,
      scale: [1, 0],
      opacity: [1, 0],
      duration: 520,
      ease: "outExpo",
      onComplete: () => dot.remove(),
    });
  }
}
