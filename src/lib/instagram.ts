const IG_PATH = /^\/(reel|reels|p|tv)\/([A-Za-z0-9_-]{5,20})\/?/;

export interface ParsedInstagramUrl {
  normalized: string;
  shortcode: string;
}

/** Validiert und normalisiert einen Instagram-Reel/Post-Link. */
export function parseInstagramUrl(input: string): ParsedInstagramUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (
    host !== "instagram.com" &&
    host !== "www.instagram.com" &&
    host !== "m.instagram.com"
  ) {
    return null;
  }
  const match = url.pathname.match(IG_PATH);
  if (!match) return null;
  return {
    normalized: `https://www.instagram.com/${match[1]}/${match[2]}/`,
    shortcode: match[2],
  };
}
