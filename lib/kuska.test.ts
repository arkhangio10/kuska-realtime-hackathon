import { describe, expect, it } from "vitest";
import {
  bridgeRequestSchema,
  bridgeSchema,
  dedupeVotes,
  demoActors,
  hasCompleteSentence,
  proposalTallies,
  score,
  seedProposals,
  wordCount,
  type VoteRecord,
} from "./kuska";

const votes: VoteRecord[] = [
  { proposalId: "p-rutas", actorId: "a", value: "agree" },
  { proposalId: "p-rutas", actorId: "a", value: "concern" },
  { proposalId: "p-comercio", actorId: "b", value: "agree" },
];

describe("lógica de terreno común", () => {
  it("conserva solo el voto más reciente de cada persona por propuesta", () => {
    expect(dedupeVotes(votes)).toEqual([
      { proposalId: "p-rutas", actorId: "a", value: "concern" },
      { proposalId: "p-comercio", actorId: "b", value: "agree" },
    ]);
  });

  it("combina apoyo y participación de forma determinista", () => {
    expect(score(votes, 3)).toBe(55);
    expect(score([], 3)).toBe(0);
  });

  it("calcula los totales por propuesta después de deduplicar", () => {
    expect(proposalTallies(seedProposals.slice(0, 2), votes)).toEqual([
      { proposalId: "p-rutas", agree: 0, concern: 1, pass: 0 },
      { proposalId: "p-comercio", agree: 1, concern: 0, pass: 0 },
    ]);
  });
});

describe("contrato de la facilitadora", () => {
  const caseStudy = {
    id: "case-1",
    country: "Perú",
    location: "Piura",
    lat: -5.19,
    lon: -80.63,
    hazardKind: "flood",
    hazardLabel: "Inundación",
    eventTitle: "Alerta hidrológica",
    details: "El nivel del río se encuentra bajo observación según la fuente.",
    eventUrl: "https://example.org/case-1",
    source: "GDACS",
    eventDate: "2026-08-08",
    lastActivityAt: "2026-08-08T12:00:00Z",
    dataState: "live" as const,
    severity: "warning" as const,
    metrics: [{ label: "Nivel", value: "Alto", level: 70 }],
  };

  it("rechaza una solicitud sin dos perspectivas", () => {
    const result = bridgeRequestSchema.safeParse({
      caseStudy,
      proposals: seedProposals.slice(0, 1),
      votes: [],
      participants: demoActors,
      evidenceBundle: { caseId: caseStudy.id, generatedAt: caseStudy.lastActivityAt, items: [{ id: "official-case-1", kind: "official", title: caseStudy.eventTitle, fact: caseStudy.details, source: caseStudy.source, sourceUrl: caseStudy.eventUrl, observedAt: caseStudy.lastActivityAt, reliability: "high", freshness: "live", geography: caseStudy.location }], unknowns: [], unavailableSources: [] },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some(issue => issue.path[0] === "proposals")).toBe(true);
  });

  it("valida una salida estructurada, verificable y breve", () => {
    const result = bridgeSchema.parse({
      bridge: "Activar una prueba conjunta de rutas y brigadas, validada por coordinación local antes de ejecutarse.",
      rationale: "Combina prevención, evacuación y verificación sin afirmar que la sala ya llegó a consenso.",
      sharedInterests: ["proteger a las personas", "coordinar la respuesta"],
      unresolvedRisks: ["La capacidad local debe confirmarse."],
      basedOnProposalIds: ["p-rutas", "p-salud"],
      evidenceUsed: [{ evidenceId: "official-case-1", fact: caseStudy.details, source: caseStudy.source, sourceUrl: "https://example.org/case-1", observedAt: caseStudy.lastActivityAt, reliability: "high" }],
      assumptions: ["Las brigadas están disponibles."],
      unknowns: ["Capacidad actual de los refugios"],
      tradeoffs: [{ benefit: "Coordina la evacuación", costOrRisk: "Una ruta puede quedar bloqueada", affectedGroup: "Hogares expuestos" }],
      rejectionConditions: ["Detener si la ruta deja de ser transitable"],
      nextSteps: [{ action: "Validar responsables", possibleOwner: "Coordinación local", horizon: "24 horas", successSignal: "Responsables publicados" }],
      solutionOptions: ["rutas", "salud", "informacion"].map((id, index) => ({ id, title: `Solución ${id}`, summary: "Una alternativa operativa sustentada en la evidencia disponible y aportes de la comunidad.", communityBasis: "Desarrolla las propuestas de rutas y brigadas presentadas por la comunidad.", basedOnProposalIds: index === 0 ? ["p-rutas", "p-salud"] : ["p-rutas"], evidenceIds: ["official-case-1"], actionSteps: [{ action: "Verificar condiciones locales antes de actuar", possibleOwner: "Coordinación local", horizon: "6 horas" }, { action: "Publicar el resultado de la verificación", possibleOwner: "Brigadas", horizon: "12 horas" }], benefits: ["Mejora la coordinación de la respuesta"], risks: ["Las condiciones pueden cambiar rápidamente"], requirements: ["Responsables confirmados"], feasibility: "medium", confidence: "medium" })),
      recommendedSolutionId: "rutas",
      confidence: "medium",
    });
    expect(wordCount(result.bridge)).toBeLessThanOrEqual(50);
    expect(result.basedOnProposalIds).toHaveLength(2);
  });

  it("detecta respuestas de IA cortadas antes de una preposición", () => {
    expect(hasCompleteSentence("Validar rutas con la comunidad antes de actuar.")).toBe(true);
    expect(hasCompleteSentence("Validar rutas con la comunidad antes de actuar a")).toBe(false);
  });
});
