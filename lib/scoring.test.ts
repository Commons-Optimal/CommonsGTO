import { describe, expect, it } from "vitest";
import { minimumDonorBase, pointsNeeded, qualificationCoverage, rawFairness, slashRiskBase, vouchValue } from "./scoring";

describe("Commons scoring", () => {
  it("uses configured 35% vouch weight", () => expect(vouchValue(193_300)).toBe(67_655));
  it("never returns a negative gap", () => {
    expect(pointsNeeded(381_400, 422_750)).toBe(41_350);
    expect(pointsNeeded(500_000, 422_750)).toBe(0);
  });
  it("finds the minimum donor base", () => expect(minimumDonorBase(41_350)).toBeCloseTo(118_142.857));
  it("clamps qualification coverage", () => expect(qualificationCoverage(70_000, 41_350)).toBe(1));
  it("handles zero-power fairness", () => expect(rawFairness(0, 0)).toBe(1));
  it("calculates defensive slash exposure", () => expect(slashRiskBase(25_000)).toBeCloseTo(71_428.571));
});
