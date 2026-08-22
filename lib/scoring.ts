import { RULES } from "./config";

export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const vouchValue = (baseScore: number) => baseScore * RULES.vouchMultiplier;
export const slashValue = (baseScore: number) => baseScore * RULES.slashMultiplier;
export const pointsNeeded = (score: number, cutoff: number) => Math.max(0, cutoff - score);
export const minimumDonorBase = (need: number) => need / RULES.vouchMultiplier;
export const safetyMargin = (score: number, cutoff: number) => score - cutoff;
export const slashRiskBase = (margin: number) => Math.max(0, margin) / RULES.slashMultiplier;
export const qualificationCoverage = (power: number, need: number) => need <= 0 ? 1 : clamp(power / need);
export const rawFairness = (a: number, b: number) => {
  const max = Math.max(a, b);
  return max === 0 ? 1 : clamp(Math.min(a, b) / max);
};
export const efficiency = (power: number, need: number) => {
  if (need <= 0) return 1;
  if (power <= 0) return 0;
  return clamp(power < need ? power / need : need / power);
};
