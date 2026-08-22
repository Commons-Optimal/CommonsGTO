import 'server-only';
import type { CommonsSnapshot } from './types';

export type HistoricalPoint = { timestamp:string; participantCount:number; cutoffRank1000:number; selectedLeaderboardValues:{rank:number;score:number}[] };

/** Persists real snapshots when a Vercel/Upstash KV REST binding is present. No fallback data is created. */
export async function recordSnapshot(snapshot:CommonsSnapshot) {
  const url=process.env.KV_REST_API_URL, token=process.env.KV_REST_API_TOKEN;
  if(!url||!token) return;
  const point:HistoricalPoint={timestamp:snapshot.upstreamUpdatedAt??snapshot.fetchedAt,participantCount:snapshot.participants.length,cutoffRank1000:snapshot.cutoffRank1000,selectedLeaderboardValues:[1,100,500,1000].flatMap(rank=>{const p=snapshot.participants.find(x=>x.rank===rank);return p?[{rank,score:p.totalScore}]:[]})};
  await fetch(`${url}/pipeline`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify([['LPUSH','commons:gto:snapshots',JSON.stringify(point)],['LTRIM','commons:gto:snapshots','0','2015']]),cache:'no-store'}).catch(()=>undefined);
}
