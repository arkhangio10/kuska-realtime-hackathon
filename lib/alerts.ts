export type AlertSeverity = "info" | "watch" | "warning" | "danger";
export type KuskaAlert = {
  id: string;
  source: "Open-Meteo" | "GDACS";
  title: string;
  description: string;
  severity: AlertSeverity;
  scope: string;
  type: "forecast" | "flood-event";
  startsAt: string;
  endsAt?: string;
  updatedAt: string;
  url: string;
  official: boolean;
  metrics?: { label: string; value: string }[];
  simulation?: { precipitationMm: number; probabilityPct: number; hourlyPeakMm: number; windGustKmh: number };
};

export type AlertFeed = {
  alerts: KuskaAlert[];
  updatedAt: string;
  unavailableSources: string[];
};

export const severityRank: Record<AlertSeverity, number> = { danger: 4, warning: 3, watch: 2, info: 1 };

export function classifyForecast(rain: number, probability: number, hourlyMax: number, weatherCode=0): AlertSeverity {
  if (rain >= 50 || hourlyMax >= 15 || weatherCode >= 95) return "danger";
  if (rain >= 20 || hourlyMax >= 7.5 || probability >= 80) return "warning";
  if (rain >= 8 || hourlyMax >= 3 || probability >= 60) return "watch";
  return "info";
}
