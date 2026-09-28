import type { WebRecipeResponse, WebRecipeStatus } from "@/parser/universal/toWebRecipe";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { compressImage } from "@/lib/image";

export type { WebRecipeResponse, WebRecipeStatus };

/** Ruft ein Rezept von einer beliebigen Webseite über den Server ab */
export async function fetchWebRecipe(url: string, signal?: AbortSignal): Promise<WebRecipeResponse> {
  try {
    const res = await fetch("/api/recipe/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal,
    });
    const data = (await res.json()) as WebRecipeResponse;
    return data?.status ? data : { status: "fetch_error" };
  } catch (e) {
    if (signal?.aborted) throw e;
    console.warn("Webimport fehlgeschlagen", e);
    return { status: "fetch_error" };
  }
}

/** Lädt ein Vorschaubild über den passenden Proxy und komprimiert es */
export async function fetchRecipeImage(imageUrl: string, kind: "social" | "web"): Promise<Blob | undefined> {
  const proxy = kind === "social" ? "/api/instagram/image" : "/api/recipe/image";
  try {
    const res = await fetch(`${proxy}?url=${encodeURIComponent(imageUrl)}`);
    if (!res.ok) return undefined;
    return await compressImage(await res.blob());
  } catch (e) {
    console.warn("Rezeptbild konnte nicht geladen werden", e);
    return undefined;
  }
}

export const WEB_STATUS_MESSAGE: Record<Exclude<WebRecipeStatus, "success">, TranslationKey> = {
  login_required: "import.status.loginRequired",
  paywall: "import.status.paywall",
  blocked: "import.status.blocked",
  not_a_recipe: "import.status.notARecipe",
  fetch_error: "import.status.fetchError",
  invalid_url: "import.status.invalidUrl",
};
