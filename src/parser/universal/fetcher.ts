import dns from "node:dns/promises";
import net from "node:net";

export interface FetchHtmlOptions {
  timeoutMs?: number;
  maxSizeBytes?: number;
  userAgent?: string;
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Scroll2Cook/1.0";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Checks whether an IP address is private, loopback, or reserved (SSRF protection).
 */
export function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) return false;

  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 100.64.0.0/10 (carrier-grade NAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 192.0.0.0/24, 192.0.2.0/24 (documentation)
    if (parts[0] === 192 && parts[1] === 0) return true;
    // 198.18.0.0/15 (benchmarking)
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
    // 198.51.100.0/24, 203.0.113.0/24
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
    // 224.0.0.0/4 (multicast) & 240.0.0.0/4 (reserved)
    if (parts[0] >= 224) return true;
    return false;
  }

  // IPv6 checks
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::" || lower.startsWith("fe80:") || lower.startsWith("fc00:") || lower.startsWith("fd00:")) {
    return true;
  }
  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.substring(7);
    return isPrivateIp(v4);
  }

  return false;
}

/**
 * Validates target URL against SSRF rules:
 * - protocol must be http or https
 * - hostname must not be localhost, .local, .internal, etc.
 * - resolves DNS and checks IP against private IP ranges
 */
export async function validateUrlForSSRF(urlStr: string): Promise<URL> {
  const parsed = new URL(urlStr);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Ungültiges Protokoll: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    throw new Error(`Zugriff auf interne Hostnamen blockiert: ${hostname}`);
  }

  // If hostname is directly an IP
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`Zugriff auf private IP-Adresse blockiert: ${hostname}`);
    }
  } else {
    // Resolve DNS
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const addr of addresses) {
        if (isPrivateIp(addr.address)) {
          throw new Error(`Hostname ${hostname} löst zu privater IP auf: ${addr.address}`);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("löst zu privater IP auf")) {
        throw err;
      }
      // DNS lookup failure can happen, let fetch handle or throw structured error
    }
  }

  return parsed;
}

/**
 * Fetches HTML from a remote URL securely:
 *
 * Hinweis: DNS-Rebinding kann mit standard-`fetch()` nicht vollständig
 * verhindert werden, weil der Hostname zwischen DNS-Prüfung und der tatsächlichen
 * Verbindung neu aufgelöst wird. Dieser Code prüft Hostname und DNS-Auflösung
 * vor jedem Request und jeder Weiterleitung und blockiert private Adressen.
 * Für eine öffentliche Bereitstellung sollte man auf einen externen Proxy oder
 * http/https mit gepinnter IP-Adresse umsteigen.
 * - SSRF checks before each request and redirect
 * - AbortController timeout
 * - Max size limit with streaming chunk checks
 * - Content-Type validation
 */
export async function fetchHtmlSafely(
  urlStr: string,
  options: FetchHtmlOptions = {}
): Promise<{ html: string; finalUrl: string }> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  let currentUrl = urlStr;
  let redirectsRemaining = 5;

  while (redirectsRemaining >= 0) {
    await validateUrlForSSRF(currentUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
        },
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Timeout beim Abrufen der URL nach ${timeoutMs}ms: ${currentUrl}`);
      }
      throw new Error(`Netzwerkfehler beim Abrufen von ${currentUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Handle Redirects
    if (res.status >= 300 && res.status < 400) {
      clearTimeout(timer);
      const location = res.headers.get("location");
      if (!location) {
        throw new Error(`Redirect ohne Location Header von ${currentUrl}`);
      }
      const nextUrl = new URL(location, currentUrl).toString();
      currentUrl = nextUrl;
      redirectsRemaining--;
      continue;
    }

    if (!res.ok) {
      clearTimeout(timer);
      throw new Error(`HTTP-Fehler ${res.status} (${res.statusText}) beim Abrufen von ${currentUrl}`);
    }

    // Check Content-Type
    const contentType = res.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml") &&
      !contentType.includes("text/plain")
    ) {
      clearTimeout(timer);
      throw new Error(`Unerwarteter Content-Type: ${contentType}. Erwartet wurde HTML.`);
    }

    // Stream and check maxSizeBytes
    try {
      if (!res.body) {
        const text = await res.text();
        clearTimeout(timer);
        return { html: text, finalUrl: currentUrl };
      }

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.length;
          if (totalBytes > maxSizeBytes) {
            reader.cancel();
            throw new Error(`HTML-Größe überschreitet maximales Limit von ${maxSizeBytes} Bytes`);
          }
          chunks.push(value);
        }
      }

      clearTimeout(timer);
      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const decoder = new TextDecoder("utf-8");
      const html = decoder.decode(combined);
      return { html, finalUrl: currentUrl };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  throw new Error("Zu viele Weiterleitungen (Redirect loop)");
}
