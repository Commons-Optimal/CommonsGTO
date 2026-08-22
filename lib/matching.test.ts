import { describe, expect, it } from "vitest";
import { findMinimumQualifyingCombination } from "./combinations";
import { matchCandidate } from "./matching";
import type { Participant } from "./types";

const user: Participant = { username: "user", baseScore: 193_300, totalScore: 381_400, rank: 1284 };

describe("matching", () => {
  it("identifies a mutually qualifying exchange", () => {
    const candidate: Participant = { username: "alice", baseScore: 201_400, totalScore: 368_850, rank: 1183 };
    const match = matchCandidate(user, candidate, 422_750);
    expect(match.mutuallyQualifying).toBe(true);
    expect(match.oneVouchSolution).toBe(true);
    expect(match.score).toBeGreaterThan(0.9);
  });

  it("selects the fewest sufficient counterparties, then least surplus", () => {
    const candidates = [80_000, 43_000, 37_000, 32_000].map((power, index) =>
      matchCandidate(user, { username: `p${index}`, baseScore: power / 0.35, totalScore: 380_000, rank: 1200 + index }, 455_400),
    );
    const result = findMinimumQualifyingCombination(candidates, 74_000);
    expect(result?.matches).toHaveLength(1);
    expect(result?.total).toBeCloseTo(80_000);
  });
});
