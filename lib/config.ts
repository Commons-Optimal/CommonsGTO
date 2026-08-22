export const RULES = {
  vouchMultiplier: 0.35,
  slashMultiplier: 0.35,
  qualifyingRank: 1000,
  maxVouches: 5,
  maxSlashes: 5,
  safetyBuffer: 0.05,
  similarPowerMin: 0.75,
  similarPowerMax: 1.33,
  staleAfterMs: 5 * 60 * 1000,
  matchWeights: {
    qualification: 0.35,
    reciprocity: 0.3,
    fairness: 0.2,
    efficiency: 0.15,
  },
} as const;

export const CREATOR = "Cyphrgm";
