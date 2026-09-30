import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";

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
  // Kein maximumScale/userScalable: Nutzer müssen zoomen können (WCAG 1.4.4).
  viewportFit: "cover",
  themeColor: "#fbf6ef",
};

import { I18nProvider } from "@/lib/i18n/context";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { Instrument_Serif, Manrope } from "next/font/google";

import { MigrationRunner } from "@/components/MigrationRunner";
import { TimerProvider } from "@/components/TimerProvider";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

/** Display-Schrift für Überschriften und Cover (Kochbuch-Anmutung). */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${manrope.variable} ${instrumentSerif.variable}`}
    >
      <body suppressHydrationWarning>
        <I18nProvider>
          <TimerProvider>
            <MigrationRunner />
            <ToastProvider>
              <AppShell>{children}</AppShell>
              <PwaInstallPrompt />
            </ToastProvider>
          </TimerProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
