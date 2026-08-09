import { describe, expect, it } from "vitest";
import { PIURA_CASE } from "./cases";
import { buildDecisionScenario } from "./decision-simulation";
import { deterministicScenePlan, enforceDecisionConcordance, enforcePhysicalLimits, type ScenePlan } from "./scene-plan";

describe("scene plan", () => {
  it("creates visible route and destination elements for evacuation", () => {
    const scenario = buildDecisionScenario(PIURA_CASE, "Evacuar por una ruta segura hacia un punto de encuentro.");
    const plan = deterministicScenePlan(PIURA_CASE, scenario);
    expect(plan.elements.some(element => element.type === "safe_route")).toBe(true);
    expect(plan.elements.some(element => element.type === "response_hub")).toBe(true);
    expect(plan.actorMoves.length).toBeGreaterThan(0);
  });

  it("does not let an evacuation reduce the physical hazard", () => {
    const unsafePlan: ScenePlan = {
      version: 1, actionKind: "evacuation", title: "Evacuación comunitaria segura", phaseDurationSeconds: 7,
      visualDelta: { water: -0.4, rain: -0.2, wind: -0.2, shake: -0.2, fire: -0.4, smoke: -0.4, ash: -0.2, drought: -0.2, contamination: -0.4 },
      elements: [{ type: "safe_route", label: "Ruta segura", path: [{ x: -1, z: 4 }, { x: -8, z: 7 }] }], actorMoves: [],
      expectedEffects: ["Reduce la exposición"], remainingRisks: ["El peligro sigue activo"], assumptions: ["La ruta debe verificarse"],
    };
    const guarded = enforcePhysicalLimits(PIURA_CASE, unsafePlan);
    expect(Object.values(guarded.visualDelta).every(value => value >= 0)).toBe(true);
  });

  it("allows bounded fire containment but never suppresses earthquake motion", () => {
    const plan = deterministicScenePlan({ hazardKind: "wildfire" }, { kind: "containment", title: "Contención gradual", expectedBenefit: "Limita la propagación", remainingRisk: "El fuego continúa activo", assumption: "Requiere brigadas" });
    plan.visualDelta.shake = -0.2;
    const guarded = enforcePhysicalLimits({ hazardKind: "wildfire" }, plan);
    expect(guarded.visualDelta.fire).toBeLessThan(0);
    expect(guarded.visualDelta.shake).toBe(0);
  });

  it("represents routes and a neighborhood alert network without moving people", () => {
    const proposal = "Acordemos rutas seguras señalizadas y una red vecinal para avisar antes de que aumente el riesgo.";
    const scenario = buildDecisionScenario(PIURA_CASE, proposal);
    const plan = deterministicScenePlan(PIURA_CASE, scenario);
    expect(plan.actionKind).toBe("coordination");
    expect(plan.elements.some(element => element.type === "safe_route")).toBe(true);
    expect(plan.elements.some(element => element.type === "alert_network")).toBe(true);
    expect(plan.actorMoves).toEqual([]);
  });

  it("repairs an AI plan that omits a concept required by the decision", () => {
    const proposal = "Señalizar rutas y crear una red vecinal para avisar cambios.";
    const incomplete = deterministicScenePlan(PIURA_CASE, buildDecisionScenario(PIURA_CASE, proposal));
    incomplete.elements = [{ type: "response_hub", label: "Punto inventado", position: { x: -8, z: 6 } }];
    incomplete.actorMoves = [{ actor: "resident", destination: { x: -8, z: 6 }, reason: "Mover a la persona" }];
    const repaired = enforceDecisionConcordance(incomplete, proposal);
    expect(repaired.elements.some(element => element.type === "safe_route")).toBe(true);
    expect(repaired.elements.some(element => element.type === "alert_network")).toBe(true);
    expect(repaired.elements.some(element => element.type === "response_hub")).toBe(false);
    expect(repaired.actorMoves).toEqual([]);
  });
});
