import { NextRequest, NextResponse } from "next/server";
import { parseSocialUrl } from "@/lib/socialSource";

const TIMEOUT_MS = 6000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Liest Beschreibung + Cover aus dem eingebetteten Seiten-JSON. */
async function fetchFromPage(url: string): Promise<{ desc?: string; cover?: string } | null> {
  const res = await fetchWithTimeout(url, {
    headers: {
      "user-agent": BROWSER_UA,
      "accept-language": "de-DE,de;q=0.9,en;q=0.8",
      accept: "text/html",
    },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) return null;
  try {
    const scope = JSON.parse(m[1])?.__DEFAULT_SCOPE__;
    const item = scope?.["webapp.video-detail"]?.itemInfo?.itemStruct;
    if (!item) return null;
    return {
      desc: typeof item.desc === "string" ? item.desc : undefined,
      cover: item.video?.cover || item.video?.originCover,
    };
  } catch {
    return null;
  }
}

/**
 * Löst TikTok-Kurzlinks (vm.tiktok.com, vt.tiktok.com) sicher auf
 * und ermittelt die kanonische Video-URL.
 */
async function resolveTikTokUrl(initialUrl: string): Promise<string> {
  let currentUrl = initialUrl;
  let hops = 0;
  const maxHops = 4;

  while (hops < maxHops) {
    hops++;
    const res = await fetchWithTimeout(currentUrl, {
      method: "HEAD",
      redirect: "manual",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const nextUrl = new URL(location, currentUrl);
      // Sicherheit: Host muss tiktok.com sein
      if (nextUrl.hostname !== "tiktok.com" && !nextUrl.hostname.endsWith(".tiktok.com")) {
        throw new Error("Unerlaubtes Weiterleitungsziel");
      }
      currentUrl = nextUrl.toString();
    } else {
      break;
    }
  }

  return currentUrl;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  const parsed = parseSocialUrl(raw);
  if (!parsed || parsed.platform !== "tiktok") {
    return NextResponse.json({ ok: false, error: "invalid-url" }, { status: 400 });
  }

  try {
    let targetUrl = parsed.normalized;
    if (parsed.isShortlink) {
      targetUrl = await resolveTikTokUrl(parsed.normalized);
    }

    const { formatTikTokCaption } = await import("@/lib/tiktokFormat");
    let caption: string | undefined;
    let image: string | undefined;

    // 1. Seite: eingebettetes JSON enthält die volle Beschreibung
    try {
      const page = await fetchFromPage(targetUrl);
      if (page?.desc?.trim()) caption = formatTikTokCaption(page.desc.trim());
      image = page?.cover;
    } catch (e) {
      console.error("TikTok page error", e);
    }

    // 2. Fallback: oEmbed (liefert aktuell oft keinen title mehr)
    if (!caption || caption.length < 5) {
      try {
        const res = await fetchWithTimeout(
          `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`,
          { headers: { accept: "application/json" } },
        );
        if (res.ok) {
          const data = (await res.json()) as { title?: string; thumbnail_url?: string };
          if (data.title?.trim()) caption = formatTikTokCaption(data.title.trim());
          image = image ?? data.thumbnail_url;
        }
      } catch (e) {
        console.error("TikTok oembed error", e);
      }
    }

    if (!caption || caption.length < 5) {
      return NextResponse.json({ ok: false, source: "tiktok", resolvedUrl: targetUrl, image });
    }

    return NextResponse.json({
      ok: true,
      caption,
      image,
      source: "tiktok",
      resolvedUrl: targetUrl,
    });
  } catch (err) {
    console.error("TikTok oembed error", err);
    return NextResponse.json({ ok: false, source: "tiktok" });
  }
}
