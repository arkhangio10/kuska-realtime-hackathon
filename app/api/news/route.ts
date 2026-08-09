import { NextRequest, NextResponse } from "next/server";
import type { NewsArticle, NewsFeed } from "@/lib/news";

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
};

const hazardTerms: Record<string, string> = {
  flood: "(flood OR flooding)",
  earthquake: "(earthquake OR seismic)",
  cyclone: "(cyclone OR hurricane OR typhoon)",
  volcano: "(volcano OR eruption OR volcanic)",
  wildfire: "(wildfire OR forestfire)",
  drought: "(drought OR watershortage)",
  chemical: "(chemicalemergency OR contamination OR chemicalspill)",
  biological: "(biologicalemergency OR outbreak OR contamination)",
  radiological: "(radiologicalemergency OR radiation OR nuclearincident)",
  transport: "(transportaccident OR traincrash OR planecrash OR roadaccident)",
  other: "disaster",
};

const safeText = (value: string | null, max: number) => (value ?? "").replace(/[^\p{L}\p{N}\s.,'’()-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);
const safeUrl = (value?: string) => {
  try { const url = new URL(value ?? ""); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : ""; }
  catch { return ""; }
};
const gdeltDate = (value?: string) => {
  if (!value) return "";
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/);
  if (!match) return value;
  return new Date(Date.UTC(Number(match[1]), Number(match[2])-1, Number(match[3]), Number(match[4]??0), Number(match[5]??0), Number(match[6]??0))).toISOString();
};

export async function GET(request: NextRequest) {
  const country = safeText(request.nextUrl.searchParams.get("country"), 70);
  const hazard = safeText(request.nextUrl.searchParams.get("hazard"), 24).toLowerCase();
  const eventTitle = safeText(request.nextUrl.searchParams.get("title"), 90);
  if (!country) return NextResponse.json({ error: "country es obligatorio" }, { status: 400 });

  const properName = eventTitle.split(/\s+/).filter(word => word.length > 4 && !/^(flood|earthquake|eruption|emergency|accident|forest|drought)$/i.test(word)).slice(-2).join(" ");
  const query = `"${country}" ${hazardTerms[hazard] ?? hazardTerms.other}${properName ? ` "${properName}"` : ""}`;
  const endpoint = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("mode", "ArtList");
  endpoint.searchParams.set("maxrecords", "30");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("sort", "HybridRel");
  const searchUrl = new URL(endpoint); searchUrl.searchParams.delete("format");

  const base: Omit<NewsFeed, "articles" | "unavailable"> = { updatedAt: new Date().toISOString(), source: "GDELT DOC 2.0", searchUrl: searchUrl.toString() };
  try {
    const response = await fetch(endpoint, { next: { revalidate: 600 }, signal: AbortSignal.timeout(12000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`GDELT ${response.status}`);
    const body = await response.json() as { articles?: GdeltArticle[] };
    const seen = new Set<string>();
    const articles: NewsArticle[] = (body.articles ?? []).flatMap((article, index) => {
      const url = safeUrl(article.url), title = safeText(article.title ?? "", 220);
      const fingerprint = `${article.domain}:${title.toLowerCase()}`;
      if (!url || !title || seen.has(fingerprint)) return [];
      seen.add(fingerprint);
      return [{ id: `gdelt-${index}-${Buffer.from(url).toString("base64url").slice(0, 12)}`, title, url, domain: safeText(article.domain ?? new URL(url).hostname, 80), publishedAt: gdeltDate(article.seendate), imageUrl: safeUrl(article.socialimage) || undefined, language: safeText(article.language ?? "", 30) || undefined, sourceCountry: safeText(article.sourcecountry ?? "", 50) || undefined }];
    }).slice(0, 12);
    return NextResponse.json({ ...base, articles, unavailable: false } satisfies NewsFeed, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } });
  } catch (error) {
    console.error("GDELT news unavailable", error);
    return NextResponse.json({ ...base, articles: [], unavailable: true, note: "La cobertura periodística no está disponible temporalmente; el contexto oficial continúa visible." } satisfies NewsFeed, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } });
  }
}
