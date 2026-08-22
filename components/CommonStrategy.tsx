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
type Motion={score:number;rank:number;vouchers:number};

const nf=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const compact=(n:number)=>n>=1_000_000?`${(n/1_000_000).toFixed(2)}M`:n>=1000?`${(n/1000).toFixed(1)}K`:nf.format(Math.round(n));
const pct=(n:number,d=2)=>`${(n*100).toFixed(d)}%`;
const clean=(s:string)=>s.replace(/^@/,'');

function AnimatedNumber({value,format=(n:number)=>nf.format(Math.round(n))}:{value:number;format?:(n:number)=>string}){
  const previous=useRef(value);
  const [shown,setShown]=useState(value);
  useEffect(()=>{
    const from=previous.current,start=performance.now(),duration=900;let raf=0;
    const tick=(now:number)=>{const t=Math.min(1,(now-start)/duration);const e=1-Math.pow(1-t,5);setShown(from+(value-from)*e);if(t<1)raf=requestAnimationFrame(tick);else previous.current=value};
    raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
  },[value]);
  return <>{format(shown)}</>;
}

function TreasuryField({state}:{state?:StrategyState}){
  const ref=useRef<HTMLCanvasElement>(null);
  const live=useRef({score:state?.totalPoints??0,owners:state?.voucherCount??0});
  useEffect(()=>{live.current={score:state?.totalPoints??0,owners:state?.voucherCount??0}},[state?.totalPoints,state?.voucherCount]);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
    let width=0,height=0,dpr=1,raf=0,scroll=window.scrollY;const pointer={x:.7,y:.35,tx:.7,ty:.35};
    const resize=()=>{dpr=Math.min(2,window.devicePixelRatio||1);width=window.innerWidth;height=window.innerHeight;canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;ctx.setTransform(dpr,0,0,dpr,0,0)};
    const move=(e:PointerEvent)=>{pointer.tx=e.clientX/Math.max(1,width);pointer.ty=e.clientY/Math.max(1,height)};
    const onScroll=()=>{scroll=window.scrollY};resize();window.addEventListener('resize',resize);window.addEventListener('pointermove',move,{passive:true});window.addEventListener('scroll',onScroll,{passive:true});
    const draw=(ms:number)=>{
      const t=ms*.00018;pointer.x+=(pointer.tx-pointer.x)*.025;pointer.y+=(pointer.ty-pointer.y)*.025;ctx.clearRect(0,0,width,height);
      const cx=width*(.69+(pointer.x-.5)*.035),cy=height*(.42+(pointer.y-.5)*.03)-Math.min(120,scroll*.025);
      const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(width,height)*.55);glow.addColorStop(0,'rgba(184,255,105,.105)');glow.addColorStop(.24,'rgba(107,221,151,.035)');glow.addColorStop(1,'rgba(3,10,7,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
      ctx.lineWidth=1;
      for(let i=0;i<28;i++){
        const side=i%4;const p=(i+1)/29;let sx=0,sy=0;
        if(side===0){sx=-40;sy=height*(.08+p*.84)}else if(side===1){sx=width+40;sy=height*(.08+p*.84)}else if(side===2){sx=width*(.04+p*.92);sy=-40}else{sx=width*(.04+p*.92);sy=height+40}
        const sway=Math.sin(t*(1.1+(i%5)*.12)+i*1.7)*42;const c1x=sx+(cx-sx)*.34+(side<2?0:sway);const c1y=sy+(cy-sy)*.34+(side<2?sway:0);const c2x=sx+(cx-sx)*.76+Math.cos(t+i)*24;const c2y=sy+(cy-sy)*.76+Math.sin(t+i*.7)*24;
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.bezierCurveTo(c1x,c1y,c2x,c2y,cx,cy);ctx.strokeStyle=`rgba(174,255,115,${.018+(i%6)*.006})`;ctx.stroke();
        const phase=(t*(.42+(i%7)*.035)+i*.081)%1;const u=phase,iu=1-u;const x=iu*iu*iu*sx+3*iu*iu*u*c1x+3*iu*u*u*c2x+u*u*u*cx;const y=iu*iu*iu*sy+3*iu*iu*u*c1y+3*iu*u*u*c2y+u*u*u*cy;ctx.beginPath();ctx.arc(x,y,1.25+(i%3)*.35,0,Math.PI*2);ctx.fillStyle='rgba(197,255,99,.55)';ctx.fill();
      }
      for(let r=0;r<5;r++){ctx.beginPath();ctx.ellipse(cx,cy,width*(.045+r*.041),width*(.045+r*.041)*.34,Math.sin(t*.4)*.12,0,Math.PI*2);ctx.strokeStyle=`rgba(197,255,99,${.11-r*.015})`;ctx.stroke()}
      const pulse=9+Math.sin(ms*.003)*2;ctx.beginPath();ctx.arc(cx,cy,pulse,0,Math.PI*2);ctx.fillStyle='rgba(197,255,99,.78)';ctx.shadowColor='rgba(197,255,99,.7)';ctx.shadowBlur=28;ctx.fill();ctx.shadowBlur=0;
      const ownerCount=Math.min(20,Math.max(4,live.current.owners));
      for(let i=0;i<ownerCount;i++){const a=i/ownerCount*Math.PI*2+t*(i%2?.35:-.25);const rr=width*(.105+(i%5)*.018);const x=cx+Math.cos(a)*rr;const y=cy+Math.sin(a)*rr*.34;ctx.beginPath();ctx.arc(x,y,1.5+(i%4===0?1.2:0),0,Math.PI*2);ctx.fillStyle=i%4===0?'rgba(240,237,224,.72)':'rgba(197,255,99,.42)';ctx.fill()}
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);window.removeEventListener('pointermove',move);window.removeEventListener('scroll',onScroll)};
  },[]);
  return <canvas ref={ref} className="treasury-field" aria-hidden="true"/>;
}

function ScrollProgress(){
  const [p,setP]=useState(0);
  useEffect(()=>{const go=()=>setP(Math.min(1,window.scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight)));go();addEventListener('scroll',go,{passive:true});addEventListener('resize',go);return()=>{removeEventListener('scroll',go);removeEventListener('resize',go)}},[]);
  return <div className="scroll-progress"><i style={{transform:`scaleX(${p})`}}/></div>;
}

function Reveal({children,className=''}:{children:React.ReactNode;className?:string}){
  const ref=useRef<HTMLDivElement>(null);const [on,setOn]=useState(false);
  useEffect(()=>{const el=ref.current;if(!el)return;const ob=new IntersectionObserver(([e])=>{if(e.isIntersecting){setOn(true);ob.disconnect()}},{threshold:.12});ob.observe(el);return()=>ob.disconnect()},[]);
  return <div ref={ref} className={`reveal ${on?'is-visible':''} ${className}`}>{children}</div>;
}

function MarketRail({state}:{state:StrategyState}){
  const recent=state.tape.slice(0,7).map(x=>({k:`@${x.handle}`,v:`${x.points>0?'+':''}${compact(x.points)}`,down:x.kind==='slash'}));
  const items=[{k:'CSTRAT',v:nf.format(state.totalPoints)},{k:'RANK',v:`#${state.rank}`},{k:'VOUCH PTS',v:`+${compact(state.positiveVouchPoints)}`},{k:'OWNERS',v:String(state.voucherCount)},{k:'VOUCHER OWNED',v:'100.00%'},...recent];
  return <div className="market-rail"><div className="rail-track">{[...items,...items].map((x,i)=><span key={`${x.k}-${i}`} className={x.down?'down':''}><small>{x.k}</small><b>{x.v}</b><i>{x.down?'↓':'↑'}</i></span>)}</div></div>;
}

function Delta({value,rank=false}:{value:number;rank?:boolean}){
  if(!value)return <span className="motion-chip">LIVE</span>;const good=value>0;
  return <span className={`motion-chip ${good?'good':'bad'}`}>{good?'↑':'↓'} {rank?Math.abs(value):compact(Math.abs(value))}</span>;
}

function OwnershipConstellation({owners}:{owners:Owner[]}){
  const shown=owners.slice(0,10);const cx=250,cy=250;
  return <div className="ownership-constellation">
    <svg viewBox="0 0 500 500" role="img" aria-label="Live voucher ownership constellation">
      <circle className="orbit-guide" cx={cx} cy={cy} r="174"/><circle className="orbit-guide faint" cx={cx} cy={cy} r="116"/>
      <circle className="core-ring" cx={cx} cy={cy} r="66"/><text x={cx} y={cy-7} textAnchor="middle" className="constellation-core-title">POOL</text><text x={cx} y={cy+24} textAnchor="middle" className="constellation-core-value">100%</text>
      {shown.map((o,i)=>{const angle=(-Math.PI/2)+(i/Math.max(1,shown.length))*Math.PI*2;const radius=i%2?174:150;const x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*radius;return <g key={o.handle} className="owner-node"><line x1={cx} y1={cy} x2={x} y2={y}/><circle cx={x} cy={y} r={Math.max(7,Math.min(22,7+o.share*65))}/><text x={x+(x>cx?13:-13)} y={y-3} textAnchor={x>cx?'start':'end'}>@{o.handle}</text><text className="node-share" x={x+(x>cx?13:-13)} y={y+12} textAnchor={x>cx?'start':'end'}>{pct(o.share)}</text></g>})}
    </svg>
  </div>;
}

function HistoryRibbon({state}:{state:StrategyState}){
  const points=[state.basePoints,...state.history.map(x=>x.score),state.totalPoints];const min=Math.min(...points),max=Math.max(...points),range=Math.max(1,max-min);
  const coords=points.map((v,i)=>`${(i/Math.max(1,points.length-1))*100},${88-((v-min)/range)*70}`).join(' ');
  return <div className="history-ribbon"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={coords}/></svg><div><span>GENESIS BASE <b>{compact(state.basePoints)}</b></span><span>LIVE <b>{compact(state.totalPoints)}</b></span></div></div>;
}

export function CommonStrategy({initial,error:initialError}:{initial?:StrategyState;error?:string}){
  const [state,setState]=useState<StrategyState|undefined>(initial);const [error,setError]=useState(initialError||'');const [liveEvent,setLiveEvent]=useState<Tape>();const [motion,setMotion]=useState<Motion>({score:0,rank:0,vouchers:0});
  const [quoteName,setQuoteName]=useState('');const [quote,setQuote]=useState<Quote>();const [quoteError,setQuoteError]=useState('');const [quoteLoading,setQuoteLoading]=useState(false);
  const knownIds=useRef(new Set(initial?.tape.map(x=>x.id)??[]));const previous=useRef(initial);
  useEffect(()=>{let cancelled=false;const poll=async()=>{try{const res=await fetch('/api/common-strategy',{cache:'no-store'});const next=await res.json() as StrategyState&{error?:string};if(!res.ok)throw new Error(next.error||'Live data unavailable');if(cancelled)return;const prev=previous.current;if(prev){const m={score:next.totalPoints-prev.totalPoints,rank:prev.rank-next.rank,vouchers:next.voucherCount-prev.voucherCount};if(m.score||m.rank||m.vouchers){setMotion(m);setTimeout(()=>setMotion({score:0,rank:0,vouchers:0}),5000)}}const fresh=next.tape.find(x=>!knownIds.current.has(x.id));if(fresh){setLiveEvent(fresh);setTimeout(()=>setLiveEvent(undefined),4200)}knownIds.current=new Set(next.tape.map(x=>x.id));previous.current=next;setState(next);setError('')}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Live data unavailable')}};const id=setInterval(poll,4000);return()=>{cancelled=true;clearInterval(id)}},[]);
  const lookup=async(e:FormEvent)=>{e.preventDefault();const q=clean(quoteName).trim();if(!q)return;setQuoteLoading(true);setQuote(undefined);setQuoteError('');try{const res=await fetch(`/api/common-strategy?quote=${encodeURIComponent(q)}`,{cache:'no-store'});const data=await res.json();if(!res.ok)throw new Error(data.error||'Account not found');setQuote(data.quote)}catch(e){setQuoteError(e instanceof Error?e.message:'Account not found')}finally{setQuoteLoading(false)}};

  if(!state)return <main className="cs-app waiting"><TreasuryField/><header className="topline"><div className="brand">COMMON<span>STRATEGY</span></div><span className="live-status off">WAITING FOR @COMMONSTRAT</span></header><div className="waiting-stage"><p>THE COMMONS TREASURY COMPANY</p><h1>COMMON<br/><em>STRATEGY</em></h1><span>{error||'Waiting for @commonstrat to appear on the Commons leaderboard.'}</span></div></main>;

  const vouchText=`Hey @commonsmade, I vouch for @${state.handle}`;const vouchHref=`https://x.com/intent/post?text=${encodeURIComponent(vouchText)}`;
  const top=state.owners.slice(0,8),rest=state.owners.slice(8).reduce((s,o)=>s+o.share,0);

  return <main className="cs-app">
    <TreasuryField state={state}/><ScrollProgress/>
    <header className="topline"><a className="brand" href="#top">COMMON<span>STRATEGY</span><small>@{state.handle}</small></a><nav><a href="#thesis">THESIS</a><a href="#ownership">OWNERSHIP</a><a href="#ledger">LEDGER</a></nav><span className="live-status"><i/>LIVE / BOARD {state.boardVersion}</span></header>
    <MarketRail state={state}/>

    <section className="opening" id="top">
      <div className="opening-index"><span>01</span><i/><small>THE TREASURY</small></div>
      <div className="opening-title"><p className="eyebrow">A PUBLIC COMMONS ACCUMULATION VEHICLE</p><h1><span>COMMON</span><em>STRATEGY</em></h1><div className="opening-thesis"><p>Accumulate points.<br/>Distribute everything.</p><a href={vouchHref} target="_blank" rel="noreferrer">VOUCH @COMMONSTRAT <b>↗</b></a></div></div>
      <div className="opening-data">
        <div className="data-kicker"><span>COMMONS POINTS HELD</span><span><i/>LIVE</span></div>
        <div className="score-lockup"><strong><AnimatedNumber value={state.totalPoints}/></strong><Delta value={motion.score}/></div>
        <div className="rank-lockup"><span>COMMONS RANK</span><div><Delta value={motion.rank} rank/><b>#<AnimatedNumber value={state.rank}/></b></div></div>
        <div className="metric-row"><div><span>VOUCH POINTS</span><b><AnimatedNumber value={state.positiveVouchPoints} format={compact}/></b></div><div><span>VOUCHERS</span><b><AnimatedNumber value={state.voucherCount}/></b></div><div><span>OWNED BY VOUCHERS</span><b>100%</b></div></div>
        <HistoryRibbon state={state}/>
      </div>
      <div className="opening-tape">{state.tape.slice(0,5).map((x,i)=><a href={x.tweetUrl||`https://x.com/${x.handle}`} target="_blank" rel="noreferrer" key={x.id}><span>{String(i+1).padStart(2,'0')}</span><strong>@{x.handle}</strong><b className={x.kind==='slash'?'negative':''}>{x.points>0?'+':''}{compact(x.points)}</b></a>)}{!state.tape.length&&<span className="tape-empty">WAITING FOR FIRST VOUCH</span>}</div>
      <div className="scroll-cue"><span>SCROLL TO AUDIT</span><i/></div>
    </section>

    <section className="thesis" id="thesis">
      <div className="section-number">02 / THE THESIS</div>
      <Reveal className="thesis-copy"><p>COMMON STRATEGY HAS<br/>ONE JOB:</p><h2>TURN VOUCHES<br/>INTO <em>OWNERSHIP.</em></h2></Reveal>
      <div className="thesis-grid"><Reveal><span>01</span><h3>VOUCH</h3><p>Every positive Commons vouch contributes points to the treasury.</p></Reveal><Reveal><span>02</span><h3>ACCUMULATE</h3><p>The account climbs one public leaderboard. Nothing is hidden off-platform.</p></Reveal><Reveal><span>03</span><h3>DISTRIBUTE</h3><p>100% of any allocation received is pledged back to vouchers, pro rata.</p></Reveal></div>
    </section>

    <section className="ownership-scene" id="ownership">
      <div className="section-number">03 / LIVE OWNERSHIP</div>
      <div className="ownership-copy"><Reveal><p>THE CAP TABLE<br/>REWRITES ITSELF<br/>WITH EVERY VOUCH.</p><h2>{state.voucherCount}<small> LIVE OWNER{state.voucherCount===1?'':'S'}</small></h2></Reveal><div className="ownership-rule"><span>POOL BASIS</span><b>{compact(state.positiveVouchPoints)} POINTS</b><span>FOUNDER SHARE</span><b>0.000%</b></div></div>
      <OwnershipConstellation owners={state.owners}/>
      <div className="ownership-bar">{top.map((o,i)=><a key={o.handle} href={o.tweetUrl||`https://x.com/${o.handle}`} target="_blank" rel="noreferrer" style={{flexGrow:Math.max(.02,o.share)}} className={`tone-${i%5}`}><span>@{o.handle}</span><b>{pct(o.share)}</b></a>)}{rest>0&&<div style={{flexGrow:rest}}><span>OTHER</span><b>{pct(rest)}</b></div>}{!state.owners.length&&<p>THE FIRST VOUCH OWNS 100% UNTIL THE SECOND ARRIVES.</p>}</div>
    </section>

    <section className="quote-scene">
      <div className="quote-orbit" aria-hidden="true"><i/><i/><i/></div>
      <div className="section-number">04 / YOUR POSITION</div>
      <Reveal className="quote-head"><p>BEFORE YOU VOUCH,</p><h2>PRICE YOUR<br/><em>OWNERSHIP.</em></h2></Reveal>
      <form className="quote-form" onSubmit={lookup}><label><span>@</span><input value={quoteName} onChange={e=>setQuoteName(e.target.value)} placeholder="your Commons handle" autoCapitalize="none"/></label><button disabled={quoteLoading}>{quoteLoading?'PRICING…':'CALCULATE POSITION'}<b>↗</b></button></form>
      {quote&&<Reveal className="quote-output"><div><span>YOUR VOUCH CONTRIBUTES</span><strong>+{compact(quote.power)}</strong><small>0.35 × {compact(quote.basePoints)} BASE</small></div><div><span>YOUR PRO-FORMA OWNERSHIP</span><strong>{pct(quote.shareAfter)}</strong><small>OF THE POOL AFTER YOUR VOUCH</small></div><div><span>YOUR COMMONS RANK</span><strong>#{nf.format(quote.rank)}</strong><small>@{quote.handle}</small></div><a href={vouchHref} target="_blank" rel="noreferrer">VOUCH @COMMONSTRAT <b>AND ENTER THE CAP TABLE ↗</b></a></Reveal>}
      {quoteError&&<p className="quote-error">{quoteError}</p>}
    </section>

    <section className="ledger-scene" id="ledger">
      <div className="ledger-head"><div><div className="section-number">05 / PUBLIC LEDGER</div><h2>EVERY<br/>VOUCH,<br/><em>VISIBLE.</em></h2></div><div><span className="sync-dot"><i/>SYNCING EVERY 4 SECONDS</span><p>The Commons ledger is the source of truth. New entries update score, ownership and the cap table automatically.</p></div></div>
      <div className="ledger-columns"><span>TIME</span><span>VOUCHER</span><span>EVENT</span><span>POINTS</span><span>POOL SHARE</span><span></span></div>
      <div className="ledger-list">{state.tape.slice(0,28).map(item=>{const owner=state.owners.find(o=>clean(o.handle).toLowerCase()===clean(item.handle).toLowerCase());return <a key={item.id} href={item.tweetUrl||`https://x.com/${item.handle}`} target="_blank" rel="noreferrer" className={item.kind==='slash'?'slash':''}><time>{item.at?new Date(item.at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'--:--:--'}</time><strong>{item.avatarUrl?<img src={item.avatarUrl} alt=""/>:<i/>}@{item.handle}</strong><em>{item.kind.toUpperCase()}</em><b>{item.points>0?'+':''}{compact(item.points)}</b><span>{owner?pct(owner.share,3):'—'}</span><span>↗</span></a>})}{!state.tape.length&&<div className="ledger-empty">WAITING FOR THE FIRST LEDGER EVENT.</div>}</div>
    </section>

    <section className="pledge-scene" id="pledge"><div className="section-number">06 / THE PLEDGE</div><Reveal><p>NO TREASURY STOCK.<br/>NO FOUNDER ALLOCATION.<br/>NO DISCRETIONARY WEIGHTING.</p><blockquote>100% of any Commons allocation received by Common Strategy is pledged to the accounts that positively vouched it, <em>pro rata by points contributed.</em></blockquote></Reveal><div className="pledge-metrics"><span>DISTRIBUTION <b>100.00%</b></span><span>FOUNDER <b>0.00%</b></span><span>BASIS <b>POINTS CONTRIBUTED</b></span><span>SOURCE <b>COMMONS LEDGER</b></span></div><small>Pool percentages remain informational until the Commons experiment ends and @commonstrat actually receives an allocation. If no allocation is received, there is nothing to distribute. Positive vouches only are included in the ownership denominator.</small></section>

    <footer className="cs-footer"><div className="brand">COMMON<span>STRATEGY</span></div><span>THE COMMONS TREASURY COMPANY</span><a href={vouchHref} target="_blank" rel="noreferrer">VOUCH @COMMONSTRAT ↗</a></footer>

    {liveEvent&&<div className={`event-flash ${liveEvent.kind==='slash'?'slash':''}`}><div className="event-ring"/><span>COMMONS LEDGER / LIVE</span><strong>{liveEvent.kind==='vouch'?'NEW VOUCH':'NEW SLASH'}</strong><p>@{liveEvent.handle}</p><b>{liveEvent.points>0?'+':''}{compact(liveEvent.points)}</b><small>CAP TABLE RECALCULATED</small></div>}
    {error&&<button className="data-error" onClick={()=>setError('')}>{error}</button>}
  </main>;
}
