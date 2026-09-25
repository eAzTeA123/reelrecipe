import { NextRequest, NextResponse } from "next/server";

const IG_PATH = /^\/(reel|reels|p|tv)\/([A-Za-z0-9_-]{5,20})\/?/;
const TIMEOUT_MS = 6000;

function validInstagramUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== "instagram.com" && host !== "www.instagram.com" && host !== "m.instagram.com") {
    return null;
  }
  if (!IG_PATH.test(url.pathname)) return null;
  return url;
}

function extractMeta(html: string, property: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
    "i",
  );
  const m = html.match(re) ?? html.match(re2);
  if (!m) return undefined;
  return decodeEntities(m[1]);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(parseInt(n, 10));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      try {
        return String.fromCodePoint(parseInt(n, 16));
      } catch {
        return _;
      }
    });
}

/**
 * og:description hat typischerweise die Form:
 * "1,234 likes, 56 comments - user on January 1, 2025: "CAPTION"."
 * bzw. deutsch: "Gefällt 1.234 Mal, 56 Kommentare – user am 1. Januar 2025: "CAPTION"."
 */
function extractCaption(og: string): string | undefined {
  const m = og.match(/:\s*[„"“]([\s\S]+)[”"„]\.?\s*$/) ?? og.match(/:\s*([\s\S]{10,})$/);
  if (m && m[1]) return m[1].trim();
  // Fallback: nach dem ersten ": " alles verwenden
  const idx = og.indexOf(":");
  if (idx > 0 && og.length - idx > 10) return og.slice(idx + 1).trim().replace(/^["„“]|[”"„]\.?$/g, "");
  return undefined;
}

interface Result {
  ok: boolean;
  caption?: string | null;
  image?: string;
  source: "meta-tags" | "oembed";
  error?: string;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function viaOEmbed(url: URL): Promise<Result> {
  const token = process.env.INSTAGRAM_OEMBED_TOKEN;
  if (!token) return { ok: false, source: "oembed" };
  try {
    const res = await fetchWithTimeout(
      `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url.toString())}&access_token=${encodeURIComponent(token)}&omitscript=true`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return { ok: false, source: "oembed" };
    const data = (await res.json()) as { html?: string; thumbnail_url?: string };
    // oEmbed liefert HTML, nicht die Caption direkt – Caption steckt im Blockquote
    const caption = data.html
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      ok: !!caption,
      caption: caption || undefined,
      image: data.thumbnail_url,
      source: "oembed",
    };
  } catch {
    return { ok: false, source: "oembed" };
  }
}

async function viaMetaTags(url: URL): Promise<Result> {
  try {
    const res = await fetchWithTimeout(url.toString(), {
      headers: {
        // normaler Browser-UA, keine Cookies, kein Login
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "de-DE,de;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, source: "meta-tags" };
    const html = await res.text();
    const ogDesc = extractMeta(html, "og:description");
    if (res.url.includes("/accounts/login") || (ogDesc && ogDesc.includes("Instagram"))) {
      return { ok: false, error: "login-wall", caption: null, source: "meta-tags" };
    }
    const ogImage = extractMeta(html, "og:image");
    if (!ogDesc) return { ok: false, source: "meta-tags", image: ogImage };
    const caption = extractCaption(ogDesc) ?? ogDesc;
    if (!caption || caption.length < 5) return { ok: false, source: "meta-tags", image: ogImage };
    return { ok: true, caption, image: ogImage, source: "meta-tags" };
  } catch {
    return { ok: false, source: "meta-tags" };
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  const url = validInstagramUrl(raw);
  if (!url) {
    return NextResponse.json({ ok: false, error: "invalid-url" }, { status: 400 });
  }

  // Offizielles oEmbed bevorzugen, falls Token konfiguriert
  const oembed = await viaOEmbed(url);
  if (oembed.ok) return NextResponse.json(oembed);

  const meta = await viaMetaTags(url);
  return NextResponse.json(meta);
}
