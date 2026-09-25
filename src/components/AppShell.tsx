"use client";
import { useI18n } from "@/lib/i18n/context";

import Link from "next/link";
import { useEffect } from "react";
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
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/85 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {getNavItems(t).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors ${
                active ? "text-accent" : "text-ink-3"
              }`}
            >
              {active && label === t("nav.favorites") ? (
                <IconHeartFill size={22} />
              ) : (
                <Icon size={22} />
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
    <header className="sticky top-0 z-40 hidden border-b border-line bg-white/80 backdrop-blur-xl md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
          <img src="/icon.svg" alt="ReelRecipe Logo" width={32} height={32} className="rounded-[9px]" />
          {t("brand.name")}
        </Link>
        <nav aria-label="Hauptnavigation" className="flex items-center gap-1">
          {getNavItems(t).map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`pressable rounded-full px-4 py-2 text-[15px] font-medium ${
                  active ? "bg-accent-soft text-accent" : "text-ink-2 hover:text-ink"
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
  // Persistenten Speicher anfragen, damit der Browser IndexedDB nicht vorzeitig löscht
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">Zum Inhalt springen</a>
      <TopNav />
      <main
        className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 md:px-6 md:pb-16 md:pt-8"
        id="main"
        tabIndex={-1}
      >
        <div key={pathname} className="page-enter">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
