import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = /\.(cdninstagram\.com|fbcdn\.net|tiktokcdn\.com|tiktokcdn-eu\.com|tiktokcdn-us\.com)$/;
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 8000;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid-url" }, { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.test(url.hostname)) {
    return NextResponse.json({ error: "host-not-allowed" }, { status: 403 });
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal });
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.startsWith("image/")) {
      return NextResponse.json({ error: "not-an-image" }, { status: 502 });
    }
    if (contentType.includes("svg")) {
      return NextResponse.json({ error: "svg-not-allowed" }, { status: 400 });
    }
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
      return NextResponse.json({ error: "too-large" }, { status: 502 });
    }
    if (!res.body) {
      return NextResponse.json({ error: "empty-body" }, { status: 502 });
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytesRead = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        bytesRead += value.byteLength;
        if (bytesRead > MAX_BYTES) {
          return NextResponse.json({ error: "too-large" }, { status: 502 });
        }
        chunks.push(value);
      }
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
    const buf = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      buf.set(chunk, offset);
      offset += chunk.byteLength;
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
    clearTimeout(t);
  }
}
