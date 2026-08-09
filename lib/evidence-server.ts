import type { BridgeRequest } from "./kuska";
import { evidenceId, type EvidenceBundle, type EvidenceItem } from "./evidence";
import type { NewsArticle } from "./news";

type EvidenceCase = BridgeRequest["caseStudy"];

const DAY = 86_400_000;
const safeDate = (value: unknown) => {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
};
const freshness = (value: string): EvidenceItem["freshness"] => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "unknown";
  if (timestamp >= Date.now() - 2 * DAY) return "live";
  if (timestamp >= Date.now() - 45 * DAY) return "recent";
  return "historical";
};
const safeUrl = (value: unknown, fallback: string) => {
  try {
    const url = new URL(String(value ?? ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : fallback;
  } catch { return fallback; }
};
const clean = (value: unknown, max = 500) => String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const radians = (value: number) => value * Math.PI / 180;
function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = radians(bLat - aLat), dLon = radians(bLon - aLon);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function baseEvidence(caseStudy: EvidenceCase, news: NewsArticle[]) {
  const observedAt = safeDate(caseStudy.lastActivityAt || caseStudy.eventDate);
  const items: EvidenceItem[] = [{
    id: evidenceId("official", `${caseStudy.id}:${caseStudy.details}`), kind: "official", title: caseStudy.eventTitle,
    fact: clean(caseStudy.details), source: caseStudy.source, sourceUrl: caseStudy.eventUrl, observedAt,
    reliability: "high", freshness: caseStudy.dataState === "live" ? "live" : freshness(observedAt), geography: `${caseStudy.location}, ${caseStudy.country}`,
  }];
  for (const metric of caseStudy.metrics.slice(0, 12)) {
    items.push({
      id: evidenceId("metric", `${caseStudy.id}:${metric.label}:${metric.value}`), kind: "official", title: metric.label,
      fact: `${metric.label}: ${metric.value}.`, source: caseStudy.source, sourceUrl: caseStudy.eventUrl, observedAt,
      reliability: "high", freshness: caseStudy.dataState === "live" ? "live" : freshness(observedAt), geography: `${caseStudy.location}, ${caseStudy.country}`,
    });
  }
  for (const article of news.slice(0, 8)) {
    items.push({
      id: evidenceId("media", article.url), kind: "media", title: article.title, fact: article.title,
      source: article.domain, sourceUrl: article.url, observedAt: safeDate(article.publishedAt), reliability: "low",
      freshness: freshness(article.publishedAt), geography: caseStudy.country,
    });
  }
  return items;
}

async function usgsEvidence(caseStudy: EvidenceCase): Promise<EvidenceItem[]> {
  if (caseStudy.hazardKind !== "earthquake") return [];
  const end = Date.now();
  const eventTime = Date.parse(caseStudy.eventDate || caseStudy.lastActivityAt);
  const center = Number.isFinite(eventTime) ? eventTime : end;
  const endpoint = new URL("https://earthquake.usgs.gov/fdsnws/event/1/query");
  endpoint.searchParams.set("format", "geojson");
  endpoint.searchParams.set("latitude", String(caseStudy.lat)); endpoint.searchParams.set("longitude", String(caseStudy.lon));
  endpoint.searchParams.set("maxradiuskm", "500"); endpoint.searchParams.set("minmagnitude", "3.5"); endpoint.searchParams.set("limit", "8");
  endpoint.searchParams.set("starttime", new Date(center - 10 * DAY).toISOString()); endpoint.searchParams.set("endtime", new Date(Math.min(end + DAY, center + 10 * DAY)).toISOString());
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(9000), next: { revalidate: 900 } });
  if (!response.ok) throw new Error(`USGS ${response.status}`);
  const body = await response.json() as { features?: Array<{ id?: string; properties?: { mag?: number; place?: string; time?: number; url?: string; title?: string } }> };
  return (body.features ?? []).slice(0, 3).map(feature => {
    const at = feature.properties?.time ? new Date(feature.properties.time).toISOString() : "";
    const magnitude = Number(feature.properties?.mag ?? 0);
    return {
      id: evidenceId("usgs", feature.id ?? `${at}:${magnitude}`), kind: "official" as const, title: clean(feature.properties?.title || "Sismo registrado por USGS", 180),
      fact: `Magnitud ${magnitude.toFixed(1)}; ${clean(feature.properties?.place || "ubicación reportada por USGS", 180)}.`, source: "USGS",
      sourceUrl: safeUrl(feature.properties?.url, "https://earthquake.usgs.gov/earthquakes/map/"), observedAt: at, reliability: "high" as const,
      freshness: freshness(at), geography: clean(feature.properties?.place || caseStudy.country, 140),
    };
  });
}

const eonetCategory: Record<string, string> = { wildfire: "wildfires", volcano: "volcanoes", cyclone: "severeStorms", flood: "floods", drought: "drought", earthquake: "earthquakes" };
async function eonetEvidence(caseStudy: EvidenceCase): Promise<EvidenceItem[]> {
  const category = eonetCategory[caseStudy.hazardKind];
  if (!category) return [];
  const endpoint = new URL("https://eonet.gsfc.nasa.gov/api/v3/events");
  endpoint.searchParams.set("category", category); endpoint.searchParams.set("status", "all"); endpoint.searchParams.set("days", "90"); endpoint.searchParams.set("limit", "80");
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(9000), next: { revalidate: 1800 } });
  if (!response.ok) throw new Error(`EONET ${response.status}`);
  const body = await response.json() as { events?: Array<{ id?: string; title?: string; link?: string; geometry?: Array<{ date?: string; coordinates?: unknown }> }> };
  return (body.events ?? []).flatMap(event => {
    const geometry = event.geometry?.at(-1), coordinates = geometry?.coordinates;
    if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") return [];
    const km = distanceKm(caseStudy.lat, caseStudy.lon, coordinates[1], coordinates[0]);
    if (km > 900) return [];
    const at = safeDate(geometry?.date);
    return [{
      id: evidenceId("eonet", event.id ?? `${event.title}:${at}`), kind: "official" as const, title: clean(event.title || "Evento NASA EONET", 180),
      fact: `NASA EONET ubica este evento aproximadamente a ${Math.round(km)} km del caso seleccionado.`, source: "NASA EONET",
      sourceUrl: safeUrl(event.link, "https://eonet.gsfc.nasa.gov/"), observedAt: at, reliability: "high" as const, freshness: freshness(at), geography: `${coordinates[1].toFixed(2)}, ${coordinates[0].toFixed(2)}`,
    }];
  }).sort((a, b) => a.fact.localeCompare(b.fact)).slice(0, 3);
}

async function firmsEvidence(caseStudy: EvidenceCase): Promise<EvidenceItem[]> {
  const key = process.env.NASA_FIRMS_MAP_KEY?.trim();
  if (caseStudy.hazardKind !== "wildfire" || !key) return [];
  const delta = 2.5, area = [caseStudy.lon - delta, caseStudy.lat - delta, caseStudy.lon + delta, caseStudy.lat + delta].join(",");
  const endpoint = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/VIIRS_SNPP_NRT/${area}/2`;
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(10000), next: { revalidate: 900 } });
  if (!response.ok) throw new Error(`FIRMS ${response.status}`);
  const csv = await response.text(), rows = csv.trim().split(/\r?\n/);
  if (rows.length < 2) return [];
  const headers = rows[0].split(","), dateIndex = headers.indexOf("acq_date"), timeIndex = headers.indexOf("acq_time");
  const latest = rows.slice(1).map(row => row.split(",")).sort((a, b) => `${b[dateIndex]}${b[timeIndex]}`.localeCompare(`${a[dateIndex]}${a[timeIndex]}`))[0];
  const at = latest?.[dateIndex] ? safeDate(`${latest[dateIndex]}T${String(latest[timeIndex] ?? "0000").padStart(4, "0").replace(/(..)(..)/, "$1:$2")}:00Z`) : "";
  return [{ id: evidenceId("firms", `${caseStudy.id}:${rows.length - 1}:${at}`), kind: "official", title: "Detecciones térmicas satelitales", fact: `NASA FIRMS registró ${rows.length - 1} detecciones térmicas en el área aproximada durante los últimos 2 días.`, source: "NASA FIRMS", sourceUrl: "https://firms.modaps.eosdis.nasa.gov/map/", observedAt: at, reliability: "high", freshness: freshness(at), geography: `Radio aproximado de ${Math.round(delta * 111)} km` }];
}

async function reliefWebEvidence(caseStudy: EvidenceCase): Promise<EvidenceItem[]> {
  const appname = process.env.RELIEFWEB_APPNAME?.trim();
  if (!appname) return [];
  const endpoint = new URL("https://api.reliefweb.int/v2/reports");
  endpoint.searchParams.set("appname", appname); endpoint.searchParams.set("profile", "list"); endpoint.searchParams.set("preset", "latest"); endpoint.searchParams.set("limit", "5");
  endpoint.searchParams.set("query[value]", `${caseStudy.country} ${caseStudy.hazardLabel}`);
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(10000), next: { revalidate: 1800 } });
  if (!response.ok) throw new Error(`ReliefWeb ${response.status}`);
  const body = await response.json() as { data?: Array<{ id?: number; fields?: { title?: string; date?: { created?: string }; url_alias?: string; source?: Array<{ name?: string }> } }> };
  return (body.data ?? []).map(report => {
    const fields = report.fields ?? {}, at = safeDate(fields.date?.created);
    return { id: evidenceId("reliefweb", String(report.id ?? fields.title)), kind: "humanitarian" as const, title: clean(fields.title || "Informe humanitario", 180), fact: clean(fields.title || "Informe humanitario relacionado", 400), source: clean(fields.source?.[0]?.name || "ReliefWeb", 100), sourceUrl: safeUrl(fields.url_alias, "https://reliefweb.int/"), observedAt: at, reliability: "medium" as const, freshness: freshness(at), geography: caseStudy.country };
  });
}

export async function buildEvidenceBundle(caseStudy: EvidenceCase, news: NewsArticle[]): Promise<EvidenceBundle> {
  const items = baseEvidence(caseStudy, news);
  const unavailableSources: string[] = [];
  const adapters = [
    { name: "USGS", run: () => usgsEvidence(caseStudy) },
    { name: "NASA EONET", run: () => eonetEvidence(caseStudy) },
    { name: "NASA FIRMS", optional: !process.env.NASA_FIRMS_MAP_KEY, run: () => firmsEvidence(caseStudy) },
    { name: "ReliefWeb", optional: !process.env.RELIEFWEB_APPNAME, run: () => reliefWebEvidence(caseStudy) },
  ];
  const results = await Promise.allSettled(adapters.map(adapter => adapter.run()));
  results.forEach((result, index) => {
    if (result.status === "fulfilled") items.push(...result.value);
    else if (!adapters[index].optional) unavailableSources.push(adapters[index].name);
  });
  if (!process.env.NASA_FIRMS_MAP_KEY && caseStudy.hazardKind === "wildfire") unavailableSources.push("NASA FIRMS (falta NASA_FIRMS_MAP_KEY)");
  if (!process.env.RELIEFWEB_APPNAME) unavailableSources.push("ReliefWeb (falta RELIEFWEB_APPNAME)");
  const seen = new Set<string>();
  const deduped = items.filter(item => !seen.has(item.id) && seen.add(item.id)).slice(0, 30);
  const unknowns = ["Responsables locales y capacidad operativa confirmada", "Estado de rutas, refugios y servicios críticos en el terreno"];
  if (!deduped.some(item => item.kind === "humanitarian")) unknowns.push("Evaluación humanitaria independiente del impacto");
  if (!deduped.some(item => item.kind === "media")) unknowns.push("Contexto periodístico reciente suficientemente relacionado");
  return { caseId: caseStudy.id, generatedAt: new Date().toISOString(), items: deduped, unknowns, unavailableSources };
}
