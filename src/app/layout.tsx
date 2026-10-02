import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";
import { ZoomGuard } from "@/components/ZoomGuard";

export const metadata: Metadata = {
  title: { default: "Scroll2Cook", template: "%s · Scroll2Cook" },
  description: "Rezepte aus Social Media und dem Web importieren, organisieren und kochen – komplett lokal auf deinem Gerät.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scroll2Cook",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // **Zoom-Sperre.** Die App soll sich wie eine native App anfühlen; Zoomen und
  // Doppeltipp-Vergrößerung sind unerwünscht. Das ist eine bewusste Entscheidung
  // gegen WCAG 1.4.4 („Text lässt sich vergrößern"). Sie ist vertretbar, weil
  // alle Bedienziele mindestens 44 × 44 px groß sind (Wächter:
  // `e2e/a11y.spec.ts`) und Eingabefelder bei 16 px bleiben – die App ist also
  // ohne Zoom bedienbar. `maximumScale` und `userScalable` gehören zusammen:
  // Chrome ignoriert `user-scalable=no` ohne `maximum-scale=1`.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Passt die Browser-/Systemleiste an den jeweiligen Modus an.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#131110" },
  ],
};

import { I18nProvider } from "@/lib/i18n/context";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { Figtree, Fraunces } from "next/font/google";

import { MigrationRunner } from "@/components/MigrationRunner";
import { TimerProvider } from "@/components/TimerProvider";

/** UI- und Textschrift. */
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

/** Display-Schrift für Überschriften, Wortmarke und große Zahlen. */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

/**
 * Setzt die Theme-Wahl bevor der erste Frame gemalt wird – sonst blitzt beim
 * Laden kurz das helle Papier auf. Ohne gespeicherte Wahl entscheidet CSS über
 * `prefers-color-scheme`; hier wird nur eine ausdrückliche Wahl angewandt.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem("s2c-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${figtree.variable} ${fraunces.variable}`}
    >
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <ZoomGuard />
        <I18nProvider>
          <TimerProvider>
            <MigrationRunner />
            <ToastProvider>
              <AppShell>{children}</AppShell>
           </ToastProvider>
          </TimerProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
