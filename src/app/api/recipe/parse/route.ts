import { NextResponse } from "next/server";
import { parse_recipe } from "@/parser/universal";
import { toWebRecipeResponse, type WebRecipeResponse } from "@/parser/universal/toWebRecipe";

/**
 * Importiert ein Rezept von einer beliebigen Webseite (serverseitig, SSRF-geschützt).
 * Instagram/TikTok laufen weiterhin über /api/instagram bzw. /api/tiktok.
 */
export async function POST(req: Request) {
  let url = "";
  try {
    const body = await req.json();
    url = typeof body.url === "string" ? body.url.trim().slice(0, 2000) : "";
  } catch {
    return NextResponse.json<WebRecipeResponse>({ status: "invalid_url" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json<WebRecipeResponse>({ status: "invalid_url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json<WebRecipeResponse>({ status: "invalid_url" }, { status: 400 });
  }

  try {
    const result = await parse_recipe(parsed.toString());
    if (result.status !== "success") {
      console.warn("Rezeptseite nicht importierbar", parsed.hostname, result.status, result.error);
    }
    return NextResponse.json(toWebRecipeResponse(result, parsed.toString()));
  } catch (e) {
    console.error("Rezeptimport fehlgeschlagen", parsed.hostname, e);
    return NextResponse.json<WebRecipeResponse>({ status: "fetch_error" }, { status: 502 });
  }
}
