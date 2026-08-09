import { NextResponse } from "next/server";
import type { AlertSeverity } from "@/lib/alerts";
import { EMPTY_VISUAL, PIURA_CASE, type CaseMetric, type CaseStudy, type HazardKind, type HazardOrigin, type HazardVisual } from "@/lib/cases";

type GdacsFeature = { geometry?: { type?: string; coordinates?: number[] }; properties?: Record<string, unknown> };
type IfrcCountry = { id?: number; iso?: string; iso3?: string; name?: string; centroid?: { coordinates?: number[] } };
type IfrcEvent = { id?: number; name?: string; summary?: string; dtype?: { id?: number; name?: string }; countries?: IfrcCountry[]; num_affected?: number | null; ifrc_severity_level_display?: string; disaster_start_date?: string; created_at?: string; updated_at?: string; field_reports?: Array<{report_date?: string}> };

const gdacsFeeds: Array<{ code: string; kind: HazardKind; label: string }> = [
  { code: "FL", kind: "flood", label: "Inundación" },
  { code: "EQ", kind: "earthquake", label: "Sismo" },
  { code: "TC", kind: "cyclone", label: "Ciclón tropical" },
  { code: "VO", kind: "volcano", label: "Erupción volcánica" },
  { code: "WF", kind: "wildfire", label: "Incendio forestal" },
  { code: "DR", kind: "drought", label: "Sequía" },
];

const ifrcTypes: Array<{ id: number; kind: HazardKind; label: string; origin: HazardOrigin }> = [
  { id: 57, kind: "chemical", label: "Emergencia química", origin: "human" },
  { id: 67, kind: "radiological", label: "Emergencia radiológica", origin: "human" },
  { id: 54, kind: "transport", label: "Accidente de transporte", origin: "human" },
  { id: 68, kind: "transport", label: "Emergencia de transporte", origin: "human" },
  { id: 66, kind: "biological", label: "Emergencia biológica", origin: "undetermined" },
];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const severityLevel: Record<AlertSeverity, number> = { info: 0.22, watch: 0.42, warning: 0.68, danger: 0.92 };
const severityFromLabel = (label: string): AlertSeverity => {
  const normalized = label.toLowerCase();
  if (normalized.includes("red")) return "danger";
  if (normalized.includes("orange")) return "warning";
  if (normalized.includes("yellow")) return "watch";
  return "watch";
};
const cleanText = (value: string) => value.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&ndash;/g, "–").replace(/&rsquo;/g, "’").replace(/\s+/g, " ").trim();
const originLabel = (origin: HazardOrigin) => origin === "natural" ? "Fenómeno natural" : origin === "human" ? "Origen humano / tecnológico" : "Origen no determinado";
const statusFromEnd = (value: unknown): CaseStudy["status"] => {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) && timestamp > Date.now() ? "active" : "recent";
};
const DAY=86_400_000;
const timestampOf=(value:unknown)=>{const parsed=Date.parse(String(value??""));return Number.isFinite(parsed)?parsed:0};
const latestTimestamp=(...values:unknown[])=>Math.max(0,...values.map(timestampOf));
const isFresh=(timestamp:number,days:number)=>timestamp>0&&timestamp>=Date.now()-days*DAY&&timestamp<=Date.now()+2*DAY;
const dataState=(timestamp:number,endTimestamp=0):CaseStudy["dataState"]=>endTimestamp>=Date.now()?"live":timestamp>=Date.now()-2*DAY?"live":"recent";

function visualFor(kind: HazardKind, severity: AlertSeverity, raw = 0): HazardVisual {
  const level = severityLevel[severity];
  const visual = { ...EMPTY_VISUAL };
  if (kind === "flood") Object.assign(visual, { water: clamp(.42 + level * .52), rain: clamp(.25 + level * .55), wind: level * .25 });
  if (kind === "earthquake") visual.shake = clamp(Math.max(level, (raw - 4) / 3.6));
  if (kind === "cyclone") Object.assign(visual, { rain: clamp(.45 + level * .48), wind: clamp(Math.max(level, raw / 150)), water: level * .35 });
  if (kind === "volcano") Object.assign(visual, { ash: clamp(.48 + level * .5), smoke: clamp(.5 + level * .4), fire: .2 + level * .28, shake: level * .2 });
  if (kind === "wildfire") Object.assign(visual, { fire: clamp(Math.max(level, Math.log10(Math.max(10, raw)) / 5)), smoke: clamp(.52 + level * .4), drought: .45 });
  if (kind === "drought") Object.assign(visual, { drought: clamp(.58 + level * .4), water: .04 });
  if (kind === "chemical") Object.assign(visual, { contamination: clamp(.6 + level * .35), smoke: .24 + level * .35 });
  if (kind === "radiological") Object.assign(visual, { contamination: clamp(.72 + level * .25), smoke: .15 });
  if (kind === "transport") Object.assign(visual, { fire: .25 + level * .45, smoke: .38 + level * .45 });
  if (kind === "biological") visual.contamination = clamp(.48 + level * .38);
  return visual;
}

function gdacsMetrics(kind: HazardKind, raw: number, score: number, severity: AlertSeverity): CaseMetric[] {
  const exposure = Math.round(severityLevel[severity] * 100);
  if (kind === "earthquake") return [{ label: "Magnitud", value: raw ? raw.toFixed(1) : "N/D", level: clamp((raw - 3) / 6) * 100 }, { label: "Alerta GDACS", value: severity.toUpperCase(), level: exposure }];
  if (kind === "cyclone") return [{ label: "Viento máximo", value: raw ? `${Math.round(raw)} km/h` : "N/D", level: clamp(raw / 180) * 100 }, { label: "Alerta GDACS", value: severity.toUpperCase(), level: exposure }];
  if (kind === "wildfire") return [{ label: "Área detectada", value: raw ? `${Math.round(raw).toLocaleString("es-PE")} ha` : "N/D", level: clamp(Math.log10(Math.max(1, raw)) / 5) * 100 }, { label: "Alerta GDACS", value: severity.toUpperCase(), level: exposure }];
  if (kind === "drought") return [{ label: "Población expuesta", value: raw ? raw.toLocaleString("es-PE") : "N/D", level: clamp(Math.log10(Math.max(1, raw)) / 8) * 100 }, { label: "Alerta GDACS", value: severity.toUpperCase(), level: exposure }];
  return [{ label: "Puntaje GDACS", value: score.toFixed(2), level: clamp(score / 3) * 100 }, { label: "Alerta GDACS", value: severity.toUpperCase(), level: exposure }];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json() as Promise<T>;
}

export async function GET() {
  const updatedAt = new Date().toISOString();
  const unavailableSources: string[] = [];
  const cases: CaseStudy[] = [];

  const gdacsResults = await Promise.allSettled(gdacsFeeds.map(feed => fetchJson<{ features?: GdacsFeature[] }>(`https://www.gdacs.org/contentdata/xml/gdacs${feed.code}.geojson`)));
  gdacsResults.forEach((result, index) => {
    const feed = gdacsFeeds[index];
    if (result.status === "rejected") { if (!unavailableSources.includes("GDACS")) unavailableSources.push("GDACS"); return; }
    const freshnessDays=feed.kind==="drought"?14:7;
    const features = (result.value.features ?? []).filter(item => {const p=item.properties;const activity=latestTimestamp(p?.todate,p?.fromdate);return item.geometry?.type === "Point" && p?.country && isFresh(activity,freshnessDays)}).sort((a,b)=>latestTimestamp(b.properties?.todate,b.properties?.fromdate)-latestTimestamp(a.properties?.todate,a.properties?.fromdate)).slice(0,4);
    features.forEach(feature => {
      const p = feature.properties ?? {};
      const lat = Number(p.latitude ?? feature.geometry?.coordinates?.[1]);
      const lon = Number(p.longitude ?? feature.geometry?.coordinates?.[0]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const raw = Number(p.severity ?? 0);
      const score = Number(p.alertscore ?? 0);
      const activityTimestamp=latestTimestamp(p.todate,p.fromdate);
      const endTimestamp=timestampOf(p.todate);
      const severity = severityFromLabel(String(p.alertlevel ?? "Green"));
      cases.push({
      id: `gdacs-${feed.code}-${String(p.eventid ?? index)}`,
      country: String(p.country),
      code: String(p.iso3 ?? "--"),
      lat, lon,
      location: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
      mission: `Observar el impacto y acordar una respuesta ante ${feed.label.toLowerCase()}`,
      eventTitle: String(p.name ?? p.description ?? feed.label),
      details: cleanText(String(p.htmldescription ?? p.description ?? p.name ?? feed.label)).slice(0, 900),
      eventUrl: String(p.link ?? `https://www.gdacs.org/report.aspx?eventtype=${feed.code}&eventid=${String(p.eventid ?? "")}`),
      eventDate: String(p.fromdate ?? updatedAt),
      lastActivityAt: new Date(activityTimestamp).toISOString(),
      dataState: dataState(activityTimestamp,endTimestamp),
      status: statusFromEnd(p.todate),
      severity,
      source: "GDACS",
      hazardKind: feed.kind,
      hazardLabel: feed.label,
      origin: "natural",
      originLabel: originLabel("natural"),
      metrics: gdacsMetrics(feed.kind, raw, score, severity),
      visual: visualFor(feed.kind, severity, raw),
      simulation: { precipitationMm: 0, probabilityPct: 0, hourlyPeakMm: 0, windGustKmh: feed.kind === "cyclone" ? raw : 0 },
      });
    });
  });

  try {
    const [countryFeed, ...eventFeeds] = await Promise.all([
      fetchJson<{ results?: IfrcCountry[] }>("https://goadmin.ifrc.org/api/v2/country/?limit=300"),
      ...ifrcTypes.map(type => fetchJson<{ results?: IfrcEvent[] }>(`https://goadmin.ifrc.org/api/v2/event/?limit=5&ordering=-disaster_start_date&dtype=${type.id}`)),
    ]);
    const countries = new Map((countryFeed.results ?? []).map(country => [country.iso, country]));
    eventFeeds.forEach((feed, index) => {
      const type = ifrcTypes[index];
      const events = (feed.results ?? []).filter(candidate=>isFresh(latestTimestamp(candidate.updated_at,candidate.created_at,candidate.field_reports?.[0]?.report_date,candidate.disaster_start_date),21)).slice(0,3);
      events.forEach(event => {
        const eventCountry = event.countries?.[0];
        const country = countries.get(eventCountry?.iso) ?? eventCountry;
        const coordinates = country?.centroid?.coordinates;
        if (!country || !coordinates || coordinates.length < 2) return;
        const severity = severityFromLabel(event.ifrc_severity_level_display ?? "Yellow");
        const affected = Number(event.num_affected ?? 0);
        const summary = cleanText(event.summary ?? "");
        const activityTimestamp=latestTimestamp(event.updated_at,event.created_at,event.field_reports?.[0]?.report_date,event.disaster_start_date);
        cases.push({
        id: `ifrc-${String(event.id ?? type.id)}`,
        country: country.name ?? eventCountry?.name ?? "País",
        code: country.iso ?? eventCountry?.iso ?? "--",
        lat: Number(coordinates[1]),
        lon: Number(coordinates[0]),
        location: country.name ?? "Ubicación reportada por IFRC",
        mission: `Identificar zonas seguras y coordinar la respuesta ante ${type.label.toLowerCase()}`,
        eventTitle: event.name ?? type.label,
        details: summary.slice(0, 1200) || `IFRC GO registra este caso como ${type.label.toLowerCase()} y mantiene su impacto en evaluación.`,
        eventUrl: `https://go.ifrc.org/emergencies/${String(event.id ?? "")}`,
        eventDate: event.disaster_start_date ?? updatedAt,
        lastActivityAt: new Date(activityTimestamp).toISOString(),
        dataState: dataState(activityTimestamp),
        status: activityTimestamp>=Date.now()-2*DAY?"active":"recent",
        severity,
        source: "IFRC GO",
        hazardKind: type.kind,
        hazardLabel: type.label,
        origin: type.origin,
        originLabel: originLabel(type.origin),
        metrics: [
          { label: "Severidad IFRC", value: event.ifrc_severity_level_display ?? "Sin nivel", level: severityLevel[severity] * 100 },
          { label: "Personas afectadas", value: affected ? affected.toLocaleString("es-PE") : "En evaluación", level: affected ? clamp(Math.log10(affected) / 7) * 100 : 25 },
        ],
        visual: visualFor(type.kind, severity),
        simulation: { precipitationMm: 0, probabilityPct: 0, hourlyPeakMm: 0, windGustKmh: 0 },
        });
        if (summary && cases[cases.length - 1].eventTitle.length < 12) cases[cases.length - 1].eventTitle = summary.slice(0, 110);
      });
    });
  } catch (error) {
    console.error("IFRC GO cases unavailable", error);
    unavailableSources.push("IFRC GO");
  }

  const unique = cases.filter((item, index, all) => all.findIndex(other => other.id === item.id) === index).sort((a,b)=>timestampOf(b.lastActivityAt)-timestampOf(a.lastActivityAt)).slice(0,36);
  return NextResponse.json({ cases: unique.length ? unique : [PIURA_CASE], updatedAt, sources: ["GDACS", "IFRC GO"], unavailableSources }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
