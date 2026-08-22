export type Interaction = { from: string; to: string; value?: number; timestamp?: string };

export type Participant = {
  username: string;
  baseScore: number;
  totalScore: number;
  rank: number;
  vouchersUsed?: number;
  vouchesRemaining?: number;
  slashesUsed?: number;
  slashesRemaining?: number;
  vouchesReceived?: Interaction[];
  slashesReceived?: Interaction[];
};

export type CommonsSnapshot = {
  participants: Participant[];
  cutoffRank1000: number;
  upstreamUpdatedAt?: string;
  fetchedAt: string;
  source: string;
};

export type MarketCandidate = Participant & {
  power: number;
  need: number;
  ourUtility: number;
  theirUtility: number;
  strategicFit: number;
  mutualQualifier: boolean;
  dominated: boolean;
  available: boolean;
};
