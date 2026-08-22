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
// Matched on word boundaries, not raw substrings: a bare /end|clos|until|expir/
// also hits `attendees`, `calendar` and `token_expires_at`, any of which would be
// read as the experiment's close time. Boundaries still allow the common shapes
// (`ends_at`, `event_end_at`, `endsAt`), so discovery keeps working.
const CLOSE_KEY=/(^|_)(ends?|ended|closes?|closed|closing|finish(es|ed)?|deadline)(_|$)/i;
const OPEN_KEY=/(^|_)(starts?|started|opens?|opened|opening|begins?|began|launch(es|ed)?)(_|$)/i;
const snake=(key:string)=>key.replace(/([a-z0-9])([A-Z])/g,'$1_$2');
const MAX_WINDOW_MS=90*864e5;

function collectDatesByKey(value:unknown,pattern:RegExp,found:string[]=[],depth=0):string[]{
  if(!value||typeof value!=='object'||depth>4)return found;
  for(const [key,entry] of Object.entries(value as Record<string,unknown>)){
    if(pattern.test(snake(key))){const iso=toIsoDate(entry);if(iso)found.push(iso)}
  }
  for(const entry of Object.values(value as Record<string,unknown>)) collectDatesByKey(entry,pattern,found,depth+1);
  return found;
}

/** A discovered close time is only usable if it is plausibly this experiment's:
 *  still ahead of us, and not absurdly far out. Anything else degrades to TBC —
 *  discovery must never be able to declare the experiment over. */
function plausibleClose(iso:string|undefined,now:number):string|undefined{
  if(!iso)return undefined;
  const t=Date.parse(iso);
  return Number.isFinite(t)&&t>now+60_000&&t<now+MAX_WINDOW_MS?iso:undefined;
}

// The experiment window: env vars win; otherwise best-effort discovery from the
// Commons event metadata, cached for 30 minutes. Absent both, the UI shows TBC.
let windowCache:{at:number;closesAt?:string;opensAt?:string}|undefined;
export async function getExperimentWindow():Promise<{closesAt?:string;opensAt?:string}>{
  const envClose=process.env.NEXT_PUBLIC_COMMONS_CLOSE_AT||undefined;
  const envOpen=process.env.NEXT_PUBLIC_COMMONS_OPEN_AT||undefined;
  if(envClose&&envOpen)return {closesAt:envClose,opensAt:envOpen};
  if(!windowCache||Date.now()-windowCache.at>=30*60_000){
    const now=Date.now();
    let closesAt:string|undefined,opensAt:string|undefined;
    for(const path of [`/game/events/${EVENT}`,'/game/events']){
      try{
        const payload=await commons<unknown>(path);
        // Earliest plausible future close, not merely the first key encountered.
        const closes=collectDatesByKey(payload,CLOSE_KEY).map(iso=>plausibleClose(iso,now)).filter(Boolean) as string[];
        const candidate=closes.sort()[0];
        if(candidate){
          closesAt=candidate;
          opensAt=collectDatesByKey(payload,OPEN_KEY).filter(iso=>Date.parse(iso)<Date.parse(candidate)).sort()[0];
          break;
        }
      }catch{}
    }
    windowCache={at:Date.now(),closesAt,opensAt};
  }
  // Re-checked on read: a date that was future when cached can elapse inside the
  // 30-minute window. An operator-set close time is authoritative and may pass.
  return {
    closesAt:envClose??plausibleClose(windowCache.closesAt,Date.now()),
    opensAt:envOpen??windowCache.opensAt,
  };
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

/** What the browser actually renders: at most a few dozen ledger rows, and no
 *  `history` (computed but never displayed). Shipping the raw state re-sends the
 *  entire ledger to every viewer every 4 seconds. */
const TAPE_LIMIT=40;
export function forClient(state:StrategyState){
  const {history:_history,...rest}=state;
  return {...rest,tape:state.tape.slice(0,TAPE_LIMIT)};
}

// One upstream round-trip is shared by every viewer polling in the same window,
// and concurrent requests join the in-flight fetch instead of starting their own.
const STATE_TTL_MS=3000;
let stateCache:{at:number;value:StrategyState}|undefined;
let statePending:Promise<StrategyState>|undefined;
export async function getCachedCommonStrategyState():Promise<StrategyState>{
  if(stateCache&&Date.now()-stateCache.at<STATE_TTL_MS)return stateCache.value;
  if(statePending)return statePending;
  statePending=getCommonStrategyState()
    .then(value=>{stateCache={at:Date.now(),value};return value})
    .finally(()=>{statePending=undefined});
  return statePending;
}

export async function getPotentialVouch(handle:string){
  const query=handle.replace(/^@/,'').trim();
  if(!query) return null;
  const version=await commons<VersionResponse>(`/game/events/${EVENT}/leaderboard/version`);
  const search=await commons<SearchResponse>(`/game/events/${EVENT}/leaderboard/search?board_version=${version.board_version}&q=${encodeURIComponent(query)}&limit=20`);
  const exact=(search.entries??[]).find(entry=>clean(entry.x_handle??'')===clean(query));
  if(!exact) return null;
  const state=await getCachedCommonStrategyState();
  const power=exact.base_points*0.35;
  const poolAfter=state.positiveVouchPoints+power;
  return {
    handle:(exact.x_handle||query).replace(/^@/,''), rank:exact.rank, basePoints:exact.base_points, power,
    shareAfter:poolAfter>0?power/poolAfter:1,
    poolAfter,
  };
}
