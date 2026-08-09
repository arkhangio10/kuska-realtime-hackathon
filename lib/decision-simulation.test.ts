import { describe, expect, it } from "vitest";
import { PIURA_CASE } from "./cases";
import { buildDecisionScenario, interpolateVisual } from "./decision-simulation";

describe("decision simulation", () => {
  it("does not lower the physical hazard for an evacuation proposal", () => {
    const result = buildDecisionScenario(PIURA_CASE, "Evacuemos a las familias por una ruta segura señalizada.");
    expect(result.kind).toBe("evacuation");
    expect(result.targetVisual).toEqual(PIURA_CASE.visual);
    expect(result.exposureReductionPct).toBeGreaterThan(0);
  });

  it("does not invent an evacuation when the decision only requests routes and alerts", () => {
    const result = buildDecisionScenario(PIURA_CASE, "Acordemos rutas seguras señalizadas y una red vecinal para avisar antes de que aumente el riesgo.");
    expect(result.kind).toBe("coordination");
    expect(result.title).toBe("Rutas señalizadas y red vecinal");
    expect(result.targetVisual).toEqual(PIURA_CASE.visual);
  });

  it("can lower water only for a containment intervention", () => {
    const result = buildDecisionScenario(PIURA_CASE, "Activemos barreras y bombeo para contener el agua.");
    expect(result.kind).toBe("containment");
    expect(result.targetVisual.water).toBeLessThan(PIURA_CASE.visual.water);
  });

  it("interpolates the world gradually", () => {
    const result = interpolateVisual(PIURA_CASE.visual, { ...PIURA_CASE.visual, water: 0 }, .5);
    expect(result.water).toBeCloseTo(PIURA_CASE.visual.water / 2);
  });
});
