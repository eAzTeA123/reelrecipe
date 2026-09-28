import type { ParseRecipeStatus } from "./types";

export interface PageBlockCheckResult {
  isBlocked: boolean;
  status: ParseRecipeStatus;
  reason?: string;
}

/**
 * Detects whether an HTML page is a login, paywall, captcha, access-blocked,
 * or empty shell page without genuine recipe content.
 */
export function detectBlockedPage(html: string): PageBlockCheckResult {
  const trimmed = html.trim();

  // 1. Check for empty or near-empty HTML shell
  if (trimmed.length < 50) {
    return {
      isBlocked: true,
      status: "not_a_recipe",
      reason: "HTML-Inhalt ist leer oder zu kurz (< 50 Zeichen).",
    };
  }

  const lower = trimmed.toLowerCase();

  // 2. Cloudflare / Bot Challenge / Captcha
  if (
    lower.includes("cf-browser-verification") ||
    lower.includes("challenge-running") ||
    lower.includes("just a moment...") ||
    lower.includes("attention required! | cloudflare") ||
    lower.includes("recaptcha") ||
    lower.includes("hcaptcha") ||
    lower.includes("bot-detection") ||
    lower.includes("access denied") ||
    lower.includes("403 forbidden") ||
    lower.includes("zugriff verweigert")
  ) {
    // Verify it's really an interstitial and not a recipe with a recaptcha in comments
    if (
      !lower.includes("recipeingredient") &&
      !lower.includes("recipeinstructions") &&
      (lower.includes("cf-browser-verification") ||
        lower.includes("challenge-running") ||
        lower.includes("just a moment...") ||
        lower.includes("access denied"))
    ) {
      return {
        isBlocked: true,
        status: "blocked",
        reason: "Bot-Schutz / Challenge-Seite oder Zugriff verweigert.",
      };
    }
  }

  // 3. Login / Registration required
  if (
    (lower.includes("login erforderlich") ||
      lower.includes("anmeldung erforderlich") ||
      lower.includes("please sign in to view") ||
      lower.includes("sign in to access") ||
      lower.includes("log in to your account")) &&
    !lower.includes("recipeingredient") &&
    !lower.includes("recipeinstructions")
  ) {
    return {
      isBlocked: true,
      status: "login_required",
      reason: "Login oder Anmeldung erforderlich.",
    };
  }

  // 4. Paywall
  if (
    (lower.includes("dieser inhalt ist nur für abonnenten") ||
      lower.includes("exklusiv für abonnenten") ||
      lower.includes("subscription required") ||
      lower.includes("nur mit plus-abo") ||
      lower.includes("paywall")) &&
    !lower.includes("recipeingredient") &&
    !lower.includes("recipeinstructions")
  ) {
    return {
      isBlocked: true,
      status: "paywall",
      reason: "Paywall / Abonnement erforderlich.",
    };
  }

  // 5. Explicit error pages (404 Not Found, 500 Internal Error)
  if (
    (lower.includes("<title>404") ||
      lower.includes("seite nicht gefunden") ||
      lower.includes("page not found") ||
      lower.includes("500 internal server error")) &&
    !lower.includes("recipeingredient") &&
    !lower.includes("recipeinstructions")
  ) {
    return {
      isBlocked: true,
      status: "not_a_recipe",
      reason: "Fehlerseite / Seite nicht gefunden.",
    };
  }

  return {
    isBlocked: false,
    status: "success",
  };
}
