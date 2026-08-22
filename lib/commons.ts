import 'server-only';
import { GAME } from './config';
import type { CommonsLedger, CommonsLedgerEntry, CommonsSnapshot, Participant } from './types';
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

type RawLedgerEntry = {
  kind?: string;
  author_x_id?: string;
  author_handle?: string;
  author_avatar_url?: string;
  points?: number;
  quote?: string;
  tweet_text?: string;
  tweet_id?: string;
  tweet_url?: string;
  tweet_created_at?: string;
};

type RawLedgerResponse = {
  user_id?: string;
  display?: string;
  x_handle?: string;
  github_handle?: string | null;
  rank?: number;
  entries?: RawLedgerEntry[];
  vouch_total?: number;
  slash_total?: number;
  reputation_points?: number;
  total_points?: number;
};

const API_BASE = 'https://api.commonsmade.com';
const EVENT = 'genesis';
const PAGE_SIZE = 500;
const MARKET_ROWS = 5000;
const MAX_DIRECT_SUPPORTERS = 12;
const MAX_WARM_SEARCHES = 20;

async function commonsFetch<T>(path: string, revalidate: number = GAME.cacheSeconds): Promise<T> {
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

async function safeCommonsFetch<T>(path: string, revalidate: number = GAME.cacheSeconds): Promise<T | undefined> {
  try {
    return await commonsFetch<T>(path, revalidate);
  } catch {
    return undefined;
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

function normalizeLedger(raw: RawLedgerResponse | undefined): CommonsLedger | undefined {
  if (!raw?.x_handle) return undefined;
  const entries: CommonsLedgerEntry[] = (raw.entries ?? []).flatMap(entry => {
    if ((entry.kind !== 'vouch' && entry.kind !== 'slash') || !entry.author_handle || !Number.isFinite(entry.points)) return [];
    return [{
      kind: entry.kind,
      authorXId: entry.author_x_id,
      authorHandle: entry.author_handle.replace(/^@/, ''),
      authorAvatarUrl: entry.author_avatar_url,
      points: Number(entry.points),
      quote: entry.quote,
      tweetText: entry.tweet_text,
      tweetId: entry.tweet_id,
      tweetUrl: entry.tweet_url,
      tweetCreatedAt: entry.tweet_created_at,
    }];
  });

  return {
    userId: raw.user_id,
    display: raw.display,
    xHandle: raw.x_handle.replace(/^@/, ''),
    githubHandle: raw.github_handle ?? undefined,
    rank: raw.rank,
    entries,
    vouchTotal: Number(raw.vouch_total ?? 0),
    slashTotal: Number(raw.slash_total ?? 0),
    reputationPoints: Number(raw.reputation_points ?? 0),
    totalPoints: Number(raw.total_points ?? 0),
  };
}

function ledgerUrl(handle: string, boardVersion: number) {
  return `/game/events/${EVENT}/targets/${encodeURIComponent(handle)}/ledger?board_version=${boardVersion}`;
}

export async function getPublicLedger(handle: string): Promise<CommonsLedger | undefined> {
  const version = await safeCommonsFetch<VersionResponse>(`/game/events/${EVENT}/leaderboard/version`, 10);
  if (!version) return undefined;
  return normalizeLedger(await safeCommonsFetch<RawLedgerResponse>(ledgerUrl(handle.replace(/^@/, ''), version.board_version), 10));
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

  const cleanRequested = requestedUsername?.replace(/^@/, '').trim();
  const searchRequest = cleanRequested
    ? commonsFetch<SearchResponse>(
        `/game/events/${EVENT}/leaderboard/search?board_version=${boardVersion}&q=${encodeURIComponent(cleanRequested)}&limit=30`,
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

  let userLedger: CommonsLedger | undefined;
  const supporterLedgers: Record<string, CommonsLedger> = {};

  if (cleanRequested) {
    const requestedParticipant = Array.from(participantMap.values()).find(
      participant => participant.username.toLowerCase() === cleanRequested.toLowerCase(),
    );
    const canonicalHandle = requestedParticipant?.username ?? cleanRequested;
    userLedger = normalizeLedger(await safeCommonsFetch<RawLedgerResponse>(ledgerUrl(canonicalHandle, boardVersion), 30));

    if (userLedger) {
      const directSupporters = userLedger.entries
        .filter(entry => entry.kind === 'vouch' && entry.points > 0)
        .sort((a, b) => b.points - a.points)
        .filter((entry, index, arr) => arr.findIndex(other => other.authorHandle.toLowerCase() === entry.authorHandle.toLowerCase()) === index)
        .slice(0, MAX_DIRECT_SUPPORTERS);

      const ledgers = await Promise.all(
        directSupporters.map(async supporter => ({
          handle: supporter.authorHandle,
          ledger: normalizeLedger(await safeCommonsFetch<RawLedgerResponse>(ledgerUrl(supporter.authorHandle, boardVersion), 30)),
        })),
      );

      for (const item of ledgers) {
        if (item.ledger) supporterLedgers[item.handle.toLowerCase()] = item.ledger;
      }

      const observedWarmPower = new Map<string, { handle: string; power: number }>();
      for (const ledger of Object.values(supporterLedgers)) {
        for (const entry of ledger.entries) {
          if (entry.kind !== 'vouch' || entry.points <= 0) continue;
          const key = entry.authorHandle.toLowerCase();
          const existing = observedWarmPower.get(key);
          if (!existing || entry.points > existing.power) observedWarmPower.set(key, { handle: entry.authorHandle, power: entry.points });
        }
      }

      const directSet = new Set(directSupporters.map(entry => entry.authorHandle.toLowerCase()));
      const missingWarm = Array.from(observedWarmPower.values())
        .filter(item => !participantMap.has(item.handle.toLowerCase()))
        .filter(item => item.handle.toLowerCase() !== canonicalHandle.toLowerCase() && !directSet.has(item.handle.toLowerCase()))
        .sort((a, b) => b.power - a.power)
        .slice(0, MAX_WARM_SEARCHES);

      const warmSearches = await Promise.all(
        missingWarm.map(item => safeCommonsFetch<SearchResponse>(
          `/game/events/${EVENT}/leaderboard/search?board_version=${boardVersion}&q=${encodeURIComponent(item.handle)}&limit=5`,
          30,
        )),
      );

      for (const result of warmSearches) {
        for (const raw of result?.entries ?? []) {
          const participant = normalizeEntry(raw);
          if (participant) participantMap.set(participant.username.toLowerCase(), participant);
        }
      }
    }
  }

  const participants = Array.from(participantMap.values()).sort((a, b) => a.rank - b.rank);
  if (!participants.length) throw new CommonsDataError('The Commons response contained no valid participants.');

  const cutoffParticipant = participants.find(participant => participant.rank === GAME.targetRank);
  if (!cutoffParticipant) throw new CommonsDataError('The live snapshot did not include rank 1000.');

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
    upstreamUpdatedAt: undefined,
    fetchedAt,
    source: 'api.commonsmade.com',
    userLedger,
    supporterLedgers: Object.keys(supporterLedgers).length ? supporterLedgers : undefined,
  };

  await recordSnapshot(snapshot);
  return snapshot;
}
