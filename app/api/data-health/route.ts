import { NextResponse } from 'next/server';
import { CommonsDataError, getCommonsSnapshot } from '@/lib/commons';

export async function GET() {
  try {
    const snapshot = await getCommonsSnapshot('CyphrGM');
    const cyphrgm = snapshot.participants.find(participant => participant.username.toLowerCase() === 'cyphrgm');
    return NextResponse.json({
      status: 'ok',
      source: snapshot.source,
      boardVersion: snapshot.boardVersion ?? null,
      participants: snapshot.totalParticipants ?? snapshot.participants.length,
      entriesLoaded: snapshot.participants.length,
      cutoff1000: snapshot.cutoffRank1000,
      rank500: snapshot.participants.find(participant => participant.rank === 500)?.totalScore ?? 0,
      rank750: snapshot.participants.find(participant => participant.rank === 750)?.totalScore ?? 0,
      rank900: snapshot.participants.find(participant => participant.rank === 900)?.totalScore ?? 0,
      cyphrgm: cyphrgm ? {
        rank: cyphrgm.rank,
        base: cyphrgm.baseScore,
        reputation: cyphrgm.reputationScore ?? null,
        total: cyphrgm.totalScore,
      } : null,
      upstreamUpdatedAt: snapshot.upstreamUpdatedAt ?? null,
      fetchedAt: snapshot.fetchedAt,
      vouchLimit: snapshot.vouchLimit ?? null,
      slashLimit: snapshot.slashLimit ?? null,
      nextSupplyAt: snapshot.nextSupplyAt ?? null,
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
