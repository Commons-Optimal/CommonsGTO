'use client';

import { CSSProperties, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';

type Owner={handle:string;avatarUrl?:string;points:number;share:number;lastAt?:string;tweetUrl?:string};
type Tape={id:string;kind:'vouch'|'slash';handle:string;avatarUrl?:string;points:number;at?:string;tweetUrl?:string};
type History={at:string;score:number;delta:number;handle:string;kind:'vouch'|'slash'};
export type StrategyState={handle:string;display:string;avatarUrl?:string;rank:number;basePoints:number;reputationPoints:number;totalPoints:number;boardVersion:number;totalParticipants:number;totalEntries:number;positiveVouchPoints:number;voucherCount:number;owners:Owner[];tape:Tape[];history:History[];fetchedAt:string;closesAt?:string|null;opensAt?:string|null};
type Quote={handle:string;rank:number;basePoints:number;power:number;shareAfter:number;poolAfter:number};
type Slice=
  |{type:'owner';handle:string;points:number;share:number;lastAt?:string}
  |{type:'quote';handle:string;rank:number;power:number;shareAfter:number;poolAfter:number};

const nf=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const compact=(n:number)=>Math.abs(n)>=1_000_000?`${(n/1_000_000).toFixed(2)}M`:Math.abs(n)>=10_000?`${(n/1000).toFixed(1)}K`:nf.format(Math.round(n));
const pct=(n:number,d=2)=>`${(n*100).toFixed(d)}%`;
const clean=(s:string)=>s.replace(/^@/,'').trim().toLowerCase();
const two=(n:number)=>String(Math.max(0,n)).padStart(2,'0');

const CLOSE_AT=process.env.NEXT_PUBLIC_COMMONS_CLOSE_AT;
const OPEN_AT=process.env.NEXT_PUBLIC_COMMONS_OPEN_AT;

const SEGMENT_COLORS=['#c9ff70','#a8d95e','#86b452','#648f45','#486b38','#33502c','#274023'];
const OTHERS_COLOR='#1d2e20';

function AnimatedNumber({value,format=(n:number)=>nf.format(Math.round(n))}:{value:number;format?:(n:number)=>string}){
  const previous=useRef(value);const [shown,setShown]=useState(value);
  useEffect(()=>{const from=previous.current,start=performance.now(),duration=920;let raf=0;const tick=(now:number)=>{const t=Math.min(1,(now-start)/duration),e=1-Math.pow(1-t,5);setShown(from+(value-from)*e);if(t<1)raf=requestAnimationFrame(tick);else previous.current=value};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[value]);
  return <>{format(shown)}</>;
}

function Seal({className=''}:{className?:string}){
  return <svg className={`treasury-seal ${className}`} viewBox="0 0 72 72" fill="none" aria-hidden="true">
    <circle cx="36" cy="36" r="32" className="seal-outer"/>
    <circle cx="36" cy="36" r="24" className="seal-guide"/>
    <path d="M36 10A26 26 0 0 0 10 36h13a13 13 0 0 1 13-13V10Z" className="seal-pane p1"/>
    <path d="M62 36A26 26 0 0 0 36 10v13a13 13 0 0 1 13 13h13Z" className="seal-pane p2"/>
    <path d="M36 62A26 26 0 0 0 62 36H49a13 13 0 0 1-13 13v13Z" className="seal-pane p3"/>
    <path d="M10 36A26 26 0 0 0 36 62V49a13 13 0 0 1-13-13H10Z" className="seal-pane p4"/>
    <rect x="31" y="31" width="10" height="10" rx="1" className="seal-core"/>
  </svg>;
}

/** Ticks once a second after mount; null before mount so SSR and first client render agree. */
function useNow(){
  const [now,setNow]=useState<number|null>(null);
  useEffect(()=>{setNow(Date.now());const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(id)},[]);
  return now;
}

type CountdownParts={days:string;hours:string;minutes:string;seconds:string;label:string;closed:boolean;known:boolean;remainFrac:number|null};
function useCountdown(closeIso?:string,openIso?:string):CountdownParts{
  const now=useNow();
  return useMemo(()=>{
    const close=closeIso?Date.parse(closeIso):NaN;
    if(!Number.isFinite(close))return {days:'--',hours:'--',minutes:'--',seconds:'--',label:'CLOSE TIME TBC',closed:false,known:false,remainFrac:null};
    if(now===null)return {days:'--',hours:'--',minutes:'--',seconds:'--',label:'SYNCING CLOCK',closed:false,known:true,remainFrac:null};
    const remaining=close-now;
    if(remaining<=0)return {days:'00',hours:'00',minutes:'00',seconds:'00',label:'EXPERIMENT CLOSED',closed:true,known:true,remainFrac:0};
    const s=Math.floor(remaining/1000);
    const open=openIso?Date.parse(openIso):NaN;
    const remainFrac=Number.isFinite(open)&&close>open?Math.min(1,Math.max(0,remaining/(close-open))):null;
    return {days:two(Math.floor(s/86400)),hours:two(Math.floor(s/3600)%24),minutes:two(Math.floor(s/60)%60),seconds:two(s%60),label:'UNTIL THE FINAL SNAPSHOT',closed:false,known:true,remainFrac};
  },[now,closeIso,openIso]);
}

function Reveal({children,className=''}:{children:ReactNode;className?:string}){
  const ref=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    const el=ref.current;
    if(!el)return;
    if(typeof IntersectionObserver==='undefined'){setVisible(true);return}
    const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setVisible(true);observer.disconnect()}},{threshold:.05});
    observer.observe(el);
    return()=>observer.disconnect();
  },[]);
  return <div ref={ref} className={`reveal ${visible?'is-visible':''} ${className}`}>{children}</div>;
}

type Segment={key:string;handle?:string;label:string;share:number;color:string;isOthers?:boolean};
function buildSegments(owners:Owner[]):Segment[]{
  if(!owners.length)return [];
  const named=owners.slice(0,SEGMENT_COLORS.length).filter(o=>o.share>=0.02);
  const namedShare=named.reduce((sum,o)=>sum+o.share,0);
  const segments:Segment[]=named.map((o,i)=>({key:clean(o.handle),handle:o.handle,label:`@${o.handle}`,share:o.share,color:SEGMENT_COLORS[i]}));
  const rest=owners.length-named.length;
  if(rest>0||namedShare<0.999)segments.push({key:'__others',label:`${rest} more`,share:Math.max(0,1-namedShare),color:OTHERS_COLOR,isOthers:true});
  return segments;
}

const polar=(r:number,deg:number)=>[320+r*Math.sin(deg*Math.PI/180),320-r*Math.cos(deg*Math.PI/180)] as const;
function ringSlice(startDeg:number,endDeg:number,rOut:number,rIn:number){
  const large=endDeg-startDeg>180?1:0;
  const [ax,ay]=polar(rOut,startDeg),[bx,by]=polar(rOut,endDeg),[cx,cy]=polar(rIn,endDeg),[dx,dy]=polar(rIn,startDeg);
  return `M${ax.toFixed(2)} ${ay.toFixed(2)}A${rOut} ${rOut} 0 ${large} 1 ${bx.toFixed(2)} ${by.toFixed(2)}L${cx.toFixed(2)} ${cy.toFixed(2)}A${rIn} ${rIn} 0 ${large} 0 ${dx.toFixed(2)} ${dy.toFixed(2)}Z`;
}

const MOTES=[18,64,117,163,205,248,292,338,86];

function PoolRing({state,countdown,highlight,rippleKey,status}:{state?:StrategyState;countdown:CountdownParts;highlight?:string;rippleKey:number;status:string}){
  const segments=useMemo(()=>buildSegments(state?.owners??[]),[state?.owners]);
  const gap=segments.length>1?1.6:0;
  const scale=(360-gap*segments.length)/360;
  let cursor=0;
  const chips=state?.tape.slice(0,3)??[];
  return <div className="pool-ring-stage">
    <div className="pool-ring-frame">
      {rippleKey>0&&<div className="pool-ripple" key={rippleKey} aria-hidden="true"/>}
      {MOTES.map((angle,i)=><span key={angle} className="pool-mote" style={{'--a':`${angle}deg`,'--d':`${(i%5)*1.4}s`,'--t':`${5.5+(i%4)*1.3}s`} as CSSProperties} aria-hidden="true"><i/></span>)}
      <svg className="pool-ring" viewBox="0 0 640 640" role="img" aria-label="Ownership of the vouch pool, and time remaining in the experiment">
        <circle cx="320" cy="320" r="308" className="clock-track"/>
        {countdown.remainFrac!==null
          ?<circle cx="320" cy="320" r="308" className="clock-progress" pathLength={100} strokeDasharray={`${(countdown.remainFrac*100).toFixed(2)} 100`} transform="rotate(-90 320 320)"/>
          :<circle cx="320" cy="320" r="308" className="clock-progress idle" pathLength={100} strokeDasharray="100 100" transform="rotate(-90 320 320)"/>}
        <g className="pool-slices">
          {segments.length
            ?segments.map(segment=>{
              const span=segment.share*360*scale;
              const path=ringSlice(cursor,cursor+span,280,182);
              cursor+=span+gap;
              const dim=highlight&&segment.key!==highlight;
              const hit=highlight&&segment.key===highlight;
              return <path key={segment.key} d={path} fill={segment.color} className={`pool-slice ${dim?'is-dim':''} ${hit?'is-you':''}`}><title>{`${segment.label} — ${pct(segment.share)}`}</title></path>;
            })
            :<circle cx="320" cy="320" r="231" className="pool-empty-ring"/>}
        </g>
      </svg>
      <div className="pool-center">
        {state?<>
          <span className="pool-center-label">COMMONS POINTS HELD</span>
          <strong><AnimatedNumber value={state.totalPoints}/></strong>
          <span className="pool-center-sub">RANK #{nf.format(state.rank)} &middot; {state.voucherCount} OWNER{state.voucherCount===1?'':'S'}</span>
        </>:<>
          <Seal className="pool-center-seal"/>
          <span className="pool-center-label">COMMON STRATEGY / GENESIS</span>
          <span className="pool-center-sub">{status}</span>
        </>}
        {state&&!state.owners.length&&<span className="pool-center-first">THE FIRST VOUCH OWNS 100%</span>}
      </div>
      {chips.map((entry,i)=><a key={entry.id} className={`pool-chip chip-${i} ${entry.kind==='slash'?'is-slash':''}`} href={entry.tweetUrl||`https://x.com/${entry.handle}`} target="_blank" rel="noreferrer">
        <b>{entry.points>0?'+':''}{compact(entry.points)}</b><span>@{entry.handle}</span><small>{entry.kind.toUpperCase()}</small>
      </a>)}
      {state?.owners[0]&&<div className="pool-callout"><small>LARGEST SLICE</small><span>@{state.owners[0].handle} &middot; <b>{pct(state.owners[0].share)}</b></span></div>}
    </div>
  </div>;
}

function Ticker({state,countdown}:{state?:StrategyState;countdown:CountdownParts}){
  const clock=countdown.known?`${countdown.days} : ${countdown.hours} : ${countdown.minutes} : ${countdown.seconds}`:'TBC';
  const base:{k:string;v:string;up?:boolean}[]=state
    ?[{k:'THE POOL',v:`${nf.format(state.positiveVouchPoints)} PTS`,up:true},{k:countdown.closed?'STATUS':'CLOSES IN',v:countdown.closed?'CLOSED':clock,up:true},{k:'OWNERS',v:String(state.voucherCount)}]
    :[{k:'STATUS',v:'AWAITING INDEX'},{k:countdown.closed?'STATUS':'CLOSES IN',v:countdown.closed?'CLOSED':clock}];
  const vouches=state?.tape.filter(entry=>entry.kind==='vouch').slice(0,12).map(entry=>({k:`@${entry.handle} VOUCHED`,v:`+${compact(entry.points)}`,up:true}))??[];
  const items=[...base,...vouches];
  const track=(hidden:boolean)=><div className="ticker-set" aria-hidden={hidden||undefined}>{items.map((item,i)=><span key={`${item.k}-${i}`} className={item.up?'up':''}><small>{item.k}</small><b>{item.v}</b></span>)}</div>;
  return <div className="pool-ticker"><div className="pool-ticker-track">{track(false)}{track(true)}</div></div>;
}

function MiniDonut({share,label}:{share:number;label?:string}){
  return <div className="mini-donut">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="82" className="mini-track"/>
      <circle cx="100" cy="100" r="82" className="mini-progress" pathLength={100} strokeDasharray={`${Math.max(1.2,share*100).toFixed(2)} 100`} transform="rotate(-90 100 100)"/>
    </svg>
    <div className="mini-center"><b>{label??pct(share)}</b><small>OF THE POOL</small></div>
  </div>;
}

export function CommonStrategy({initial,error:initialError}:{initial?:StrategyState;error?:string}){
  const [state,setState]=useState<StrategyState|undefined>(initial);
  const [error,setError]=useState(initialError||'');
  const [rippleKey,setRippleKey]=useState(0);
  const [query,setQuery]=useState('');
  const [slice,setSlice]=useState<Slice|undefined>();
  const [sliceError,setSliceError]=useState('');
  const [sliceLoading,setSliceLoading]=useState(false);
  const [highlight,setHighlight]=useState<string|undefined>();
  const [showAllOwners,setShowAllOwners]=useState(false);
  const known=useRef(new Set(initial?.tape.map(entry=>entry.id)??[]));
  const countdown=useCountdown(state?.closesAt??CLOSE_AT,state?.opensAt??OPEN_AT);

  useEffect(()=>{
    let cancelled=false;
    const poll=async()=>{
      try{
        const res=await fetch('/api/common-strategy',{cache:'no-store'});
        const next=await res.json() as StrategyState&{error?:string};
        if(!res.ok)throw new Error(next.error||'Live data unavailable');
        if(cancelled)return;
        if(next.tape.some(entry=>!known.current.has(entry.id))&&known.current.size)setRippleKey(k=>k+1);
        known.current=new Set(next.tape.map(entry=>entry.id));
        setState(next);setError('');
      }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Live data unavailable')}
    };
    poll();
    const id=window.setInterval(poll,4000);
    return()=>{cancelled=true;window.clearInterval(id)};
  },[]);

  const lookup=async(e:FormEvent)=>{
    e.preventDefault();
    const q=clean(query);
    if(!q||!state)return;
    setSliceLoading(true);setSlice(undefined);setSliceError('');
    const owner=state.owners.find(o=>clean(o.handle)===q);
    if(owner){
      setSlice({type:'owner',handle:owner.handle,points:owner.points,share:owner.share,lastAt:owner.lastAt});
      setHighlight(q);setSliceLoading(false);
      return;
    }
    setHighlight(undefined);
    try{
      const res=await fetch(`/api/common-strategy?quote=${encodeURIComponent(q)}`,{cache:'no-store'});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Account not found');
      const quote=data.quote as Quote;
      setSlice({type:'quote',handle:quote.handle,rank:quote.rank,power:quote.power,shareAfter:quote.shareAfter,poolAfter:quote.poolAfter});
    }catch(err){setSliceError(err instanceof Error?err.message:'Account not found')}
    finally{setSliceLoading(false)}
  };

  const status=countdown.closed?'CLOSED / AWAITING SETTLEMENT':state?'LIVE / ACCUMULATING':'AWAITING COMMONS INDEX';
  const handle=state?.handle||'commonstrat';
  const expectedWait=!state&&/not on the Commons leaderboard yet/i.test(error);
  const vouchHref=`https://x.com/intent/post?text=${encodeURIComponent(`Hey @commonsmade, I vouch for @${handle}`)}`;
  const segments=buildSegments(state?.owners??[]);
  const owners=state?.owners??[];
  const visibleOwners=showAllOwners?owners:owners.slice(0,8);
  const topPoints=owners[0]?.points??0;

  return <main className="pool-app">
    <a className="skip-link" href="#pool-stage">SKIP TO CONTENT</a>

    <header className="pool-header">
      <a className="cs-identity" href="#pool-stage" aria-label="Common Strategy, back to top"><Seal/><span><b>COMMON</b><em>STRATEGY</em></span></a>
      <div className={`header-clock ${countdown.closed?'closed':''}`} role="timer" aria-label="Time remaining in the Commons experiment">
        <i aria-hidden="true"/>
        {countdown.closed
          ?<span>EXPERIMENT CLOSED &middot; FINAL SNAPSHOT TAKEN</span>
          :countdown.known
            ?<span>CLOSES IN {countdown.days} : {countdown.hours} : {countdown.minutes} : <b>{countdown.seconds}</b></span>
            :<span>CLOSE TIME TBC</span>}
      </div>
      <a className="header-vouch" href={vouchHref} target="_blank" rel="noreferrer">VOUCH @{handle.toUpperCase()} <b aria-hidden="true">&#8599;</b></a>
    </header>

    <Ticker state={state} countdown={countdown}/>

    <section className="pool-stage" id="pool-stage" aria-label="The pool">
      <aside className="stage-rail rail-left">
        <div className="rail-block">
          <span className="rail-title">THE POOL</span>
          <p>Vouch games favour whales &mdash; alone, a common account is noise. Pooled into one account, the commons is the whale. Every vouch pours points in and owns a pro-rata slice of whatever the pool wins.</p>
        </div>
        <div className="rail-stats">
          <div><span>RANK</span><b>{state?`#${nf.format(state.rank)}`:'—'}</b></div>
          <div><span>CUTOFF</span><b className="acid">#1,000</b></div>
          <div><span>OWNERS</span><b>{state?nf.format(state.voucherCount):'0'}</b></div>
          <div><span>VOUCH POOL</span><b>{state?nf.format(state.positiveVouchPoints):'—'}</b></div>
          <div><span>PLEDGED</span><b className="acid">100%</b></div>
          <div><span>TIME LEFT</span><b>{countdown.known?`${countdown.days}D ${countdown.hours}H ${countdown.minutes}M`:'TBC'}</b></div>
        </div>
        <div className="rail-note">OUTER RING = TIME LEFT{countdown.remainFrac!==null?` (${Math.round(countdown.remainFrac*100)}%)`:''}<br/>INNER SLICES = SHARE OF THE VOUCH POOL</div>
      </aside>

      <PoolRing state={state} countdown={countdown} highlight={highlight} rippleKey={rippleKey} status={status}/>

      <aside className="stage-rail rail-right" aria-label="Live vouch and slash flow">
        <div className="rail-head"><span>LIVE FLOW</span><i className={state?'live':''} aria-hidden="true"/></div>
        <div className="flow-list">
          {state?.tape.slice(0,6).map(entry=><a key={entry.id} href={entry.tweetUrl||`https://x.com/${entry.handle}`} target="_blank" rel="noreferrer" className={entry.kind==='slash'?'is-slash':''}>
            <span className="flow-who">{entry.avatarUrl?<img src={entry.avatarUrl} alt=""/>:<i aria-hidden="true"/>}@{entry.handle}</span>
            <time>{entry.at?new Date(entry.at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'--:--'}</time>
            <b>{entry.points>0?'+':''}{compact(entry.points)}</b>
          </a>)}
          {!state?.tape.length&&<div className="flow-empty"><Seal/><span>WAITING FOR THE FIRST VOUCH TO ENTER THE POOL.</span></div>}
        </div>
        <div className="rail-note">NEW EVENTS RIPPLE THE RING<br/>RE-SYNCS EVERY 4 SECONDS</div>
      </aside>
    </section>

    <section className="thesis-section" id="thesis">
      <Reveal>
        <span className="section-code">01 / THE THESIS</span>
        <h2>Vouch games are rigged for whales. <em>So the commons became one.</em></h2>
        <p className="thesis-lede">Reach wins these experiments: big accounts soak up vouches while common people scatter theirs and finish with nothing. Common Strategy pools the crowd into a single account &mdash; if it lands in the top 1,000, the allocation flows back to every voucher, pro rata. Not the founder. Not a whale. The people who built it.</p>
        <div className="thesis-grid">
          <div><span>ALONE</span><b>Your vouch is noise</b><p>Scattered across thousands of accounts, small vouches decide nothing and win nothing.</p></div>
          <div><span>POOLED</span><b>The crowd is the whale</b><p>One shared account climbs the board with the weight of every voucher behind it.</p></div>
          <div><span>SETTLED</span><b>100% to the people</b><p>Every point contributed is a pro-rata claim on the whole allocation. Founder keeps 0.00%.</p></div>
        </div>
      </Reveal>
    </section>

    <section className="slice-section" id="your-slice">
      <Reveal className="slice-grid">
      <div className="slice-copy">
        <span className="section-code">02 / FIND YOUR SLICE</span>
        <h2>Already vouched? Your slice <em>lights up.</em></h2>
        <p>Enter your Commons handle. If you are on the cap table we highlight your slice in the pool; if not, we price what a vouch from you would own today.</p>
        <form onSubmit={lookup}>
          <label><span aria-hidden="true">@</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="your Commons handle" autoCapitalize="none" spellCheck={false} disabled={!state} aria-label="Your Commons handle"/></label>
          <button disabled={!state||sliceLoading}>{!state?'AVAILABLE WHEN LISTED':sliceLoading?'SEARCHING…':'FIND ME'}</button>
        </form>
        {sliceError&&<p className="slice-error">{sliceError}</p>}
        {!state&&<p className="slice-wait">The finder activates automatically when @{handle} appears on the Commons leaderboard.</p>}
      </div>
      <div className="slice-result">
        {slice?<>
          <MiniDonut share={slice.type==='owner'?slice.share:slice.shareAfter}/>
          <div className="slice-rows">
            <div><span>ACCOUNT</span><b>@{slice.handle}</b></div>
            {slice.type==='owner'?<>
              <div><span>CONTRIBUTED</span><b>+{nf.format(Math.round(slice.points))} PTS</b></div>
              <div><span>CURRENT SHARE</span><b className="acid">{pct(slice.share)}</b></div>
              <div><span>STATUS</span><b className="acid">ON THE CAP TABLE</b></div>
            </>:<>
              <div><span>WOULD CONTRIBUTE</span><b>+{nf.format(Math.round(slice.power))} PTS</b></div>
              <div><span>SHARE AFTER VOUCH</span><b className="acid">{pct(slice.shareAfter)}</b></div>
              <div><span>POOL AFTER</span><b>{nf.format(Math.round(slice.poolAfter))} PTS</b></div>
              <div><span>STATUS</span><b>NOT VOUCHED YET</b></div>
            </>}
          </div>
          <a className="slice-cta" href={vouchHref} target="_blank" rel="noreferrer">{slice.type==='owner'?'VOUCH AGAIN — GROW YOUR SLICE':'ENTER THE CAP TABLE'} <b aria-hidden="true">&#8599;</b></a>
        </>:<div className="slice-placeholder">
          <MiniDonut share={0.02} label="—"/>
          <p>Your pro-rata share appears here.{countdown.closed?' The experiment has closed — shares are final.':' Vouches contribute 35% of your base score to the pool.'}</p>
        </div>}
      </div>
      </Reveal>
    </section>

    <section className="cap-section" id="cap-table">
      <Reveal className="cap-inner">
      <div className="cap-head">
        <div><span className="section-code">03 / THE CAP TABLE</span><h2>Ownership, <em>not followers.</em></h2></div>
        <div className="cap-total"><b>100.000%</b><span>{state?`VOUCHER OWNED · ${state.voucherCount} CURRENT OWNER${state.voucherCount===1?'':'S'}`:'WAITING FOR THE FIRST OWNER'}</span></div>
      </div>
      {segments.length?<div className="cap-bar" role="img" aria-label="Share of the vouch pool by owner">
        {segments.map(segment=><div key={segment.key} className={`cap-segment ${highlight&&segment.key===highlight?'is-you':''}`} style={{width:`${Math.max(segment.share*100,1)}%`,background:segment.color}}>
          {segment.share>=0.1&&!segment.isOthers&&<span>{segment.label} {pct(segment.share,1)}</span>}
          {segment.isOthers&&<span className="others">{segment.label} — {pct(segment.share,1)}</span>}
        </div>)}
      </div>:<div className="cap-empty"><b>THE FIRST VOUCH OWNS 100%</b><span>Every later vouch dilutes all holders pro rata.</span></div>}
      {owners.length>0&&<div className="cap-list">
        <div className="cap-list-head"><span>NO.</span><span>OWNER</span><span>POINTS</span><span>SHARE OF POOL</span><span>SHARE</span></div>
        {visibleOwners.map((owner,i)=><a key={owner.handle} href={owner.tweetUrl||`https://x.com/${owner.handle}`} target="_blank" rel="noreferrer" className={`cap-row ${highlight&&clean(owner.handle)===highlight?'is-you':''}`}>
          <span className="row-idx">{String(i+1).padStart(2,'0')}</span>
          <span className="row-owner">{owner.avatarUrl?<img src={owner.avatarUrl} alt=""/>:<i aria-hidden="true"/>}@{owner.handle}</span>
          <span className="row-points">{nf.format(Math.round(owner.points))}</span>
          <span className="row-bar"><i style={{width:`${topPoints?Math.max(2,(owner.points/topPoints)*100):0}%`,background:segments.find(s=>s.key===clean(owner.handle))?.color??OTHERS_COLOR}}/></span>
          <span className="row-share">{pct(owner.share,3)}</span>
        </a>)}
        {owners.length>8&&<button className="cap-more" onClick={()=>setShowAllOwners(v=>!v)}>{showAllOwners?'COLLAPSE THE REGISTER':`VIEW ALL ${owners.length} OWNERS`}</button>}
      </div>}
      </Reveal>
    </section>

    <section className="pledge-section" id="pledge">
      <Reveal>
      <Seal className="pledge-seal"/>
      <span className="section-code">04 / THE PLEDGE</span>
      <blockquote>&ldquo;100% of any Commons allocation actually received by Common Strategy will be distributed to positive vouchers, <em>pro rata by the points they contributed.</em>&rdquo;</blockquote>
      <div className="pledge-grid">
        <div><span>DISTRIBUTION</span><b>100.00%</b></div>
        <div><span>FOUNDER</span><b>0.00%</b></div>
        <div><span>BASIS</span><b>POINTS CONTRIBUTED</b></div>
        <div><span>SOURCE</span><b>COMMONS LEDGER</b></div>
      </div>
      <small>Pool percentages are informational until the Commons experiment ends and @{handle} actually receives an allocation. If no allocation is received, there is nothing to distribute. Positive vouches only are included in the ownership denominator.</small>
      </Reveal>
    </section>

    <footer className="pool-footer">
      <div className="cs-identity"><Seal/><span><b>COMMON</b><em>STRATEGY</em></span></div>
      <span>THE COMMONS TREASURY COMPANY &middot; 100% PLEDGED &middot; FOUNDER 0.00%</span>
      <a href={vouchHref} target="_blank" rel="noreferrer">VOUCH @{handle.toUpperCase()} &#8599;</a>
    </footer>

    {error&&!expectedWait&&<button className="data-error" onClick={()=>setError('')}>{error}</button>}
  </main>;
}
