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
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) {
      return NextResponse.json({ error: "not-an-image" }, { status: 502 });
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "too-large" }, { status: 502 });
    }
    return new NextResponse(buf, {
      headers: {
        "content-type": res.headers.get("content-type")!,
        "cache-control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "fetch-failed" }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
