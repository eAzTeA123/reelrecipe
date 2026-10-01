import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scroll2Cook – Dein Rezept-Organizer",
    short_name: "Scroll2Cook",
    description: "Rezepte aus Social Media und dem Web importieren, organisieren und kochen – komplett lokal.",
    start_url: "/",
    display: "standalone",
    // Statische Werte: das PWA-Chrome kann nicht dynamisch zwischen Hell und Dunkel
    // wechseln. Den passenden Wert setzt zusätzlich `viewport.themeColor` in layout.tsx.
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-1024.png", sizes: "1024x1024", type: "image/png" },
    ],
    // Share Target API (funktioniert super auf Android / ChromeOS)
    share_target: {
      action: "/import",
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
    shortcuts: [
      {
        name: "Neues Rezept scannen",
        url: "/import?ref=shortcut",
        icons: [{ src: "/icon-512.png", sizes: "512x512" }],
      },
      {
        name: "Einkaufsliste",
        url: "/shopping?ref=shortcut",
        icons: [{ src: "/icon-512.png", sizes: "512x512" }],
      },
      {
        name: "Wochenplan",
        url: "/planner?ref=shortcut",
        icons: [{ src: "/icon-512.png", sizes: "512x512" }],
      },
    ],
  };
}
