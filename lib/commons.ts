import { DEMO_PARTICIPANTS } from "./demo-data";
import type { LeaderboardState, Participant } from "./types";

function normalise(payload: unknown): Participant[] {
  const root = payload as Record<string, unknown>;
  const rows = Array.isArray(payload) ? payload : (root?.participants ?? root?.leaderboard ?? root?.data);
  if (!Array.isArray(rows)) throw new Error("Unsupported leaderboard response");
  return rows.map((row, index) => {
    const value = row as Record<string, unknown>;
    return {
      username: String(value.username ?? value.handle ?? value.xUsername ?? "" ).replace(/^@/, ""),
      baseScore: Number(value.baseScore ?? value.base_score ?? value.base ?? 0),
      totalScore: Number(value.totalScore ?? value.total_score ?? value.score ?? 0),
      rank: Number(value.rank ?? index + 1),
      vouchersUsed: value.vouchersUsed == null ? undefined : Number(value.vouchersUsed),
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
    };
  }).filter((p) => p.username && Number.isFinite(p.totalScore));
}

export async function getLeaderboard(): Promise<LeaderboardState> {
  const endpoint = process.env.COMMONS_API_URL;
  if (endpoint) {
    try {
      const response = await fetch(endpoint, { next: { revalidate: 30 } });
      if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
      const participants = normalise(await response.json());
      if (participants.length) return { participants, updatedAt: new Date().toISOString(), source: "live" };
    } catch (error) {
      console.error("Commons live data unavailable; serving marked demo data", error);
    }
  }
  return { participants: DEMO_PARTICIPANTS, updatedAt: new Date().toISOString(), source: "demo" };
}

export function getCutoff(participants: Participant[], rank = 1000) {
  const exact = participants.find((p) => p.rank === rank);
  if (exact) return exact.totalScore;
  return [...participants].sort((a, b) => b.totalScore - a.totalScore)[Math.min(rank - 1, participants.length - 1)]?.totalScore ?? 0;
}
