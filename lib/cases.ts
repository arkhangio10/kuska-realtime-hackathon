import type { AlertSeverity, KuskaAlert } from "./alerts";

export type HazardKind =
  | "flood"
  | "earthquake"
  | "cyclone"
  | "volcano"
  | "wildfire"
  | "drought"
  | "chemical"
  | "biological"
  | "radiological"
  | "transport"
  | "other";

export type HazardOrigin = "natural" | "human" | "undetermined";

export const HAZARD_ICONS: Record<HazardKind, string> = {
  flood: "≈", earthquake: "⌁", cyclone: "◉", volcano: "▲", wildfire: "◆",
  drought: "☀", chemical: "⚗", biological: "✣", radiological: "☢",
  transport: "▣", other: "!",
};

export type HazardVisual = {
  water: number;
  rain: number;
  wind: number;
  shake: number;
  fire: number;
  smoke: number;
  ash: number;
  drought: number;
  contamination: number;
};

export type CaseMetric = { label: string; value: string; level: number };

export type CaseStudy = {
  id: string;
  country: string;
  code: string;
  lat: number;
  lon: number;
  location: string;
  mission: string;
  eventTitle: string;
  details: string;
  eventUrl: string;
  eventDate: string;
  lastActivityAt: string;
  dataState: "live" | "recent" | "preventive";
  status: "preventive" | "active" | "recent";
  severity: AlertSeverity;
  source: "GDACS" | "IFRC GO" | "Open-Meteo";
  hazardKind: HazardKind;
  hazardLabel: string;
  origin: HazardOrigin;
  originLabel: string;
  metrics: CaseMetric[];
  visual: HazardVisual;
  simulation: NonNullable<KuskaAlert["simulation"]>;
};

export const EMPTY_VISUAL: HazardVisual = {
  water: 0,
  rain: 0,
  wind: 0,
  shake: 0,
  fire: 0,
  smoke: 0,
  ash: 0,
  drought: 0,
  contamination: 0,
};

export const PIURA_CASE: CaseStudy = {
  id: "piura-prevention",
  country: "Perú",
  code: "PE",
  lat: -5.1945,
  lon: -80.6328,
  location: "Piura",
  mission: "Prepararse para la próxima inundación",
  eventTitle: "Misión preventiva de inundaciones",
  details: "Escenario preventivo basado en las condiciones ambientales disponibles para Piura. No representa una emergencia activa.",
  eventUrl: "https://open-meteo.com/",
  eventDate: "",
  lastActivityAt: "",
  dataState: "preventive",
  status: "preventive",
  severity: "info",
  source: "Open-Meteo",
  hazardKind: "flood",
  hazardLabel: "Inundación",
  origin: "natural",
  originLabel: "Fenómeno natural",
  metrics: [
    { label: "Nivel de escenario", value: "Preventivo", level: 20 },
    { label: "Exposición", value: "Ribera urbana", level: 45 },
  ],
  visual: { ...EMPTY_VISUAL, water: 0.28, rain: 0.18 },
  simulation: { precipitationMm: 0, probabilityPct: 0, hourlyPeakMm: 0, windGustKmh: 0 },
};

export type CaseFeed = {
  cases: CaseStudy[];
  updatedAt: string;
  sources: string[];
  unavailableSources: string[];
};

export const formatActivityDate=(value:string)=>value?new Intl.DateTimeFormat("es-PE",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(value)):"Sin señal reciente";
