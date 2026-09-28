import type { InputType } from "./types";

/**
 * Robust input type detection:
 * 1. Checks for URL: valid protocol (http/https), URL structure, no newlines
 * 2. Checks for HTML: DOCTYPE, HTML tags (<html, <body, <script, <div, etc.)
 * 3. Default: Plain-text / caption
 */
export function detectInputType(input: string): InputType {
  const trimmed = input.trim();
  if (!trimmed) {
    return "caption";
  }

  // 1. URL Check: Single line, http(s):// or recognizable URL structure
  if (!trimmed.includes("\n") && !trimmed.includes("\r")) {
    if (/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(trimmed)) {
      try {
        const url = new URL(trimmed);
        if (url.protocol === "http:" || url.protocol === "https:") {
          return "url";
        }
      } catch {
        // Not a valid URL
      }
    }
  }

  // 2. HTML Check: Contains HTML tags or doctype
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("<!doctype html") ||
    lower.startsWith("<html") ||
    /<(?:html|head|body|div|p|span|script|meta|link|article|main|section|ul|ol|h[1-6]|table)[>\s]/i.test(
      trimmed
    )
  ) {
    // If it has multiple tags or structural HTML markers
    const tagMatches = trimmed.match(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi);
    if (tagMatches && tagMatches.length >= 2) {
      return "html";
    }
    if (lower.startsWith("<!doctype") || lower.startsWith("<html")) {
      return "html";
    }
  }

  // 3. Fallback to Plain Text / Caption
  return "caption";
}
