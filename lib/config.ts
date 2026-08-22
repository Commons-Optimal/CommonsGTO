export const GAME = {
  vouchRate: 0.35,
  defaultVouches: 7,
  defaultSlashes: 7,
  targetRank: 1000,
  cacheSeconds: 300,
  weights: { nash: 0.48, fairness: 0.22, efficiency: 0.2, availability: 0.1 },
  holdThreshold: 0.56,
  ringCandidateLimit: 18,
} as const;
