import 'server-only';
import { GAME } from './config';
import type { CommonsMeta, CommonsSnapshot, Participant } from './types';
import { recordSnapshot } from './history';

export class CommonsDataError extends Error {}

type Json = Record<string, unknown>;
type OfficialEntry = {
  rank?: number;
  user_id?: string;
  joined?: boolean;
  display?: string;
  x_handle?: string | null;
  github_handle?: string | null;
  avatar_url?: string | null;
  base_points?: number;
  multiplier?: number;
  reputation_points?: number;
  total_points?: number;
};
type VersionResponse = { board_version?: number; total_entries?: number; total_participants?: number };
type LeaderboardResponse = { entries?: OfficialEntry[]; total_entries?: number; total_participants?: number; board_version?: number; offset?: number };

const API_BASE = process.env.COMMONS_API_BASE_URL || 'https://api.commonsmade.com';
const EVENT = 'genesis';
const PAGE_SIZE = 500;
const FETCH_CONCURRENCY = 12;

async function officialJson<T>(path: string, revalidate = GAME.cacheSeconds): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { accept: 'application/json' },
      next: { revalidate },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new CommonsDataError('Commons could not be reached.');
  }
  if (!response.ok) throw new CommonsDataError(`Commons returned ${response.status}.`);
  try { return await response.json() as T; }
  catch { throw new CommonsDataError('Commons returned invalid JSON.'); }
}

function num(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeParticipant(row: OfficialEntry): Participant | null {
  const username = typeof row.x_handle === 'string' ? row.x_handle.replace(/^@/, '').trim() : '';
  const baseScore = num(row.base_points);
  const totalScore = num(row.total_points);
  const rank = num(row.rank);
  if (!username || baseScore === undefined || totalScore === undefined || rank === undefined || rank < 1) return null;
  return {
    userId: row.user_id,
    username,
    displayName: row.display,
    githubHandle: row.github_handle || undefined,
    avatarUrl: row.avatar_url || undefined,
    joined: row.joined,
    baseScore,
    reputationScore: num(row.reputation_points),
    multiplier: num(row.multiplier),
    totalScore,
    rank,
  };
}

function supplyFromEvent(event: Json) {
  const rules = event.rules && typeof event.rules === 'object' ? event.rules as Json : {};
  const supply = rules.supply && typeof rules.supply === 'object' ? rules.supply as Json : {};
  const next = supply.next_increase && typeof supply.next_increase === 'object' ? supply.next_increase as Json : {};
  return {
    vouchLimit: num(supply.vouches),
    slashLimit: num(supply.slashes),
    nextSupplyIncreaseAt: typeof next.at === 'string' ? next.at : undefined,
    nextVouchLimit: num(next.total_vouches),
    nextSlashLimit: num(next.total_slashes),
  };
}

function pagePath(offset: number, limit: number, boardVersion: number) {
  const qs = new URLSearchParams({ offset: String(offset), limit: String(limit), board_version: String(boardVersion) });
  return `/game/events/${EVENT}/leaderboard?${qs}`;
}

async function getVersion() {
  const version = await officialJson<VersionResponse>(`/game/events/${EVENT}/leaderboard/version`, 5);
  if (!version.board_version || !version.total_entries) throw new CommonsDataError('Commons leaderboard metadata is incomplete.');
  return version;
}

async function getEvent() {
  return officialJson<Json>(`/game/events/${EVENT}`, 30);
}

export async function getCommonsMeta(): Promise<CommonsMeta> {
  const [version, event] = await Promise.all([getVersion(), getEvent()]);
  const ranks = [500, 750, 900, 1000];
  const pages = await Promise.all(ranks.map(rank => officialJson<LeaderboardResponse>(pagePath(rank - 1, 1, version.board_version!), 10)));
  const rankScores: Record<number, number> = {};
  ranks.forEach((rank, index) => {
    const score = num(pages[index]?.entries?.[0]?.total_points);
    if (score !== undefined) rankScores[rank] = score;
  });
  const cutoffRank1000 = rankScores[GAME.targetRank];
  if (cutoffRank1000 === undefined) throw new CommonsDataError('Commons did not return rank 1000.');
  return {
    cutoffRank1000,
    rankScores,
    totalParticipants: num(version.total_participants),
    totalEntries: num(version.total_entries),
    boardVersion: num(version.board_version),
    ...supplyFromEvent(event),
    fetchedAt: new Date().toISOString(),
    source: 'api.commonsmade.com',
  };
}

async function fetchAllEntries(version: VersionResponse): Promise<OfficialEntry[]> {
  const total = version.total_entries!;
  const offsets = Array.from({ length: Math.ceil(total / PAGE_SIZE) }, (_, i) => i * PAGE_SIZE);
  const pages: LeaderboardResponse[] = [];
  for (let i = 0; i < offsets.length; i += FETCH_CONCURRENCY) {
    const batch = offsets.slice(i, i + FETCH_CONCURRENCY);
    pages.push(...await Promise.all(batch.map(offset => officialJson<LeaderboardResponse>(pagePath(offset, PAGE_SIZE, version.board_version!), 10))));
  }
  return pages.flatMap(page => Array.isArray(page.entries) ? page.entries : []);
}

export async function getCommonsSnapshot(): Promise<CommonsSnapshot> {
  const [version, event] = await Promise.all([getVersion(), getEvent()]);
  const rows = await fetchAllEntries(version);
  const participants = rows
    .filter(row => row.joined !== false)
    .map(normalizeParticipant)
    .filter((p): p is Participant => Boolean(p))
    .sort((a, b) => a.rank - b.rank);

  if (!participants.length) throw new CommonsDataError('Commons returned no joined participants.');
  const rankScores: Record<number, number> = {};
  for (const rank of [500, 750, 900, 1000]) {
    const participant = participants.find(p => p.rank === rank);
    if (participant) rankScores[rank] = participant.totalScore;
  }
  const cutoffParticipant = participants.find(p => p.rank === GAME.targetRank);
  if (!cutoffParticipant) throw new CommonsDataError('Commons snapshot does not contain rank 1000.');

  const snapshot: CommonsSnapshot = {
    participants,
    cutoffRank1000: cutoffParticipant.totalScore,
    rankScores,
    totalParticipants: num(version.total_participants),
    totalEntries: num(version.total_entries),
    boardVersion: num(version.board_version),
    ...supplyFromEvent(event),
    fetchedAt: new Date().toISOString(),
    source: 'api.commonsmade.com',
  };
  await recordSnapshot(snapshot);
  return snapshot;
}

export async function searchCommonsUser(username: string): Promise<Participant | null> {
  const version = await getVersion();
  const qs = new URLSearchParams({ q: username.replace(/^@/, ''), limit: '20', board_version: String(version.board_version) });
  const result = await officialJson<{ entries?: OfficialEntry[] }>(`/game/events/${EVENT}/leaderboard/search?${qs}`, 10);
  const wanted = username.replace(/^@/, '').toLowerCase();
  const row = result.entries?.find(entry => entry.x_handle?.toLowerCase() === wanted);
  return row ? normalizeParticipant(row) : null;
}
