import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: { default: "ReelRecipe", template: "%s · ReelRecipe" },
  description: "Rezepte aus Instagram importieren, organisieren und kochen – komplett lokal auf deinem Gerät.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ReelRecipe",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f6f4",
};

import { I18nProvider } from "@/lib/i18n/context";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { Manrope } from "next/font/google";

import { MigrationRunner } from "@/components/MigrationRunner";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning className={manrope.variable}>
      <body suppressHydrationWarning>
        <I18nProvider>
          <MigrationRunner />
          <ToastProvider>
            <AppShell>{children}</AppShell>
            <PwaInstallPrompt />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
