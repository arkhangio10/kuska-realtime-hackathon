import { z } from "zod";
import type { CaseStudy, HazardVisual } from "./cases";

const pointSchema = z.object({
  x: z.number().min(-11).max(11),
  z: z.number().min(-11).max(11),
});

const labelSchema = z.string().min(3).max(48);
const visualDeltaSchema = z.object({
  water: z.number().min(-0.45).max(0.08),
  rain: z.number().min(-0.2).max(0.08),
  wind: z.number().min(-0.2).max(0.08),
  shake: z.number().min(-0.2).max(0.08),
  fire: z.number().min(-0.45).max(0.08),
  smoke: z.number().min(-0.45).max(0.08),
  ash: z.number().min(-0.2).max(0.08),
  drought: z.number().min(-0.2).max(0.08),
  contamination: z.number().min(-0.45).max(0.08),
});

export const sceneElementSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("safe_route"), label: labelSchema, path: z.array(pointSchema).min(2).max(8) }),
  z.object({ type: z.literal("response_hub"), label: labelSchema, position: pointSchema }),
  z.object({ type: z.literal("barrier"), label: labelSchema, center: pointSchema, radius: z.number().min(1.5).max(5.5) }),
  z.object({ type: z.literal("clearance"), label: labelSchema, position: pointSchema }),
  z.object({ type: z.literal("supply_point"), label: labelSchema, position: pointSchema }),
  z.object({ type: z.literal("observation_post"), label: labelSchema, position: pointSchema }),
  z.object({ type: z.literal("alert_network"), label: labelSchema, nodes: z.array(pointSchema).min(3).max(6) }),
]);

export const scenePlanSchema = z.object({
  version: z.literal(1),
  actionKind: z.enum(["evacuation", "coordination", "containment", "health", "logistics", "clearance", "monitoring"]),
  title: z.string().min(5).max(80),
  phaseDurationSeconds: z.number().min(5).max(12),
  visualDelta: visualDeltaSchema,
  elements: z.array(sceneElementSchema).min(1).max(8),
  actorMoves: z.array(z.object({
    actor: z.enum(["resident", "brigade", "merchant"]),
    destination: pointSchema,
    reason: z.string().min(5).max(100),
  })).max(3),
  expectedEffects: z.array(z.string().min(5).max(140)).min(1).max(3),
  remainingRisks: z.array(z.string().min(5).max(140)).min(1).max(3),
  assumptions: z.array(z.string().min(5).max(140)).min(1).max(3),
});

export type ScenePlan = z.infer<typeof scenePlanSchema>;
export type SceneElement = z.infer<typeof sceneElementSchema>;

const ZERO_DELTA: HazardVisual = { water: 0, rain: 0, wind: 0, shake: 0, fire: 0, smoke: 0, ash: 0, drought: 0, contamination: 0 };

export function deterministicScenePlan(caseStudy: Pick<CaseStudy, "hazardKind">, scenario: { kind: ScenePlan["actionKind"]; title: string; expectedBenefit: string; remainingRisk: string; assumption: string }): ScenePlan {
  const common = {
    version: 1 as const,
    actionKind: scenario.kind,
    title: scenario.title,
    phaseDurationSeconds: 7.2,
    visualDelta: { ...ZERO_DELTA },
    expectedEffects: [scenario.expectedBenefit],
    remainingRisks: [scenario.remainingRisk],
    assumptions: [scenario.assumption],
  };

  if (scenario.kind === "coordination") return { ...common, title: "Rutas señalizadas y red vecinal", elements: [
    { type: "safe_route", label: "Rutas señalizadas", path: [{ x: 6, z: 4 }, { x: 3, z: 4 }, { x: 0, z: 4 }, { x: -4, z: 5 }, { x: -8, z: 7 }] },
    { type: "alert_network", label: "Red vecinal de aviso", nodes: [{ x: -4, z: 4 }, { x: -1, z: 6 }, { x: 4, z: 3 }, { x: 6, z: -4 }] },
  ], actorMoves: [] };

  if (scenario.kind === "evacuation") return { ...common, elements: [
    { type: "safe_route", label: "Ruta comunitaria", path: [{ x: 3, z: 4 }, { x: 0, z: 4 }, { x: -4, z: 5 }, { x: -8, z: 7 }] },
    { type: "response_hub", label: "Punto seguro", position: { x: -9, z: 6 } },
  ], actorMoves: [
    { actor: "resident", destination: { x: -8.4, z: 7 }, reason: "Salir de la zona de mayor exposición" },
    { actor: "brigade", destination: { x: -7.2, z: 6 }, reason: "Orientar el desplazamiento" },
  ] };

  if (scenario.kind === "health") return { ...common, elements: [
    { type: "response_hub", label: "Atención prioritaria", position: { x: -8.5, z: 6 } },
    { type: "safe_route", label: "Acceso sanitario", path: [{ x: 4, z: 3 }, { x: 0, z: 4 }, { x: -4, z: 5 }, { x: -8, z: 6 }] },
  ], actorMoves: [
    { actor: "resident", destination: { x: -8, z: 6.5 }, reason: "Acceder al punto de atención" },
    { actor: "brigade", destination: { x: -7.1, z: 5.6 }, reason: "Apoyar la atención prioritaria" },
  ] };

  if (scenario.kind === "logistics") return { ...common, elements: [
    { type: "supply_point", label: "Suministros esenciales", position: { x: -8.5, z: 6 } },
    { type: "safe_route", label: "Corredor logístico", path: [{ x: 6, z: -4 }, { x: 3, z: 0 }, { x: 0, z: 4 }, { x: -8, z: 6 }] },
  ], actorMoves: [{ actor: "merchant", destination: { x: -7.5, z: 5.5 }, reason: "Coordinar suministros fuera del riesgo" }] };

  if (scenario.kind === "containment") {
    if (caseStudy.hazardKind === "wildfire" || caseStudy.hazardKind === "transport") { common.visualDelta.fire = -0.3; common.visualDelta.smoke = -0.2; }
    if (["chemical", "radiological", "biological"].includes(caseStudy.hazardKind)) common.visualDelta.contamination = -0.28;
    if (caseStudy.hazardKind === "flood") common.visualDelta.water = -0.18;
    return { ...common, elements: [
      { type: "barrier", label: "Perímetro de contención", center: { x: 3, z: -2 }, radius: 4.2 },
      { type: "observation_post", label: "Control del perímetro", position: { x: -1, z: 1 } },
    ], actorMoves: [{ actor: "brigade", destination: { x: -1, z: 1 }, reason: "Vigilar el perímetro desde una zona segura" }] };
  }

  if (scenario.kind === "clearance") return { ...common, elements: [
    { type: "clearance", label: "Retiro de obstáculos", position: { x: 1, z: 3 } },
    { type: "safe_route", label: "Corredor recuperado", path: [{ x: -4, z: 4 }, { x: 0, z: 4 }, { x: 4, z: 3 }] },
  ], actorMoves: [{ actor: "brigade", destination: { x: 0, z: 4 }, reason: "Verificar el corredor antes de abrirlo" }] };

  return { ...common, elements: [
    { type: "observation_post", label: "Monitoreo local", position: { x: -1, z: 1 } },
    { type: "barrier", label: "Zona de observación", center: { x: 3, z: -2 }, radius: 4.2 },
  ], actorMoves: [{ actor: "brigade", destination: { x: -1, z: 1 }, reason: "Registrar cambios y mantener distancia" }] };
}

export function enforcePhysicalLimits(caseStudy: Pick<CaseStudy, "hazardKind">, plan: ScenePlan): ScenePlan {
  const visualDelta = { ...plan.visualDelta };
  const canChangePhysicalHazard = plan.actionKind === "containment";
  if (!canChangePhysicalHazard) Object.keys(visualDelta).forEach(key => { visualDelta[key as keyof HazardVisual] = Math.max(0, visualDelta[key as keyof HazardVisual]); });

  // An operational decision can reduce exposure, but cannot immediately stop these phenomena.
  visualDelta.shake = Math.max(0, visualDelta.shake);
  visualDelta.drought = Math.max(0, visualDelta.drought);
  visualDelta.rain = Math.max(0, visualDelta.rain);
  visualDelta.ash = Math.max(0, visualDelta.ash);
  visualDelta.wind = Math.max(0, visualDelta.wind);

  if (canChangePhysicalHazard) {
    if (!(caseStudy.hazardKind === "wildfire" || caseStudy.hazardKind === "transport")) { visualDelta.fire = Math.max(0, visualDelta.fire); visualDelta.smoke = Math.max(0, visualDelta.smoke); }
    if (!["chemical", "radiological", "biological"].includes(caseStudy.hazardKind)) visualDelta.contamination = Math.max(0, visualDelta.contamination);
    if (caseStudy.hazardKind !== "flood") visualDelta.water = Math.max(0, visualDelta.water);
  }

  return { ...plan, visualDelta };
}

export function enforceDecisionConcordance(plan: ScenePlan, proposalText: string): ScenePlan {
  const normalized = proposalText.toLocaleLowerCase("es");
  const routeRequired = /ruta|señaliz/.test(normalized);
  const networkRequired = /red vecinal|avis|alerta|comunica|notifica/.test(normalized);
  const explicitMovement = /evacu|trasladar|desplazar personas|salir de la zona/.test(normalized);
  const elements = [...plan.elements];

  if (routeRequired && !elements.some(element => element.type === "safe_route")) elements.unshift({ type: "safe_route", label: "Rutas señalizadas", path: [{ x: 6, z: 4 }, { x: 3, z: 4 }, { x: 0, z: 4 }, { x: -4, z: 5 }, { x: -8, z: 7 }] });
  if (networkRequired && !elements.some(element => element.type === "alert_network")) elements.push({ type: "alert_network", label: "Red vecinal de aviso", nodes: [{ x: -4, z: 4 }, { x: -1, z: 6 }, { x: 4, z: 3 }, { x: 6, z: -4 }] });

  const keepDestination = /punto seguro|refugio|punto de encuentro|centro de atenci[oó]n/.test(normalized);
  const congruentElements = !keepDestination && !explicitMovement ? elements.filter(element => element.type !== "response_hub") : elements;
  return {
    ...plan,
    title: routeRequired && networkRequired ? "Rutas señalizadas y red vecinal" : plan.title,
    elements: congruentElements.slice(0, 8),
    actorMoves: explicitMovement ? plan.actorMoves : [],
  };
}

export function applyVisualDelta(visual: HazardVisual, delta: HazardVisual): HazardVisual {
  return Object.fromEntries(Object.entries(visual).map(([key, value]) => [key, Math.max(0, Math.min(1, value + delta[key as keyof HazardVisual]))])) as HazardVisual;
}
