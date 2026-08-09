import type { CaseStudy, HazardVisual } from "./cases";
import type { ScenePlan } from "./scene-plan";
import { applyVisualDelta } from "./scene-plan";

export type InterventionKind = "evacuation" | "coordination" | "containment" | "health" | "logistics" | "clearance" | "monitoring";

export type DecisionScenario = {
  id: string;
  title: string;
  proposalText: string;
  kind: InterventionKind;
  targetVisual: HazardVisual;
  exposureReductionPct: number;
  physicalChangePct: number;
  expectedBenefit: string;
  remainingRisk: string;
  assumption: string;
  scenePlan?: ScenePlan;
  directorSource?: "openai" | "fallback";
  directorModel?: string;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function inferKind(text: string): InterventionKind {
  const normalized = text.toLocaleLowerCase("es");
  if (/evacu|trasladar|desplazar personas|salir de la zona/.test(normalized)) return "evacuation";
  if (/contener|contenci[oó]n|exting|apagar|cortafuego|barrera|drenaje|bombear/.test(normalized)) return "containment";
  if (/salud|sanitari|m[eé]dic|hospital|vulnerable|primeros auxilios/.test(normalized)) return "health";
  if (/escombro|despejar|limpiar|rehabilitar|reabrir/.test(normalized)) return "clearance";
  if (/almacen|suministro|abastec|mercado|agua potable|distribu/.test(normalized)) return "logistics";
  if (/ruta|señal|avis|red vecinal|alerta|comunica|notifica/.test(normalized)) return "coordination";
  return "monitoring";
}

export function attachScenePlan(scenario: DecisionScenario, baseVisual: HazardVisual, plan: ScenePlan, source: "openai" | "fallback", model?: string): DecisionScenario {
  const targetVisual = applyVisualDelta(baseVisual, plan.visualDelta);
  const physicalChangePct = Math.round(Math.max(...Object.keys(baseVisual).map(key => Math.max(0, baseVisual[key as keyof HazardVisual] - targetVisual[key as keyof HazardVisual]))) * 100);
  return {
    ...scenario,
    title: plan.title,
    kind: plan.actionKind,
    targetVisual,
    physicalChangePct,
    expectedBenefit: plan.expectedEffects.join(" "),
    remainingRisk: plan.remainingRisks.join(" "),
    assumption: plan.assumptions.join(" "),
    scenePlan: plan,
    directorSource: source,
    directorModel: model,
  };
}

export function buildDecisionScenario(caseStudy: CaseStudy, proposalText: string): DecisionScenario {
  const kind = inferKind(proposalText);
  const targetVisual = { ...caseStudy.visual };
  let exposureReductionPct = 12;
  let physicalChangePct = 0;
  let expectedBenefit = "Mejora la coordinación y permite detectar cambios antes de actuar.";
  let assumption = "Requiere responsables locales, comunicación activa y verificación en terreno.";

  if (kind === "evacuation") {
    exposureReductionPct = 38;
    expectedBenefit = "Aleja personas de la zona de mayor exposición y señaliza una ruta segura.";
    assumption = "La ruta debe seguir transitable y la autoridad local debe confirmar su apertura.";
  } else if (kind === "coordination") {
    exposureReductionPct = 18;
    expectedBenefit = "Hace visibles las rutas acordadas y conecta una red vecinal para comunicar cambios del riesgo.";
    assumption = "Las rutas y los avisos deben verificarse localmente; esta acción no implica evacuar ni declara una zona segura.";
  } else if (kind === "health") {
    exposureReductionPct = 31;
    expectedBenefit = "Prioriza hogares vulnerables y habilita un punto de atención fuera del riesgo.";
    assumption = "Se necesita personal, suministros y un registro local actualizado.";
  } else if (kind === "logistics") {
    exposureReductionPct = 22;
    expectedBenefit = "Protege suministros esenciales y reduce desplazamientos improvisados.";
    assumption = "El punto de distribución debe permanecer accesible y contar con inventario real.";
  } else if (kind === "clearance") {
    exposureReductionPct = 27;
    expectedBenefit = "Recupera un corredor de acceso sin alterar la intensidad del fenómeno.";
    assumption = "Equipos técnicos deben declarar estable la zona antes de retirar obstáculos.";
  } else if (kind === "containment") {
    exposureReductionPct = 29;
    physicalChangePct = 28;
    expectedBenefit = "Reduce gradualmente la propagación visible alrededor del área intervenida.";
    assumption = "La reducción supone recursos operativos y condiciones ambientales favorables.";
    if (caseStudy.hazardKind === "wildfire" || caseStudy.hazardKind === "transport") {
      targetVisual.fire = clamp(targetVisual.fire * .62);
      targetVisual.smoke = clamp(targetVisual.smoke * .72);
    } else if (["chemical", "radiological", "biological"].includes(caseStudy.hazardKind)) {
      targetVisual.contamination = clamp(targetVisual.contamination * .7);
    } else if (caseStudy.hazardKind === "flood") {
      targetVisual.water = clamp(targetVisual.water * .82);
    } else if (caseStudy.hazardKind === "cyclone") {
      targetVisual.wind = clamp(targetVisual.wind * .88);
    } else {
      physicalChangePct = 8;
    }
  }

  const hazardStillActive = Math.max(...Object.values(targetVisual)) > .12;
  const remainingRisk = hazardStillActive
    ? `El ${caseStudy.hazardLabel.toLowerCase()} continúa activo; la simulación no confirma seguridad ni reemplaza instrucciones oficiales.`
    : "El escenario mejora, pero todavía requiere verificación local antes de declarar la zona segura.";

  return {
    id: `${caseStudy.id}-${Date.now()}`,
    title: kind === "evacuation" ? "Ruta segura y evacuación" : kind === "coordination" ? "Rutas señalizadas y red vecinal" : kind === "containment" ? "Contención gradual" : kind === "health" ? "Respuesta sanitaria priorizada" : kind === "logistics" ? "Abastecimiento protegido" : kind === "clearance" ? "Corredor recuperado" : "Monitoreo y activación escalonada",
    proposalText,
    kind,
    targetVisual,
    exposureReductionPct,
    physicalChangePct,
    expectedBenefit,
    remainingRisk,
    assumption,
  };
}

export function interpolateVisual(from: HazardVisual, to: HazardVisual, progress: number): HazardVisual {
  const amount = clamp(progress);
  return Object.fromEntries(Object.keys(from).map(key => {
    const visualKey = key as keyof HazardVisual;
    return [visualKey, from[visualKey] + (to[visualKey] - from[visualKey]) * amount];
  })) as HazardVisual;
}
