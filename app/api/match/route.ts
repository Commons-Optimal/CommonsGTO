import { NextRequest, NextResponse } from 'next/server';
import { getPublicLedger } from '@/lib/commons';
import {
  getMatchState,
  joinMatchPool,
  markDealSideVerified,
  matchmakingEnabled,
  setRemaining,
  swipe,
} from '@/lib/match-store';

const clean = (value: unknown) => String(value ?? '').replace(/^@/, '').trim().toLowerCase();

export async function GET(request: NextRequest) {
  const actor = clean(request.nextUrl.searchParams.get('actor'));
  if (!actor) return NextResponse.json({ enabled: matchmakingEnabled, error: 'actor required' }, { status: 400 });
  const state = await getMatchState(actor);
  return NextResponse.json(state, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const actor = clean(body.actor);
  if (!actor) return NextResponse.json({ enabled: matchmakingEnabled, error: 'actor required' }, { status: 400 });

  if (action === 'join') {
    const remaining = body.remaining === undefined ? undefined : Number(body.remaining);
    const goal = body.goal === 'GET_IN' || body.goal === 'MAX_SCORE' ? body.goal : 'CLIMB';
    const result = await joinMatchPool({
      handle: actor,
      remaining: Number.isFinite(remaining) ? Math.max(0, Math.floor(remaining)) : undefined,
      goal,
      rank: Number.isFinite(Number(body.rank)) ? Number(body.rank) : undefined,
      power: Number.isFinite(Number(body.power)) ? Number(body.power) : undefined,
    });
    return NextResponse.json(result);
  }

  if (action === 'remaining') {
    const value = Number(body.remaining);
    if (!Number.isFinite(value) || value < 0 || value > 20) return NextResponse.json({ error: 'invalid remaining' }, { status: 400 });
    await setRemaining(actor, value);
    return NextResponse.json({ enabled: matchmakingEnabled, remaining: Math.floor(value) });
  }

  if (action === 'swipe') {
    const target = clean(body.target);
    const verdict = body.verdict === 'VOUCH' ? 'VOUCH' : 'PASS';
    if (!target) return NextResponse.json({ error: 'target required' }, { status: 400 });
    return NextResponse.json(await swipe(actor, target, verdict));
  }

  if (action === 'verify') {
    const target = clean(body.target);
    if (!target) return NextResponse.json({ error: 'target required' }, { status: 400 });
    const ledger = await getPublicLedger(target);
    const state = await getMatchState(actor);
    const deal = state.deals.find(item => item.a === target || item.b === target);
    if (!deal) return NextResponse.json({ enabled: matchmakingEnabled, verified: false, reason: 'deal not found' });
    const verified = Boolean(ledger?.entries.some(entry => {
      if (entry.kind !== 'vouch' || entry.authorHandle.toLowerCase() !== actor) return false;
      const created = entry.tweetCreatedAt ? new Date(entry.tweetCreatedAt).getTime() : 0;
      return created >= deal.createdAt - 60_000;
    }));
    if (!verified) return NextResponse.json({ enabled: matchmakingEnabled, verified: false });
    const result = await markDealSideVerified(actor, target);
    return NextResponse.json({ ...result, verified: true });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
