export type Interaction = { from: string; to: string; value?: number; timestamp?: string };

export type Participant = {
  userId?: string;
  username: string;
  displayName?: string;
  githubHandle?: string;
  avatarUrl?: string;
  joined?: boolean;
  baseScore: number;
  reputationScore?: number;
  multiplier?: number;
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
  totalParticipants?: number;
  totalEntries?: number;
  boardVersion?: number;
  vouchLimit?: number;
  slashLimit?: number;
  nextSupplyIncreaseAt?: string;
  nextVouchLimit?: number;
  nextSlashLimit?: number;
  upstreamUpdatedAt?: string;
  fetchedAt: string;
  source: string;
};

export type CommonsMeta = Omit<CommonsSnapshot, 'participants'> & { participants?: never };

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
