import { NextResponse } from 'next/server';
import { CommonsDataError, getCommonsMeta } from '@/lib/commons';

export async function GET() {
  try {
    const snapshot = await getCommonsMeta();
    return NextResponse.json({
      status: 'ok',
      source: snapshot.source,
      participants: snapshot.totalParticipants ?? 0,
      entries: snapshot.totalEntries ?? 0,
      boardVersion: snapshot.boardVersion ?? null,
      cutoff1000: snapshot.cutoffRank1000,
      rank500: snapshot.rankScores?.[500] ?? 0,
      rank750: snapshot.rankScores?.[750] ?? 0,
      rank900: snapshot.rankScores?.[900] ?? 0,
      fetchedAt: snapshot.fetchedAt,
      vouchLimit: snapshot.vouchLimit ?? null,
      slashLimit: snapshot.slashLimit ?? null,
      nextSupplyIncreaseAt: snapshot.nextSupplyIncreaseAt ?? null,
      nextVouchLimit: snapshot.nextVouchLimit ?? null,
      nextSlashLimit: snapshot.nextSlashLimit ?? null,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unavailable',
      source: 'api.commonsmade.com',
      error: error instanceof CommonsDataError ? error.message : 'Commons data unavailable.',
    }, { status: 503 });
  }
}
