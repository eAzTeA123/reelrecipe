"use client";
import { useI18n } from "@/lib/i18n/context";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { IconCart, IconGrid, IconHeart, IconHeartFill, IconHome, IconCalendar } from "./Icons";

const getNavItems = (t: (key: import("@/lib/i18n/dictionaries").TranslationKey) => string) => [
  { href: "/", label: t("nav.home"), icon: IconHome },
  { href: "/recipes", label: t("nav.recipes"), icon: IconGrid },
  { href: "/planner", label: t("nav.planner"), icon: IconCalendar },
  { href: "/shopping", label: t("nav.shopping"), icon: IconCart },
  { href: "/favorites", label: t("nav.favorites"), icon: IconHeart },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function BottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    /*
     * Schwebende Kapsel wie in Apples Tab Bars: die Leiste ist nicht mehr
     * Kante an Kante, sondern ein frei liegendes Materialfeld mit Abstand zum
     * Rand. Der aktive Eintrag bekommt eine Pill-Fläche hinter Symbol und
     * Beschriftung.
     *
     * Wichtig: **kein** `backdrop-filter` auf dieser fixierten Leiste (auch
     * nicht auf Kindern) – das bricht auf iOS `position: fixed`. Der Material-
     * Eindruck kommt deshalb aus halbtransparenter Fläche, Rand und Schatten.
     * Die Ränder der Kapsel fangen keine Taps ab (pointer-events).
     */
    <nav
      aria-label="Hauptnavigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
    >
      <div className="pointer-events-auto mx-3 flex items-stretch gap-1 rounded-pill border border-line bg-surface/95 p-1.5 shadow-lift">
        {getNavItems(t).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              data-tour={href.replace("/", "") || "home"}
              aria-current={active ? "page" : undefined}
              className={`pressable flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-pill px-1 py-1.5 text-[11px] transition-colors ${
                active
                  ? "bg-accent-soft font-semibold text-accent-text"
                  : "font-medium text-ink-3 hover:text-ink-2"
              }`}
            >
              {active && label === t("nav.favorites") ? (
                <IconHeartFill size={21} />
              ) : (
                <Icon size={21} />
              )}
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TopNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <header className="glass sticky top-0 z-40 hidden border-b border-line md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/icon.svg" alt="Scroll2Cook Logo" width={32} height={32} className="rounded-ctl" />
          <span className="font-display text-h2 text-ink">{t("brand.name")}</span>
        </Link>
        <nav aria-label="Hauptnavigation" className="flex items-center gap-1">
          {getNavItems(t).map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                data-tour={href.replace("/", "") || "home"}
                aria-current={active ? "page" : undefined}
                className={`pressable rounded-full px-4 py-2 text-body font-medium ${
                  active ? "bg-accent-soft text-accent-text" : "text-ink-2 hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  
  const pathname = usePathname();
  const [storageAtRisk, setStorageAtRisk] = useState(false);

  // Persistenten Speicher anfragen UND das Ergebnis auswerten: ohne gewährte
  // Persistenz kann der Browser (v. a. Safari/iOS) die IndexedDB räumen. Dann
  // darf die App keine Dauerhaftigkeit versprechen, sondern muss zum Backup raten.
  useEffect(() => {
    let cancelled = false;
    const storage = navigator.storage;
    if (!storage?.persist) return;
    void (async () => {
      try {
        if (localStorage.getItem("scroll2cook-storage-hint") === "dismissed") return;
      } catch {
        // localStorage nicht verfügbar: Hinweis trotzdem zeigen
      }
      try {
        const alreadyPersisted = storage.persisted ? await storage.persisted() : false;
        const granted = alreadyPersisted || (await storage.persist());
        if (!cancelled && !granted) setStorageAtRisk(true);
      } catch {
        // Storage-API nicht verfügbar: nichts zusichern, lieber warnen
        if (!cancelled) setStorageAtRisk(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function dismissStorageHint() {
    setStorageAtRisk(false);
    try {
      localStorage.setItem("scroll2cook-storage-hint", "dismissed");
    } catch {}
  }

  return (
    <>
      <div className="flex min-h-dvh flex-col">
        <a href="#main" className="skip-link">Zum Inhalt springen</a>
        <TopNav />
        <main
          className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 md:px-6 md:pb-16 md:pt-8"
          id="main"
          tabIndex={-1}
        >
          {storageAtRisk && (
            <div
              className="mb-4 flex items-start gap-3 rounded-card border border-line bg-surface-2 p-3.5 text-meta leading-snug text-ink-2"
              role="status"
            >
              <p className="flex-1">
                Dieser Browser garantiert nicht, dass deine Rezepte dauerhaft gespeichert bleiben.
                Exportiere in den Einstellungen regelmäßig ein Backup.
              </p>
              <button
                type="button"
                onClick={dismissStorageHint}
                className="pressable inline-flex min-h-11 shrink-0 items-center rounded-ctl px-3 text-meta font-semibold text-ink underline underline-offset-2"
              >
                Verstanden
              </button>
            </div>
          )}
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
    </>
  );
}


