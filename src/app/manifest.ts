import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ReelRecipe – Mein Rezept-Organizer",
    short_name: "ReelRecipe",
    description: "Rezepte aus Instagram importieren, organisieren und kochen – komplett lokal.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f6f4",
    theme_color: "#f6f6f4",
    icons: [
      { src: "/icon-512.png", sizes: "192x192", type: "image/png" },
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
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Einkaufsliste",
        url: "/shopping?ref=shortcut",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Wochenplan",
        url: "/planner?ref=shortcut",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
