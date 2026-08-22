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

export type CommonsLedgerEntry = {
  kind: 'vouch' | 'slash';
  authorXId?: string;
  authorHandle: string;
  authorAvatarUrl?: string;
  points: number;
  quote?: string;
  tweetText?: string;
  tweetId?: string;
  tweetUrl?: string;
  tweetCreatedAt?: string;
};

export type CommonsLedger = {
  userId?: string;
  display?: string;
  xHandle: string;
  githubHandle?: string;
  rank?: number;
  entries: CommonsLedgerEntry[];
  vouchTotal: number;
  slashTotal: number;
  reputationPoints: number;
  totalPoints: number;
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
  userLedger?: CommonsLedger;
  supporterLedgers?: Record<string, CommonsLedger>;
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
  userScoreAfter: number;
  userRankAfter: number;
  userRankGain: number;
  candidateScoreAfter: number;
  candidateRankAfter: number;
  candidateRankGain: number;
  helpsThemCross: boolean;
  canMoveUsAcross: boolean;
  returnRatio: number;
};

export type WarmLead = {
  username: string;
  display?: string;
  avatarUrl?: string;
  via: string[];
  power: number;
  lastSeenAt?: string;
  pathCount: number;
  rank?: number;
  totalScore?: number;
  baseScore?: number;
  userScoreAfter: number;
  userRankAfter: number;
  userRankGain: number;
  candidateScoreAfter?: number;
  candidateRankAfter?: number;
  candidateRankGain?: number;
  candidateNeed?: number;
  helpsThemCross: boolean;
  score: number;
};
