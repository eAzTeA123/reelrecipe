export type SocialPlatform = "instagram" | "tiktok";

export interface ParsedSocialUrl {
  platform: SocialPlatform;
  normalized: string;
  id: string;
  isShortlink?: boolean;
}

const IG_PATH = /^\/(?:[A-Za-z0-9_.-]+\/)?(reel|reels|p|tv)\/([A-Za-z0-9_-]{5,30})\/?/;
const TIKTOK_VIDEO_PATH = /^\/@([^/]+)\/(?:video|photo)\/(\d{15,25})\/?/;
const TIKTOK_SHORT_PATH = /^\/(t\/[A-Za-z0-9_-]{5,25}|[A-Za-z0-9_-]{5,25})\/?/;

/**
 * Validiert und normalisiert Instagram- oder TikTok-Links.
 * Erkennt Kurzlinks (vm.tiktok.com, vt.tiktok.com) und Standard-Links.
 */
export function parseSocialUrl(input: string): ParsedSocialUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();

  // 1. Instagram
  if (host === "instagram.com" || host === "www.instagram.com" || host === "m.instagram.com") {
    const match = url.pathname.match(IG_PATH);
    if (match) {
      return {
        platform: "instagram",
        normalized: `https://www.instagram.com/${match[1]}/${match[2]}/`,
        id: match[2],
      };
    }
  }

  // 2. TikTok
  if (
    host === "tiktok.com" ||
    host === "www.tiktok.com" ||
    host === "m.tiktok.com"
  ) {
    const videoMatch = url.pathname.match(TIKTOK_VIDEO_PATH);
    if (videoMatch) {
      return {
        platform: "tiktok",
        normalized: `https://www.tiktok.com/@${videoMatch[1]}/video/${videoMatch[2]}`,
        id: videoMatch[2],
      };
    }
    const shortMatch = url.pathname.match(TIKTOK_SHORT_PATH);
    if (shortMatch) {
      return {
        platform: "tiktok",
        normalized: `https://www.tiktok.com${url.pathname}`,
        id: shortMatch[1],
        isShortlink: true,
      };
    }
  }

  // 3. TikTok Shortlinks (vm.tiktok.com / vt.tiktok.com)
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    const code = url.pathname.replace(/^\//, "").split("/")[0];
    if (code) {
      return {
        platform: "tiktok",
        normalized: `https://${host}/${code}`,
        id: code,
        isShortlink: true,
      };
    }
  }

  return null;
}

/**
 * Sucht in einem beliebigen Text (z. B. aus Zwischenablage oder Share-Text)
 * nach genau einem unterstützten Social-Link.
 */
export function extractSocialUrlFromText(text: string): ParsedSocialUrl | null {
  const words = text.trim().split(/\s+/);
  const found: ParsedSocialUrl[] = [];
  for (const word of words) {
    const parsed = parseSocialUrl(word);
    if (parsed) found.push(parsed);
  }
  return found.length === 1 ? found[0] : null;
}
