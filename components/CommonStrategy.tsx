'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type Owner={handle:string;avatarUrl?:string;points:number;share:number;lastAt?:string;tweetUrl?:string};
type Tape={id:string;kind:'vouch'|'slash';handle:string;avatarUrl?:string;points:number;at?:string;tweetUrl?:string};
type History={at:string;score:number;delta:number;handle:string;kind:'vouch'|'slash'};
export type StrategyState={
  handle:string;display:string;avatarUrl?:string;rank:number;basePoints:number;reputationPoints:number;totalPoints:number;
  boardVersion:number;totalParticipants:number;totalEntries:number;positiveVouchPoints:number;voucherCount:number;
  owners:Owner[];tape:Tape[];history:History[];fetchedAt:string;
};
type Quote={handle:string;rank:number;basePoints:number;power:number;shareAfter:number;poolAfter:number};

const nf=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const compact=(n:number)=>n>=1_000_000?`${(n/1_000_000).toFixed(2)}M`:n>=1000?`${(n/1000).toFixed(1)}K`:nf.format(n);
const percent=(n:number,digits=2)=>`${(n*100).toFixed(digits)}%`;

function AnimatedNumber({value,format=(n:number)=>nf.format(Math.round(n))}:{value:number;format?:(n:number)=>string}){
  const previous=useRef(value);
  const [shown,setShown]=useState(value);
  useEffect(()=>{
    const from=previous.current,to=value,start=performance.now(),duration=700;
    let raf=0;
    const frame=(now:number)=>{
      const t=Math.min(1,(now-start)/duration); const eased=1-Math.pow(1-t,4);
      setShown(from+(to-from)*eased);
      if(t<1) raf=requestAnimationFrame(frame); else previous.current=to;
    };
    raf=requestAnimationFrame(frame); return()=>cancelAnimationFrame(raf);
  },[value]);
  return <>{format(shown)}</>;
}

function ScoreChart({state}:{state:StrategyState}){
  const data=useMemo(()=>{
    const points=[{score:state.basePoints,at:state.history[0]?.at??state.fetchedAt,delta:0,handle:'BASE',kind:'vouch' as const},...state.history];
    if(points.length===1) points.push({...points[0],score:state.totalPoints,at:state.fetchedAt});
    const scores=points.map(p=>p.score),min=Math.min(...scores),max=Math.max(...scores),range=Math.max(1,max-min);
    return points.map((p,i)=>({
      ...p,x:30+(i/Math.max(1,points.length-1))*940,y:250-((p.score-min)/range)*190,
    }));
  },[state]);
  const path=data.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return <div className="cs-chart-wrap">
    <svg viewBox="0 0 1000 290" role="img" aria-label="Common Strategy score history">
      <defs><linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#baff63" stopOpacity=".22"/><stop offset="1" stopColor="#baff63" stopOpacity="0"/></linearGradient></defs>
      <line x1="30" y1="250" x2="970" y2="250" className="chart-axis"/>
      <path d={`${path} L 970 250 L 30 250 Z`} fill="url(#scoreFill)"/>
      <path d={path} className="score-line"/>
      {data.slice(1).map((p,i)=><g key={`${p.at}-${i}`} className={p.kind==='slash'?'chart-event slash':'chart-event'}>
        <line x1={p.x} y1={p.y} x2={p.x} y2="250"/>
        <circle cx={p.x} cy={p.y} r="5"/>
        <title>@{p.handle} {p.delta>0?'+':''}{nf.format(Math.round(p.delta))}</title>
      </g>)}
    </svg>
    <div className="chart-label left"><span>BASE</span><b>{compact(state.basePoints)}</b></div>
    <div className="chart-label right"><span>NOW</span><b>{compact(state.totalPoints)}</b></div>
  </div>;
}

export function CommonStrategy({initial,error:initialError}:{initial?:StrategyState;error?:string}){
  const [state,setState]=useState<StrategyState|undefined>(initial);
  const [error,setError]=useState(initialError||'');
  const [liveEvent,setLiveEvent]=useState<Tape|undefined>();
  const [quoteName,setQuoteName]=useState('');
  const [quote,setQuote]=useState<Quote|undefined>();
  const [quoteError,setQuoteError]=useState('');
  const [quoteLoading,setQuoteLoading]=useState(false);
  const knownIds=useRef(new Set(initial?.tape.map(x=>x.id)??[]));

  useEffect(()=>{
    let cancelled=false;
    const poll=async()=>{
      try{
        const res=await fetch('/api/common-strategy',{cache:'no-store'}); const next=await res.json();
        if(!res.ok) throw new Error(next.error||'Live data unavailable');
        if(cancelled)return;
        const fresh=(next.tape as Tape[]).find(item=>!knownIds.current.has(item.id));
        if(fresh){setLiveEvent(fresh);window.setTimeout(()=>setLiveEvent(undefined),3800)}
        knownIds.current=new Set((next.tape as Tape[]).map(item=>item.id));
        setState(next);setError('');
      }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Live data unavailable')}
    };
    const id=window.setInterval(poll,4000); return()=>{cancelled=true;window.clearInterval(id)};
  },[]);

  const lookup=async(e:FormEvent)=>{
    e.preventDefault(); const q=quoteName.replace(/^@/,'').trim(); if(!q)return;
    setQuoteLoading(true);setQuote(undefined);setQuoteError('');
    try{
      const res=await fetch(`/api/common-strategy?quote=${encodeURIComponent(q)}`,{cache:'no-store'});const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Account not found'); setQuote(data.quote);
    }catch(e){setQuoteError(e instanceof Error?e.message:'Account not found')}finally{setQuoteLoading(false)}
  };

  if(!state){return <main className="cs-app cs-waiting">
    <header className="cs-nav"><div className="cs-wordmark">COMMON <b>STRATEGY</b></div><span className="live-pill off">WAITING FOR TREASURY</span></header>
    <section><p className="micro">THE COMMONS TREASURY COMPANY</p><h1>COMMON<br/><em>STRATEGY</em></h1><p>{error||'Waiting for the Common Strategy account to appear on the Commons leaderboard.'}</p><small>Production handle can be set with COMMON_STRATEGY_HANDLE.</small></section>
  </main>}

  const vouchText=`Hey @commonsmade, I vouch for @${state.handle}`;
  const vouchHref=`https://x.com/intent/post?text=${encodeURIComponent(vouchText)}`;
  const topOwners=state.owners.slice(0,12),restShare=state.owners.slice(12).reduce((s,o)=>s+o.share,0);

  return <main className="cs-app">
    <header className="cs-nav">
      <div className="cs-wordmark">COMMON <b>STRATEGY</b></div>
      <nav><a href="#ownership">OWNERSHIP</a><a href="#cap-table">CAP TABLE</a><a href="#tape">LIVE TAPE</a></nav>
      <span className="live-pill"><i/>LIVE · BOARD {state.boardVersion}</span>
    </header>

    <section className="cs-hero">
      <div className="hero-copy">
        <p className="micro">THE COMMONS TREASURY COMPANY · @{state.handle.toUpperCase()}</p>
        <h1>ACCUMULATE<br/><em>POINTS.</em><br/>DISTRIBUTE<br/>EVERYTHING.</h1>
        <p className="hero-dek">100% of any Commons allocation received by Common Strategy is pledged to the accounts that positively vouched it, pro rata by the points they contributed.</p>
        <div className="hero-actions"><a className="primary-cta" href={vouchHref} target="_blank" rel="noreferrer">VOUCH COMMON STRATEGY <span>↗</span></a><a href="#pledge">READ THE PLEDGE ↓</a></div>
      </div>
      <div className="hero-treasury">
        <div className="treasury-label"><span>TREASURY SCORE</span><span className="board-pulse"><i/> LIVE</span></div>
        <strong className="treasury-score"><AnimatedNumber value={state.totalPoints}/></strong>
        <div className="hero-rank"><span>COMMONS RANK</span><b>#<AnimatedNumber value={state.rank}/></b></div>
        <div className="hero-grid">
          <div><span>VOUCH POINTS</span><b><AnimatedNumber value={state.positiveVouchPoints} format={compact}/></b></div>
          <div><span>VOUCHERS</span><b><AnimatedNumber value={state.voucherCount}/></b></div>
          <div><span>VOUCHER OWNERSHIP</span><b>100.00%</b></div>
          <div><span>FOUNDER OWNERSHIP</span><b>0.00%</b></div>
        </div>
        <div className="rank-context"><span>{nf.format(state.totalParticipants)} COMMONS PARTICIPANTS</span><span>UPDATED {new Date(state.fetchedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span></div>
      </div>
    </section>

    <section className="cs-ownership" id="ownership">
      <div className="section-head"><div><p className="micro">01 / OWNERSHIP</p><h2>THE POOL.</h2></div><p>Every positive vouch owns the same fraction of the final pool as the fraction of total vouch points it contributed.</p></div>
      <div className="ownership-strip">
        {topOwners.map((owner,i)=><a key={owner.handle} href={owner.tweetUrl||`https://x.com/${owner.handle}`} target="_blank" rel="noreferrer" className={`owner-segment s${i%6}`} style={{width:`${Math.max(.35,owner.share*100)}%`}} title={`@${owner.handle} · ${percent(owner.share)}`}><span>@{owner.handle}</span><b>{percent(owner.share)}</b></a>)}
        {restShare>0&&<div className="owner-segment other" style={{width:`${restShare*100}%`}}><span>OTHER</span><b>{percent(restShare)}</b></div>}
        {!state.owners.length&&<div className="empty-strip">THE FIRST VOUCH OWNS 100% OF THE POOL.</div>}
      </div>
      <div className="ownership-math"><span>VOUCHER-OWNED <b>100%</b></span><span>TEAM / FOUNDER <b>0%</b></span><span>POOL BASIS <b>{compact(state.positiveVouchPoints)} PTS</b></span></div>
    </section>

    <section className="cs-quote">
      <div className="quote-copy"><p className="micro">02 / YOUR VOUCH</p><h2>WHAT WOULD<br/>YOU OWN?</h2><p>Enter your Commons handle. We use your live base score to calculate the exact points your vouch contributes and your resulting share of the pool.</p></div>
      <div className="quote-panel">
        <form onSubmit={lookup}><span>@</span><input value={quoteName} onChange={e=>setQuoteName(e.target.value)} placeholder="yourhandle" autoCapitalize="none"/><button disabled={quoteLoading}>{quoteLoading?'CHECKING…':'CALCULATE ↗'}</button></form>
        {quote&&<div className="quote-result">
          <div><span>YOUR VOUCH</span><b>+{compact(quote.power)}</b><small>0.35 × {compact(quote.basePoints)} BASE</small></div>
          <div><span>YOUR POOL SHARE</span><b>{percent(quote.shareAfter)}</b><small>IF YOU VOUCH NOW</small></div>
          <div><span>COMMONS RANK</span><b>#{nf.format(quote.rank)}</b><small>@{quote.handle}</small></div>
          <a href={vouchHref} target="_blank" rel="noreferrer">CLAIM {percent(quote.shareAfter)} OF THE CURRENT POOL ↗</a>
        </div>}
        {quoteError&&<p className="quote-error">{quoteError}</p>}
      </div>
    </section>

    <section className="cs-performance">
      <div className="section-head"><div><p className="micro">03 / TREASURY</p><h2>SCORE<br/>ACCUMULATION.</h2></div><p>Every ledger event is reflected here. Vouches add to the treasury. Slashes reduce it. The chart rebuilds directly from the public Commons ledger.</p></div>
      <ScoreChart state={state}/>
    </section>

    <section className="cs-cap" id="cap-table">
      <div className="section-head"><div><p className="micro">04 / CAP TABLE</p><h2>100% PUBLIC.</h2></div><p>{state.voucherCount} owner{state.voucherCount===1?'':'s'}. No discretionary weighting. No founder allocation.</p></div>
      <div className="cap-table">
        <div className="cap-head"><span>#</span><span>VOUCHER</span><span>CONTRIBUTION</span><span>POOL SHARE</span><span>LAST VOUCH</span><span></span></div>
        {state.owners.map((owner,i)=><a className="cap-row" key={owner.handle} href={owner.tweetUrl||`https://x.com/${owner.handle}`} target="_blank" rel="noreferrer">
          <span>{String(i+1).padStart(2,'0')}</span><strong>{owner.avatarUrl?<img src={owner.avatarUrl} alt=""/>:<i/>}@{owner.handle}</strong><b>+{compact(owner.points)}</b><em>{percent(owner.share,3)}</em><span>{owner.lastAt?new Date(owner.lastAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}</span><span>↗</span>
        </a>)}
        {!state.owners.length&&<div className="cap-empty">NO VOUCHERS YET. THE CAP TABLE IS EMPTY.</div>}
      </div>
    </section>

    <section className="cs-tape" id="tape">
      <div className="tape-title"><p className="micro">05 / LIVE TAPE</p><h2>EVERY<br/>VOUCH.</h2><span><i/> POLLING COMMONS EVERY 4 SECONDS</span></div>
      <div className="tape-feed">
        {state.tape.slice(0,24).map((item,i)=><a key={item.id} className={item.kind==='slash'?'tape-row slash':'tape-row'} href={item.tweetUrl||`https://x.com/${item.handle}`} target="_blank" rel="noreferrer">
          <time>{item.at?new Date(item.at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'--:--:--'}</time><span className="tape-index">{String(i+1).padStart(2,'0')}</span><strong>@{item.handle}</strong><em>{item.kind.toUpperCase()}</em><b>{item.points>0?'+':''}{compact(item.points)}</b><span>↗</span>
        </a>)}
        {!state.tape.length&&<div className="tape-empty">WAITING FOR THE FIRST LEDGER EVENT.</div>}
      </div>
    </section>

    <section className="cs-pledge" id="pledge">
      <p className="micro">THE PLEDGE</p>
      <blockquote>“Common Strategy pledges to distribute <em>100%</em> of any Commons airdrop allocation it actually receives to accounts that positively vouched it, pro rata according to the Commons points contributed by those vouches.”</blockquote>
      <div className="pledge-grid"><div><span>DISTRIBUTION</span><b>100%</b></div><div><span>FOUNDER SHARE</span><b>0%</b></div><div><span>WEIGHTING</span><b>POINTS CONTRIBUTED</b></div><div><span>SOURCE OF TRUTH</span><b>COMMONS LEDGER</b></div></div>
      <p className="fineprint">Pool percentages are informational until the Commons experiment ends and Common Strategy receives any final allocation. If no allocation is received, there is nothing to distribute. Positive vouches only are included in the ownership denominator.</p>
    </section>

    <footer className="cs-footer"><div className="cs-wordmark">COMMON <b>STRATEGY</b></div><span>100% VOUCHER OWNED</span><a href={vouchHref} target="_blank" rel="noreferrer">VOUCH @{state.handle.toUpperCase()} ↗</a></footer>

    {liveEvent&&<div className={liveEvent.kind==='slash'?'live-event slash':'live-event'}>
      <span>LEDGER EVENT</span><strong>{liveEvent.kind==='vouch'?'NEW VOUCH':'NEW SLASH'}</strong><div>@{liveEvent.handle}</div><b>{liveEvent.points>0?'+':''}{compact(liveEvent.points)}</b>
    </div>}
    {error&&<button className="live-error" onClick={()=>setError('')}>{error}</button>}
  </main>;
}
