import { NextRequest, NextResponse } from "next/server";
import { validateUrlForSSRF } from "@/parser/universal/fetcher";

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

/**
 * Bild-Proxy für Rezeptbilder beliebiger Webseiten. Jede Adresse (auch nach
 * Weiterleitungen) wird gegen interne/private Ziele geprüft; nur Rasterbilder.
 */
export async function GET(req: NextRequest) {
  let current = req.nextUrl.searchParams.get("url") ?? "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res: Response | undefined;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      try {
        await validateUrlForSSRF(current);
      } catch {
        return NextResponse.json({ error: "host-not-allowed" }, { status: 403 });
      }
      res = await fetch(current, {
        signal: ctrl.signal,
        redirect: "manual",
        headers: { "User-Agent": "ReelRecipe/0.1 (Rezeptbild)", Accept: "image/avif,image/webp,image/*" },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) break;
        current = new URL(location, current).toString();
        res = undefined;
        continue;
      }
      break;
    }
    if (!res) return NextResponse.json({ error: "too-many-redirects" }, { status: 502 });

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.startsWith("image/") || contentType.includes("svg")) {
      return NextResponse.json({ error: "not-an-image" }, { status: 502 });
    }
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
      return NextResponse.json({ error: "too-large" }, { status: 502 });
    }
    if (!res.body) return NextResponse.json({ error: "empty-body" }, { status: 502 });

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "too-large" }, { status: 502 });
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      buf.set(c, offset);
      offset += c.byteLength;
    }
    return new NextResponse(buf, {
      headers: {
        "content-type": contentType,
        "cache-control": "private, max-age=300",
        "content-security-policy": "default-src 'none'",
      },
    });
  } catch {
    return NextResponse.json({ error: "fetch-failed" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
