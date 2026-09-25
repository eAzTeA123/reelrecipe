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
      if (!nextUrl.hostname.includes("tiktok.com")) {
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

    // TikTok offizielle oEmbed API
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetchWithTimeout(oembedUrl, {
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        source: "tiktok",
        resolvedUrl: targetUrl,
      });
    }

    const data = (await res.json()) as {
      title?: string;
      thumbnail_url?: string;
      author_name?: string;
    };

    let caption = data.title?.trim();
    if (caption) {
      const { formatTikTokCaption } = await import("@/lib/tiktokFormat");
      caption = formatTikTokCaption(caption);
    }
    if (!caption || caption.length < 5) {
      return NextResponse.json({
        ok: false,
        source: "tiktok",
        resolvedUrl: targetUrl,
        image: data.thumbnail_url,
      });
    }

    return NextResponse.json({
      ok: true,
      caption,
      image: data.thumbnail_url,
      source: "tiktok",
      resolvedUrl: targetUrl,
    });
  } catch (err) {
    console.error("TikTok oembed error", err);
    return NextResponse.json({ ok: false, source: "tiktok" });
  }
}
