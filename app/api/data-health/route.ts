import { NextResponse } from 'next/server';
import { CommonsDataError, getCommonsSnapshot } from '@/lib/commons';
import { GAME } from '@/lib/config';

export async function GET() {
  try {
    const snapshot = await getCommonsSnapshot();
    return NextResponse.json({
      status: 'ok',
      source: snapshot.source,
      participants: snapshot.participants.length,
      cutoff1000: snapshot.cutoffRank1000,
      rank500: snapshot.participants.find(participant => participant.rank === 500)?.totalScore ?? 0,
      rank750: snapshot.participants.find(participant => participant.rank === 750)?.totalScore ?? 0,
      rank900: snapshot.participants.find(participant => participant.rank === 900)?.totalScore ?? 0,
      upstreamUpdatedAt: snapshot.upstreamUpdatedAt ?? null,
      fetchedAt: snapshot.fetchedAt,
      vouchLimit: GAME.defaultVouches,
      slashLimit: GAME.defaultSlashes,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unavailable',
      source: 'commonsmade.com',
      error: error instanceof CommonsDataError ? error.message : 'Commons data unavailable.',
    }, { status: 503 });
  }
}
