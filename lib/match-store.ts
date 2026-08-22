import 'server-only';

export type MatchProfile = {
  handle: string;
  remaining?: number;
  goal?: 'GET_IN' | 'CLIMB' | 'MAX_SCORE';
  rank?: number;
  power?: number;
  updatedAt: number;
};

export type MatchDeal = {
  id: string;
  a: string;
  b: string;
  createdAt: number;
  aDone?: boolean;
  bDone?: boolean;
  clearedAt?: number;
};

type RedisResult = { result?: unknown; error?: string };

const redisUrl = process.env.KV_REST_API_URL;
const redisToken = process.env.KV_REST_API_TOKEN;

export const matchmakingEnabled = Boolean(redisUrl && redisToken);

async function redis(commands: (string | number)[][]): Promise<unknown[]> {
  if (!redisUrl || !redisToken) return commands.map(() => null);
  const res = await fetch(`${redisUrl}/pipeline`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${redisToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(commands),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Match store returned ${res.status}`);
  const data = await res.json() as RedisResult[];
  return data.map(item => item.result ?? null);
}

const clean = (handle: string) => handle.replace(/^@/, '').trim().toLowerCase();
const profileKey = (h: string) => `gto:match:profile:${clean(h)}`;
const likesKey = (h: string) => `gto:match:likes:${clean(h)}`;
const likedByKey = (h: string) => `gto:match:likedby:${clean(h)}`;
const passesKey = (h: string) => `gto:match:passes:${clean(h)}`;
const matchesKey = (h: string) => `gto:match:matches:${clean(h)}`;
const statsKey = (h: string) => `gto:match:stats:${clean(h)}`;
const dealKey = (a: string, b: string) => `gto:match:deal:${[clean(a), clean(b)].sort().join(':')}`;
const ACTIVE_KEY = 'gto:match:active';
const ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

export async function joinMatchPool(profile: Omit<MatchProfile, 'updatedAt'>) {
  if (!matchmakingEnabled) return { enabled: false };
  const now = Date.now();
  const next: MatchProfile = { ...profile, handle: clean(profile.handle), updatedAt: now };
  await redis([
    ['SET', profileKey(next.handle), JSON.stringify(next)],
    ['ZADD', ACTIVE_KEY, now, next.handle],
    ['ZREMRANGEBYSCORE', ACTIVE_KEY, 0, now - ACTIVE_WINDOW_MS],
  ]);
  return { enabled: true, profile: next };
}

export async function setRemaining(handle: string, remaining: number) {
  if (!matchmakingEnabled) return;
  const [raw] = await redis([['GET', profileKey(handle)]]);
  let profile: MatchProfile = { handle: clean(handle), updatedAt: Date.now() };
  if (typeof raw === 'string') {
    try { profile = JSON.parse(raw) as MatchProfile; } catch {}
  }
  profile.remaining = Math.max(0, Math.floor(remaining));
  profile.updatedAt = Date.now();
  await redis([['SET', profileKey(handle), JSON.stringify(profile)], ['ZADD', ACTIVE_KEY, profile.updatedAt, clean(handle)]]);
}

export async function swipe(actor: string, target: string, verdict: 'VOUCH' | 'PASS') {
  if (!matchmakingEnabled) return { enabled: false, matched: false };
  const a = clean(actor), b = clean(target);
  if (!a || !b || a === b) return { enabled: true, matched: false };
  if (verdict === 'PASS') {
    await redis([['SADD', passesKey(a), b], ['ZADD', ACTIVE_KEY, Date.now(), a]]);
    return { enabled: true, matched: false };
  }

  const now = Date.now();
  await redis([
    ['SADD', likesKey(a), b],
    ['SADD', likedByKey(b), a],
    ['ZADD', ACTIVE_KEY, now, a],
  ]);
  const [reciprocal] = await redis([['SISMEMBER', likesKey(b), a]]);
  const matched = Number(reciprocal) === 1;
  if (!matched) return { enabled: true, matched: false };

  const id = [a, b].sort().join('--');
  const key = dealKey(a, b);
  const [existing] = await redis([['GET', key]]);
  let deal: MatchDeal;
  if (typeof existing === 'string') {
    try { deal = JSON.parse(existing) as MatchDeal; }
    catch { deal = { id, a, b, createdAt: now }; }
  } else deal = { id, a, b, createdAt: now };

  await redis([
    ['SET', key, JSON.stringify(deal)],
    ['SADD', matchesKey(a), b],
    ['SADD', matchesKey(b), a],
  ]);
  return { enabled: true, matched: true, deal };
}

async function getProfiles(handles: string[]) {
  const unique = [...new Set(handles.map(clean).filter(Boolean))];
  if (!unique.length || !matchmakingEnabled) return {} as Record<string, MatchProfile>;
  const values = await redis(unique.map(h => ['GET', profileKey(h)]));
  const out: Record<string, MatchProfile> = {};
  unique.forEach((h, i) => {
    if (typeof values[i] !== 'string') return;
    try { out[h] = JSON.parse(values[i] as string) as MatchProfile; } catch {}
  });
  return out;
}

export async function getMatchState(actor: string) {
  if (!matchmakingEnabled) return { enabled: false, active: [], likes: [], incoming: [], passes: [], matches: [], deals: [], profiles: {}, stats: {} };
  const a = clean(actor);
  const min = Date.now() - ACTIVE_WINDOW_MS;
  const [activeRaw, likesRaw, incomingRaw, passesRaw, matchesRaw, statsRaw] = await redis([
    ['ZRANGEBYSCORE', ACTIVE_KEY, min, '+inf'],
    ['SMEMBERS', likesKey(a)],
    ['SMEMBERS', likedByKey(a)],
    ['SMEMBERS', passesKey(a)],
    ['SMEMBERS', matchesKey(a)],
    ['HGETALL', statsKey(a)],
  ]);
  const active = Array.isArray(activeRaw) ? activeRaw.map(String) : [];
  const likes = Array.isArray(likesRaw) ? likesRaw.map(String) : [];
  const incoming = Array.isArray(incomingRaw) ? incomingRaw.map(String) : [];
  const passes = Array.isArray(passesRaw) ? passesRaw.map(String) : [];
  const matches = Array.isArray(matchesRaw) ? matchesRaw.map(String) : [];
  const profiles = await getProfiles([...active, ...matches]);
  const dealValues = matches.length ? await redis(matches.map(h => ['GET', dealKey(a, h)])) : [];
  const deals = dealValues.flatMap(value => {
    if (typeof value !== 'string') return [];
    try { return [JSON.parse(value) as MatchDeal]; } catch { return []; }
  });
  const stats: Record<string, number> = {};
  if (Array.isArray(statsRaw)) {
    for (let i = 0; i < statsRaw.length; i += 2) stats[String(statsRaw[i])] = Number(statsRaw[i + 1] ?? 0);
  }
  return { enabled: true, active, likes, incoming, passes, matches, deals, profiles, stats };
}

export async function markDealSideVerified(actor: string, target: string) {
  if (!matchmakingEnabled) return { enabled: false };
  const a = clean(actor), b = clean(target), key = dealKey(a, b);
  const [raw] = await redis([['GET', key]]);
  if (typeof raw !== 'string') return { enabled: true, found: false };
  let deal: MatchDeal;
  try { deal = JSON.parse(raw) as MatchDeal; } catch { return { enabled: true, found: false }; }
  if (deal.a === a) deal.aDone = true;
  if (deal.b === a) deal.bDone = true;
  const wasCleared = Boolean(deal.clearedAt);
  if (deal.aDone && deal.bDone && !deal.clearedAt) deal.clearedAt = Date.now();
  const commands: (string | number)[][] = [['SET', key, JSON.stringify(deal)]];
  if (deal.clearedAt && !wasCleared) {
    commands.push(['HINCRBY', statsKey(deal.a), 'completed', 1]);
    commands.push(['HINCRBY', statsKey(deal.b), 'completed', 1]);
  }
  await redis(commands);
  return { enabled: true, found: true, deal };
}
