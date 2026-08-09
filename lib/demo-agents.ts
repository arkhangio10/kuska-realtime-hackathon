import { z } from "zod";
import { caseContextSchema, demoActors } from "./kuska";
import { evidenceBundleSchema } from "./evidence";

export const agentInterventionSchema = z.object({
  actorId: z.string().min(1).max(80),
  action: z.enum(["propose", "concern", "question", "pass"]),
  text: z.string().min(12).max(280),
  evidenceIds: z.array(z.string().min(1).max(80)).max(3),
  rationale: z.string().min(8).max(220),
  confidence: z.enum(["low", "medium", "high"]),
});
export const agentTurnSchema = z.object({ interventions: z.array(agentInterventionSchema).min(3).max(5) });
export type AgentTurn = z.infer<typeof agentTurnSchema>;

const proposalSchema = z.object({ id: z.string().min(1).max(80), text: z.string().min(12).max(280), author: z.object({ id: z.string(), alias: z.string(), role: z.string(), kind: z.enum(["human", "agent", "demo-agent"]) }) });
export const agentTurnRequestSchema = z.object({
  caseStudy: caseContextSchema,
  evidenceBundle: evidenceBundleSchema,
  proposals: z.array(proposalSchema).max(20),
  chat: z.array(z.object({ alias: z.string().max(50), text: z.string().max(180) })).max(20).default([]),
  requesterId: z.string().max(80).optional(),
});
export type AgentTurnRequest = z.infer<typeof agentTurnRequestSchema>;

const actionByRole: Record<string, (hazard: string) => string> = {
  "Vecina de la zona": hazard => `Antes de actuar ante ${hazard.toLowerCase()}, identifiquemos hogares que necesitan apoyo y confirmemos una ruta accesible con personas del sector.`,
  "Comerciante local": () => "Definamos un punto seguro para suministros esenciales y un criterio verificable para cerrar o reabrir los comercios.",
  "Brigadista comunitario": () => "Validemos dos rutas, responsables por sector y una señal oficial de activación antes de movilizar a la comunidad.",
  "Especialista técnico": () => "No ejecutemos la opción principal hasta contrastar el perímetro, la antigüedad de los datos y cualquier conflicto entre fuentes.",
  "Coordinador municipal": () => "Asignemos un responsable, un plazo de seis horas y una señal pública de cumplimiento para cada acción acordada.",
};

export function deterministicAgentTurn(input: AgentTurnRequest): AgentTurn {
  const evidenceIds = input.evidenceBundle.items.filter(item => item.reliability !== "low").slice(0, 2).map(item => item.id);
  return { interventions: demoActors.map((actor, index) => ({
    actorId: actor.id,
    action: index === 3 ? "concern" as const : index === 4 ? "question" as const : "propose" as const,
    text: actionByRole[actor.role]?.(input.caseStudy.hazardLabel) ?? "Confirmemos primero la evidencia local disponible.",
    evidenceIds,
    rationale: `Intervención simulada desde la perspectiva: ${actor.role}.`,
    confidence: evidenceIds.length >= 2 ? "medium" as const : "low" as const,
  })) };
}
