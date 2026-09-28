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
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f6f6f4",
};

import { I18nProvider } from "@/lib/i18n/context";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { Manrope } from "next/font/google";

import { MigrationRunner } from "@/components/MigrationRunner";
import { TimerProvider } from "@/components/TimerProvider";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning className={manrope.variable}>
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
