import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/products/sources";
import { MATCH_THRESHOLD, scoreProductName, searchTermFor } from "@/lib/products/matching";

export async function POST(req: Request) {
  let query = "";
  try {
    const body = await req.json();
    query = typeof body.query === "string" ? body.query.trim().slice(0, 120) : "";
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const term = searchTermFor(query);
  if (!term) return NextResponse.json({ products: [] });
  try {
    const products = (await searchProducts(term))
      .map((p) => ({ ...p, matchConfidence: scoreProductName(query, p.name) }))
      .filter((p) => p.matchConfidence >= MATCH_THRESHOLD);
    return NextResponse.json({ products });
  } catch (e) {
    console.error("Produktsuche fehlgeschlagen", e);
    return NextResponse.json({ error: "search_failed" }, { status: 502 });
  }
}
