import 'server-only';

type VersionResponse = { board_version:number; total_entries:number; total_participants:number };
type SearchEntry = {
  rank:number; user_id:string; joined:boolean; display:string; x_handle:string|null;
  avatar_url:string|null; base_points:number; multiplier:number; reputation_points:number; total_points:number;
};
type SearchResponse = { board_version:number; query:string; entries:SearchEntry[] };
type LedgerEntry = {
  kind?:'vouch'|'slash'|string; author_handle?:string; author_avatar_url?:string; points?:number;
  tweet_id?:string; tweet_url?:string; tweet_created_at?:string; tweet_text?:string;
};
type LedgerResponse = {
  x_handle?:string; display?:string; rank?:number; entries?:LedgerEntry[];
  vouch_total?:number; slash_total?:number; reputation_points?:number; total_points?:number;
};

const API='https://api.commonsmade.com';
const EVENT='genesis';
export const COMMON_STRATEGY_HANDLE=(process.env.COMMON_STRATEGY_HANDLE || 'commonstrat').replace(/^@/,'');

async function commons<T>(path:string):Promise<T>{
  const response=await fetch(`${API}${path}`,{headers:{accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(10_000)});
  if(!response.ok) throw new Error(`Commons returned ${response.status}`);
  return response.json() as Promise<T>;
}

function clean(handle:string){return handle.replace(/^@/,'').trim().toLowerCase()}

const DATE_FLOOR=Date.parse('2025-06-01');
function toIsoDate(value:unknown):string|undefined{
  if(typeof value==='number'&&Number.isFinite(value)){
    const ms=value>1e12?value:value>1e9?value*1000:NaN;
    if(Number.isFinite(ms)&&ms>DATE_FLOOR)return new Date(ms).toISOString();
  }
  if(typeof value==='string'){
    if(/^\d{10,13}$/.test(value))return toIsoDate(Number(value));
    if(/\d{4}-\d{2}-\d{2}/.test(value)){
      const t=Date.parse(value);
      if(Number.isFinite(t)&&t>DATE_FLOOR)return new Date(t).toISOString();
    }
  }
  return undefined;
}
function findDateByKey(value:unknown,pattern:RegExp,depth=0):string|undefined{
  if(!value||typeof value!=='object'||depth>4)return undefined;
  const record=value as Record<string,unknown>;
  for(const [key,entry] of Object.entries(record)){
    if(pattern.test(key)){const iso=toIsoDate(entry);if(iso)return iso}
  }
  for(const entry of Object.values(record)){
    const nested=findDateByKey(entry,pattern,depth+1);
    if(nested)return nested;
  }
  return undefined;
}

// The experiment window: env vars win; otherwise best-effort discovery from the
// Commons event metadata, cached for 30 minutes. Absent both, the UI shows TBC.
let windowCache:{at:number;closesAt?:string;opensAt?:string}|undefined;
export async function getExperimentWindow():Promise<{closesAt?:string;opensAt?:string}>{
  const envClose=process.env.NEXT_PUBLIC_COMMONS_CLOSE_AT||undefined;
  const envOpen=process.env.NEXT_PUBLIC_COMMONS_OPEN_AT||undefined;
  if(envClose&&envOpen)return {closesAt:envClose,opensAt:envOpen};
  if(!windowCache||Date.now()-windowCache.at>=30*60_000){
    let closesAt:string|undefined,opensAt:string|undefined;
    for(const path of [`/game/events/${EVENT}`,'/game/events']){
      try{
        const payload=await commons<unknown>(path);
        closesAt=findDateByKey(payload,/end|clos|finish|deadline|until|expir/i);
        opensAt=findDateByKey(payload,/start|open|begin|launch/i);
        if(closesAt)break;
      }catch{}
    }
    windowCache={at:Date.now(),closesAt,opensAt};
  }
  return {closesAt:envClose??windowCache.closesAt,opensAt:envOpen??windowCache.opensAt};
}

export type StrategyOwner={
  handle:string; avatarUrl?:string; points:number; share:number; lastAt?:string; tweetUrl?:string;
};
export type StrategyTapeEntry={
  id:string; kind:'vouch'|'slash'; handle:string; avatarUrl?:string; points:number; at?:string; tweetUrl?:string;
};
export type StrategyHistoryPoint={at:string; score:number; delta:number; handle:string; kind:'vouch'|'slash'};
export type StrategyState={
  handle:string; display:string; avatarUrl?:string; rank:number; basePoints:number; reputationPoints:number; totalPoints:number;
  boardVersion:number; totalParticipants:number; totalEntries:number; positiveVouchPoints:number; voucherCount:number;
  owners:StrategyOwner[]; tape:StrategyTapeEntry[]; history:StrategyHistoryPoint[]; fetchedAt:string;
  closesAt:string|null; opensAt:string|null;
};

export async function getCommonStrategyState():Promise<StrategyState>{
  const fetchedAt=new Date().toISOString();
  const experimentWindow=await getExperimentWindow();
  const version=await commons<VersionResponse>(`/game/events/${EVENT}/leaderboard/version`);
  const search=await commons<SearchResponse>(`/game/events/${EVENT}/leaderboard/search?board_version=${version.board_version}&q=${encodeURIComponent(COMMON_STRATEGY_HANDLE)}&limit=20`);
  const exact=(search.entries??[]).find(entry=>clean(entry.x_handle??'')===clean(COMMON_STRATEGY_HANDLE));
  if(!exact) throw new Error(`@${COMMON_STRATEGY_HANDLE} is not on the Commons leaderboard yet.`);

  const canonical=(exact.x_handle||COMMON_STRATEGY_HANDLE).replace(/^@/,'');
  const ledger=await commons<LedgerResponse>(`/game/events/${EVENT}/targets/${encodeURIComponent(canonical)}/ledger?board_version=${version.board_version}`);
  const rows=(ledger.entries??[]).flatMap((entry,index)=>{
    if((entry.kind!=='vouch'&&entry.kind!=='slash')||!entry.author_handle||!Number.isFinite(Number(entry.points))) return [];
    const points=Number(entry.points);
    return [{
      id:entry.tweet_id || `${entry.kind}-${entry.author_handle}-${entry.tweet_created_at??index}`,
      kind:entry.kind as 'vouch'|'slash',
      handle:entry.author_handle.replace(/^@/,''),
      avatarUrl:entry.author_avatar_url,
      points,
      at:entry.tweet_created_at,
      tweetUrl:entry.tweet_url,
    } satisfies StrategyTapeEntry];
  });

  const positive=rows.filter(row=>row.kind==='vouch'&&row.points>0);
  const positiveVouchPoints=positive.reduce((sum,row)=>sum+row.points,0);
  const ownerMap=new Map<string,{handle:string;avatarUrl?:string;points:number;lastAt?:string;tweetUrl?:string}>();
  for(const row of positive){
    const key=clean(row.handle), prev=ownerMap.get(key);
    ownerMap.set(key,{
      handle:prev?.handle??row.handle,
      avatarUrl:row.avatarUrl??prev?.avatarUrl,
      points:(prev?.points??0)+row.points,
      lastAt:!prev?.lastAt || (row.at&&row.at>prev.lastAt) ? row.at : prev.lastAt,
      tweetUrl:row.tweetUrl??prev?.tweetUrl,
    });
  }
  const owners=Array.from(ownerMap.values()).map(owner=>({...owner,share:positiveVouchPoints>0?owner.points/positiveVouchPoints:0})).sort((a,b)=>b.points-a.points);

  const chronological=[...rows].filter(row=>row.at).sort((a,b)=>(a.at??'').localeCompare(b.at??''));
  let running=exact.base_points;
  const history:StrategyHistoryPoint[]=chronological.map(row=>{
    running+=row.points;
    return {at:row.at!,score:running,delta:row.points,handle:row.handle,kind:row.kind};
  });

  return {
    handle:canonical,
    display:exact.display||'Common Strategy',
    avatarUrl:exact.avatar_url??undefined,
    rank:exact.rank,
    basePoints:exact.base_points,
    reputationPoints:exact.reputation_points,
    totalPoints:exact.total_points,
    boardVersion:version.board_version,
    totalParticipants:version.total_participants,
    totalEntries:version.total_entries,
    positiveVouchPoints,
    voucherCount:owners.length,
    owners,
    tape:[...rows].sort((a,b)=>(b.at??'').localeCompare(a.at??'')),
    history,
    fetchedAt,
    closesAt:experimentWindow.closesAt??null,
    opensAt:experimentWindow.opensAt??null,
  };
}

export async function getPotentialVouch(handle:string){
  const query=handle.replace(/^@/,'').trim();
  if(!query) return null;
  const version=await commons<VersionResponse>(`/game/events/${EVENT}/leaderboard/version`);
  const search=await commons<SearchResponse>(`/game/events/${EVENT}/leaderboard/search?board_version=${version.board_version}&q=${encodeURIComponent(query)}&limit=20`);
  const exact=(search.entries??[]).find(entry=>clean(entry.x_handle??'')===clean(query));
  if(!exact) return null;
  const state=await getCommonStrategyState();
  const power=exact.base_points*0.35;
  const poolAfter=state.positiveVouchPoints+power;
  return {
    handle:(exact.x_handle||query).replace(/^@/,''), rank:exact.rank, basePoints:exact.base_points, power,
    shareAfter:poolAfter>0?power/poolAfter:1,
    poolAfter,
  };
}
