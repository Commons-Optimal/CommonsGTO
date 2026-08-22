import 'server-only';
import { GAME } from './config';
import type { CommonsSnapshot, Participant } from './types';
import { recordSnapshot } from './history';

export class CommonsDataError extends Error {}

type CommonsEntry = {
  rank: number;
  user_id: string;
  joined: boolean;
  display: string;
  x_handle: string | null;
  github_handle: string | null;
  avatar_url: string | null;
  base_points: number;
  multiplier: number;
  reputation_points: number;
  total_points: number;
};

type VersionResponse = {
  board_version: number;
  total_entries: number;
  total_participants: number;
};

type LeaderboardResponse = VersionResponse & {
  entries: CommonsEntry[];
  offset: number;
};

type SearchResponse = {
  board_version: number;
  query: string;
  entries: CommonsEntry[];
};

type EventResponse = {
  rules?: {
    supply?: {
      vouches?: number;
      slashes?: number;
      resolved_at?: string;
      next_increase?: {
        at?: string;
        total_vouches?: number;
        total_slashes?: number;
      } | null;
    };
  };
};

const API_BASE = 'https://api.commonsmade.com';
const EVENT = 'genesis';
const PAGE_SIZE = 500;
// 5,000 rows is enough to cover the cutoff and a deep pool of realistic counterparties.
// A requested user outside this window is added through the official search endpoint.
const MARKET_ROWS = 5000;

async function commonsFetch<T>(path: string, revalidate = GAME.cacheSeconds): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { accept: 'application/json' },
      next: { revalidate },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new CommonsDataError('The Commons source could not be reached.');
  }

  if (!response.ok) {
    throw new CommonsDataError(`The Commons source returned ${response.status}.`);
  }

  try {
    return await response.json() as T;
  } catch {
    throw new CommonsDataError('The Commons source returned invalid JSON.');
  }
}

function normalizeEntry(entry: CommonsEntry): Participant | null {
  const username = entry.x_handle?.replace(/^@/, '').trim();
  if (!username || !Number.isFinite(entry.base_points) || !Number.isFinite(entry.total_points) || !Number.isFinite(entry.rank)) {
    return null;
  }

  return {
    username,
    userId: entry.user_id,
    display: entry.display,
    avatarUrl: entry.avatar_url ?? undefined,
    githubHandle: entry.github_handle ?? undefined,
    baseScore: entry.base_points,
    multiplier: entry.multiplier,
    reputationScore: entry.reputation_points,
    totalScore: entry.total_points,
    rank: entry.rank,
  };
}

export async function getCommonsSnapshot(requestedUsername?: string): Promise<CommonsSnapshot> {
  const fetchedAt = new Date().toISOString();

  const [version, event] = await Promise.all([
    commonsFetch<VersionResponse>(`/game/events/${EVENT}/leaderboard/version`, 10),
    commonsFetch<EventResponse>(`/game/events/${EVENT}`, 30),
  ]);

  const boardVersion = version.board_version;
  const offsets = Array.from(
    { length: Math.ceil(Math.min(version.total_entries, MARKET_ROWS) / PAGE_SIZE) },
    (_, index) => index * PAGE_SIZE,
  );

  const pageRequests = offsets.map(offset =>
    commonsFetch<LeaderboardResponse>(
      `/game/events/${EVENT}/leaderboard?board_version=${boardVersion}&offset=${offset}&limit=${PAGE_SIZE}`,
      GAME.cacheSeconds,
    ),
  );

  const searchRequest = requestedUsername
    ? commonsFetch<SearchResponse>(
        `/game/events/${EVENT}/leaderboard/search?board_version=${boardVersion}&q=${encodeURIComponent(requestedUsername.replace(/^@/, ''))}&limit=30`,
        30,
      )
    : Promise.resolve<SearchResponse | null>(null);

  const [pages, search] = await Promise.all([
    Promise.all(pageRequests),
    searchRequest,
  ]);

  const participantMap = new Map<string, Participant>();

  for (const page of pages) {
    for (const raw of page.entries ?? []) {
      const participant = normalizeEntry(raw);
      if (participant) participantMap.set(participant.username.toLowerCase(), participant);
    }
  }

  if (search) {
    for (const raw of search.entries ?? []) {
      const participant = normalizeEntry(raw);
      if (participant) participantMap.set(participant.username.toLowerCase(), participant);
    }
  }

  const participants = Array.from(participantMap.values()).sort((a, b) => a.rank - b.rank);
  if (!participants.length) throw new CommonsDataError('The Commons response contained no valid participants.');

  const cutoffParticipant = participants.find(participant => participant.rank === GAME.targetRank);
  if (!cutoffParticipant) {
    throw new CommonsDataError('The live snapshot did not include rank 1000.');
  }

  const supply = event.rules?.supply;
  const snapshot: CommonsSnapshot = {
    participants,
    totalParticipants: version.total_participants,
    totalEntries: version.total_entries,
    boardVersion,
    cutoffRank1000: cutoffParticipant.totalScore,
    vouchLimit: supply?.vouches ?? GAME.defaultVouches,
    slashLimit: supply?.slashes ?? GAME.defaultSlashes,
    nextSupplyAt: supply?.next_increase?.at,
    nextVouchLimit: supply?.next_increase?.total_vouches,
    nextSlashLimit: supply?.next_increase?.total_slashes,
    upstreamUpdatedAt: supply?.resolved_at,
    fetchedAt,
    source: 'api.commonsmade.com',
  };

  await recordSnapshot(snapshot);
  return snapshot;
}
