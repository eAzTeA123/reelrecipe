import * as cheerio from "cheerio";

/**
 * Extracts visible main content text from an HTML document.
 * Removes non-content elements:
 * - <script>, <style>, <noscript>, <svg>, <canvas>, <iframe>
 * - Navigation, footer, header, cookie banners, ads, sidebars, comments
 * Formats lists and paragraphs with line breaks so that caption parser heuristics can segment them.
 */
export function extractVisibleText(html: string): string {
  const $ = cheerio.load(html);

  // 1. Remove obvious boilerplate and non-content elements
  $(
    "script, style, noscript, svg, canvas, iframe, link, meta, " +
    "nav, footer, header, aside, dialog, " +
    '[role="dialog"], [role="navigation"], [role="banner"], [role="contentinfo"], ' +
    ".cookie, .cookies, .consent, .banner, .modal, .popup, " +
    ".ad, .advertisement, .sidebar, .comments, .social-share, .newsletter"
  ).remove();

  // 2. Identify the main container if available
  const candidates = $("main, article, .recipe, [itemprop='recipe'], .recipe-content, #recipe, .post-content");
  const target = candidates.length > 0 ? candidates.first() : $("body");

  // 3. Convert block elements to have explicit line breaks
  target.find("p, div, li, tr, h1, h2, h3, h4, h5, h6, br, hr").each((_, el) => {
    $(el).prepend("\n");
    $(el).append("\n");
  });

  const rawText = target.length > 0 ? target.text() : $.root().text();

  // 4. Normalize whitespace: reduce multiple empty lines to double newline, collapse horizontal spaces
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.join("\n");
}
