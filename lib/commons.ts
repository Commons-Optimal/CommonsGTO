import 'server-only';
import { GAME } from './config';
import type { CommonsSnapshot, Interaction, Participant } from './types';
import { recordSnapshot } from './history';

export class CommonsDataError extends Error {}
type Json = Record<string, unknown>;

const finite = (value: unknown) => {
  const n = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
  return Number.isFinite(n) ? n : undefined;
};
const pick = (row: Json, keys: string[]) => keys.map(k => row[k]).find(v => v !== undefined);
const interactions = (value: unknown): Interaction[] | undefined => Array.isArray(value) ? value.flatMap(item => {
  if (!item || typeof item !== 'object') return [];
  const r = item as Json, from = String(pick(r, ['from','fromUsername','sender']) ?? ''), to = String(pick(r, ['to','toUsername','recipient']) ?? '');
  return from && to ? [{ from, to, value: finite(r.value), timestamp: typeof r.timestamp === 'string' ? r.timestamp : undefined }] : [];
}) : undefined;

function normalizeParticipant(value: unknown, index: number): Participant | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Json;
  const username = String(pick(row, ['username','handle','xUsername','name']) ?? '').replace(/^@/, '').trim();
  const baseScore = finite(pick(row, ['baseScore','base_score','basePoints','base_points']));
  const totalScore = finite(pick(row, ['totalScore','total_score','score','points']));
  const rank = finite(pick(row, ['rank','position'])) ?? index + 1;
  if (!username || baseScore === undefined || totalScore === undefined || rank < 1) return null;
  return {
    username, baseScore, totalScore, rank,
    vouchersUsed: finite(pick(row, ['vouchersUsed','vouchesUsed','vouches_used'])),
    vouchesRemaining: finite(pick(row, ['vouchesRemaining','vouches_remaining'])),
    slashesUsed: finite(pick(row, ['slashesUsed','slashes_used'])),
    slashesRemaining: finite(pick(row, ['slashesRemaining','slashes_remaining'])),
    vouchesReceived: interactions(pick(row, ['vouchesReceived','vouches_received'])),
    slashesReceived: interactions(pick(row, ['slashesReceived','slashes_received'])),
  };
}

export async function getCommonsSnapshot(): Promise<CommonsSnapshot> {
  const url = process.env.COMMONS_API_URL;
  if (!url) throw new CommonsDataError('The Commons data source is not configured.');
  let response: Response;
  try {
    response = await fetch(url, {
      headers: process.env.COMMONS_API_TOKEN ? { authorization: `Bearer ${process.env.COMMONS_API_TOKEN}` } : undefined,
      next: { revalidate: GAME.cacheSeconds }, signal: AbortSignal.timeout(12_000),
    });
  } catch { throw new CommonsDataError('The Commons source could not be reached.'); }
  if (!response.ok) throw new CommonsDataError(`The Commons source returned ${response.status}.`);
  const payload = await response.json() as Json | unknown[];
  const root = Array.isArray(payload) ? {} as Json : payload;
  const raw = Array.isArray(payload) ? payload : pick(root, ['participants','leaderboard','users','data']);
  const nested = raw && !Array.isArray(raw) && typeof raw === 'object' ? pick(raw as Json, ['participants','leaderboard','users','data']) : raw;
  if (!Array.isArray(nested)) throw new CommonsDataError('The Commons response did not contain a participant list.');
  const participants = nested.map(normalizeParticipant).filter((p): p is Participant => Boolean(p)).sort((a,b) => a.rank-b.rank);
  if (!participants.length) throw new CommonsDataError('The Commons response contained no valid participants.');
  const cutoffParticipant = participants.find(p => p.rank === GAME.targetRank) ?? participants[GAME.targetRank - 1];
  const explicitCutoff = finite(pick(root, ['cutoffRank1000','cutoff','qualificationCutoff']));
  const cutoffRank1000 = explicitCutoff ?? cutoffParticipant?.totalScore;
  if (cutoffRank1000 === undefined) throw new CommonsDataError('The live snapshot does not include enough ranks to establish the cutoff.');
  const updated = pick(root, ['updatedAt','snapshotAt','timestamp']);
  const snapshot={ participants, cutoffRank1000, upstreamUpdatedAt: typeof updated === 'string' ? updated : undefined, fetchedAt: new Date().toISOString(), source: new URL(url).hostname };
  await recordSnapshot(snapshot);
  return snapshot;
}
