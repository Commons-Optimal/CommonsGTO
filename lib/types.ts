export type Participant = {
  username: string;
  baseScore: number;
  totalScore: number;
  rank: number;
  vouchersUsed?: number;
  slashesUsed?: number;
  updatedAt?: string;
};

export type LeaderboardState = {
  participants: Participant[];
  updatedAt: string;
  source: "live" | "demo";
};
