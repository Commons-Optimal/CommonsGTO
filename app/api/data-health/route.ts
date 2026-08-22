import { NextResponse } from 'next/server';
import { CommonsDataError, getCommonsSnapshot } from '@/lib/commons';

export async function GET() {
  try {
    const snapshot = await getCommonsSnapshot();
    return NextResponse.json({
      status: 'ok',
      source: snapshot.source,
      participants: snapshot.participants.length,
      cutoff1000: snapshot.cutoffRank1000,
      upstreamUpdatedAt: snapshot.upstreamUpdatedAt ?? null,
      fetchedAt: snapshot.fetchedAt,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unavailable',
      source: 'commonsmade.com',
      error: error instanceof CommonsDataError ? error.message : 'Commons data unavailable.',
    }, { status: 503 });
  }
}
