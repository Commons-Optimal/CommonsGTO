export type Interaction = { from: string; to: string; value?: number; timestamp?: string };

export type Participant = {
  username: string;
  userId?: string;
  display?: string;
  avatarUrl?: string;
  githubHandle?: string;
  baseScore: number;
  multiplier?: number;
  reputationScore?: number;
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
  totalParticipants?: number;
  totalEntries?: number;
  boardVersion?: number;
  cutoffRank1000: number;
  vouchLimit?: number;
  slashLimit?: number;
  nextSupplyAt?: string;
  nextVouchLimit?: number;
  nextSlashLimit?: number;
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
