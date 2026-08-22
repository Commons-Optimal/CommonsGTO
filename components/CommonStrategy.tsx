'use client';

import { CSSProperties, FormEvent, ReactNode, useEffect, useRef, useState } from 'react';

type Owner={handle:string;avatarUrl?:string;points:number;share:number;lastAt?:string;tweetUrl?:string};
type Tape={id:string;kind:'vouch'|'slash';handle:string;avatarUrl?:string;points:number;at?:string;tweetUrl?:string};
type History={at:string;score:number;delta:number;handle:string;kind:'vouch'|'slash'};
export type StrategyState={handle:string;display:string;avatarUrl?:string;rank:number;basePoints:number;reputationPoints:number;totalPoints:number;boardVersion:number;totalParticipants:number;totalEntries:number;positiveVouchPoints:number;voucherCount:number;owners:Owner[];tape:Tape[];history:History[];fetchedAt:string};
type Quote={handle:string;rank:number;basePoints:number;power:number;shareAfter:number;poolAfter:number};
type Motion={score:number;rank:number;owners:number};

const nf=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const compact=(n:number)=>n>=1_000_000?`${(n/1_000_000).toFixed(2)}M`:n>=1000?`${(n/1000).toFixed(1)}K`:nf.format(Math.round(n));
const pct=(n:number,d=2)=>`${(n*100).toFixed(d)}%`;
const clean=(s:string)=>s.replace(/^@/,'').trim();

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

function EngravingField({activity=0}:{activity?:number}){
  const ref=useRef<HTMLCanvasElement>(null);const activityRef=useRef(activity);
  useEffect(()=>{activityRef.current=activity},[activity]);
  useEffect(()=>{const canvas=ref.current;if(!canvas)return;const context=canvas.getContext('2d');if(!context)return;const ctx=context;let w=0,h=0,dpr=1,raf=0;const pointer={x:.5,y:.5,tx:.5,ty:.5};
    const resize=()=>{dpr=Math.min(2,window.devicePixelRatio||1);w=window.innerWidth;h=window.innerHeight;canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=`${w}px`;canvas.style.height=`${h}px`;ctx.setTransform(dpr,0,0,dpr,0,0)};
    const move=(e:PointerEvent)=>{pointer.tx=e.clientX/Math.max(1,w);pointer.ty=e.clientY/Math.max(1,h)};resize();window.addEventListener('resize',resize);window.addEventListener('pointermove',move,{passive:true});
    const draw=(ms:number)=>{const t=ms*.00012;pointer.x+=(pointer.tx-pointer.x)*.025;pointer.y+=(pointer.ty-pointer.y)*.025;ctx.clearRect(0,0,w,h);const cx=w*(.54+(pointer.x-.5)*.035),cy=h*(.48+(pointer.y-.5)*.035);const unit=Math.min(w,h);ctx.save();ctx.translate(cx,cy);ctx.rotate(-.11+Math.sin(t*.8)*.01);
      for(let ring=0;ring<46;ring++){const r=unit*(.14+ring*.0102),amp=unit*(.017+((ring%7)*.0018)),phase=t*(.65+(ring%5)*.06)+ring*.31;ctx.beginPath();for(let i=0;i<=260;i++){const a=i/260*Math.PI*2,mod=Math.sin(a*6+phase)*amp+Math.sin(a*11-phase*.7)*amp*.34,x=Math.cos(a)*(r+mod),y=Math.sin(a)*(r*.42+mod*.22);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.strokeStyle=`rgba(201,255,112,${.012+ring*.00045})`;ctx.lineWidth=.7;ctx.stroke()}
      ctx.restore();
      const lanes=10+Math.min(12,activityRef.current);for(let i=0;i<lanes;i++){const y=(h/(lanes+1))*(i+1),offset=((ms*.018+i*173)%(w+340))-170;ctx.beginPath();ctx.moveTo(offset-120,y);ctx.lineTo(offset+120,y);const g=ctx.createLinearGradient(offset-120,y,offset+120,y);g.addColorStop(0,'rgba(201,255,112,0)');g.addColorStop(.5,'rgba(201,255,112,.11)');g.addColorStop(1,'rgba(201,255,112,0)');ctx.strokeStyle=g;ctx.lineWidth=1;ctx.stroke()}
      raf=requestAnimationFrame(draw)};raf=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);window.removeEventListener('pointermove',move)}},[]);
  return <canvas ref={ref} className="engraving-field" aria-hidden="true"/>;
}

function Reveal({children,className=''}:{children:ReactNode;className?:string}){const ref=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false);useEffect(()=>{const el=ref.current;if(!el)return;const ob=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setVisible(true);ob.disconnect()}},{threshold:.14});ob.observe(el);return()=>ob.disconnect()},[]);return <div ref={ref} className={`reveal ${visible?'is-visible':''} ${className}`}>{children}</div>}

function MarketTape({state}:{state?:StrategyState}){
  const base:{k:string;v:string;down?:boolean}[]=state?[{k:'CSTRAT',v:nf.format(state.totalPoints)},{k:'RANK',v:`#${state.rank}`},{k:'VOUCHERS',v:String(state.voucherCount)},{k:'POOL',v:'+100.00%'},{k:'FOUNDER',v:'0.00%'}]:[{k:'STATUS',v:'AWAITING INDEX'},{k:'CSTRAT',v:'—'},{k:'RANK',v:'—'},{k:'VOUCHERS',v:'0'},{k:'POOL',v:'100% VOUCHER OWNED'}];
  const flow=state?.tape.slice(0,8).map(x=>({k:`@${x.handle}`,v:`${x.points>0?'+':''}${compact(x.points)}`,down:x.kind==='slash'}))??[];const items=[...base,...flow];
  return <div className="market-tape"><div className="market-tape-track">{[...items,...items].map((x,i)=><span className={x.down?'down':''} key={`${x.k}-${i}`}><small>{x.k}</small><b>{x.v}</b><i>{x.down?'−':'+'}</i></span>)}</div></div>;
}

function Certificate({state,status}:{state?:StrategyState;status:string}){
  const recent=state?.tape[0];
  return <div className="certificate-stage">
    <div className="certificate-shadow"/>
    <article className="certificate">
      <div className="certificate-guilloche g1"/><div className="certificate-guilloche g2"/>
      <header className="certificate-top"><span>COMMON STRATEGY / TREASURY NOTE</span><b>{state?`BOARD ${state.boardVersion}`:'ISSUE 000'}</b></header>
      <div className="certificate-brand"><Seal className="certificate-seal"/><div><small>COMMONS TREASURY COMPANY</small><h1>COMMON<br/><em>STRATEGY</em></h1></div></div>
      <div className="certificate-rule"><span>THE ENTIRE FINAL ALLOCATION IS PLEDGED TO VOUCHERS</span><b>100%</b></div>
      <div className="certificate-score"><span>COMMONS POINTS HELD</span><strong>{state?<AnimatedNumber value={state.totalPoints}/>:<>000,000</>}</strong></div>
      <div className="certificate-metrics"><div><span>RANK</span><b>{state?`#${nf.format(state.rank)}`:'—'}</b></div><div><span>VOUCHERS</span><b>{state?nf.format(state.voucherCount):'0'}</b></div><div><span>VOUCH POINTS</span><b>{state?compact(state.positiveVouchPoints):'0'}</b></div></div>
      <div className="certificate-bottom"><div><span>STATUS</span><b>{status}</b></div><div><span>LAST ENTRY</span><b>{recent?`@${recent.handle} ${recent.points>0?'+':''}${compact(recent.points)}`:'NONE'}</b></div><Seal className="certificate-watermark"/></div>
      <div className="certificate-serial">CS / {state?String(state.boardVersion).padStart(6,'0'):'000000'} / GENESIS</div>
    </article>
  </div>;
}

function OwnershipBars({owners}:{owners:Owner[]}){if(!owners.length)return <div className="ownership-empty"><span>CAP TABLE EMPTY</span><b>THE FIRST VOUCH OWNS 100%</b><small>Every later vouch dilutes all holders pro rata.</small></div>;return <div className="ownership-bars">{owners.slice(0,12).map((o,i)=><a href={o.tweetUrl||`https://x.com/${o.handle}`} target="_blank" rel="noreferrer" key={o.handle} className={`owner-bar tone-${i%5}`} style={{'--share':Math.max(.035,o.share)} as CSSProperties}><div><span>{String(i+1).padStart(2,'0')}</span><strong>@{o.handle}</strong></div><div className="bar-track"><i/></div><div><b>{pct(o.share,3)}</b><small>+{compact(o.points)} PTS</small></div></a>)}</div>}

function LiveLedger({state}:{state?:StrategyState}){const rows=state?.tape.slice(0,16)??[];return <div className="ledger-shell"><div className="ledger-head"><span>TIME</span><span>VOUCHER</span><span>EVENT</span><span>POINTS</span><span>POOL</span><span></span></div><div className="ledger-body">{rows.map(item=>{const owner=state?.owners.find(o=>clean(o.handle).toLowerCase()===clean(item.handle).toLowerCase());return <a key={item.id} href={item.tweetUrl||`https://x.com/${item.handle}`} target="_blank" rel="noreferrer" className={item.kind==='slash'?'slash':''}><time>{item.at?new Date(item.at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'--:--:--'}</time><strong>{item.avatarUrl?<img src={item.avatarUrl} alt=""/>:<i/>}@{item.handle}</strong><em>{item.kind.toUpperCase()}</em><b>{item.points>0?'+':''}{compact(item.points)}</b><span>{owner?pct(owner.share,3):'—'}</span><span>↗</span></a>})}{!rows.length&&<div className="ledger-wait"><span>NO ENTRIES YET</span><b>THE LEDGER OPENS WITH THE FIRST VOUCH.</b></div>}</div></div>}

export function CommonStrategy({initial,error:initialError}:{initial?:StrategyState;error?:string}){
  const [state,setState]=useState<StrategyState|undefined>(initial),[error,setError]=useState(initialError||''),[liveEvent,setLiveEvent]=useState<Tape|undefined>(),[motion,setMotion]=useState<Motion>({score:0,rank:0,owners:0}),[quoteName,setQuoteName]=useState(''),[quote,setQuote]=useState<Quote|undefined>(),[quoteError,setQuoteError]=useState(''),[quoteLoading,setQuoteLoading]=useState(false);const known=useRef(new Set(initial?.tape.map(x=>x.id)??[])),previous=useRef(initial);
  useEffect(()=>{let cancelled=false;const poll=async()=>{try{const res=await fetch('/api/common-strategy',{cache:'no-store'}),next=await res.json() as StrategyState&{error?:string};if(!res.ok)throw new Error(next.error||'Live data unavailable');if(cancelled)return;const prev=previous.current;if(prev){const m={score:next.totalPoints-prev.totalPoints,rank:prev.rank-next.rank,owners:next.voucherCount-prev.voucherCount};if(m.score||m.rank||m.owners){setMotion(m);window.setTimeout(()=>setMotion({score:0,rank:0,owners:0}),4500)}}const fresh=next.tape.find(x=>!known.current.has(x.id));if(fresh){setLiveEvent(fresh);window.setTimeout(()=>setLiveEvent(undefined),4200)}known.current=new Set(next.tape.map(x=>x.id));previous.current=next;setState(next);setError('')}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Live data unavailable')}};poll();const id=window.setInterval(poll,4000);return()=>{cancelled=true;window.clearInterval(id)}},[]);
  const lookup=async(e:FormEvent)=>{e.preventDefault();const q=clean(quoteName);if(!q||!state)return;setQuoteLoading(true);setQuote(undefined);setQuoteError('');try{const res=await fetch(`/api/common-strategy?quote=${encodeURIComponent(q)}`,{cache:'no-store'}),data=await res.json();if(!res.ok)throw new Error(data.error||'Account not found');setQuote(data.quote)}catch(e){setQuoteError(e instanceof Error?e.message:'Account not found')}finally{setQuoteLoading(false)}};
  const status=state?'LIVE / ACCUMULATING':'AWAITING COMMONS INDEX';const handle=state?.handle||'commonstrat';const expectedWait=!state&&/not on the Commons leaderboard yet/i.test(error);const vouchHref=`https://x.com/intent/post?text=${encodeURIComponent(`Hey @commonsmade, I vouch for @${handle}`)}`;
  return <main className="treasury-app">
    <EngravingField activity={state?.voucherCount??0}/>
    <header className="site-header"><a className="identity" href="#top"><Seal/><span><b>COMMON</b><em>STRATEGY</em></span></a><nav><a href="#ownership">OWNERSHIP</a><a href="#ledger">LEDGER</a><a href="#pledge">PLEDGE</a></nav><div className={`header-status ${state?'live':'waiting'}`}><i/><span>{status}</span></div></header>
    <MarketTape state={state}/>

    <section className="hero-floor" id="top">
      <aside className="hero-brief"><span className="section-code">CS / GENESIS / 01</span><p className="hero-kicker">A PUBLIC ACCUMULATION VEHICLE FOR THE COMMONS EXPERIMENT.</p><h2>THE AIRDROP<br/>BELONGS TO<br/><em>THE VOUCHERS.</em></h2><p className="hero-copy">Common Strategy pledges 100% of any final Commons allocation it receives to the accounts that positively vouched it, weighted by the points each vouch contributed.</p><a className="vouch-button" href={vouchHref} target="_blank" rel="noreferrer"><span>VOUCH @COMMONSTRAT</span><b>↗</b></a><div className="brief-foot"><span>FOUNDER SHARE <b>0.00%</b></span><span>VOUCHER SHARE <b>100.00%</b></span></div></aside>
      <Certificate state={state} status={status}/>
      <aside className="hero-flow"><div className="flow-title"><span>LIVE CAPITAL FLOW</span><i/></div>{state?.tape.slice(0,5).map((x,i)=><a href={x.tweetUrl||`https://x.com/${x.handle}`} target="_blank" rel="noreferrer" key={x.id} className={x.kind==='slash'?'negative':''}><small>{String(i+1).padStart(2,'0')}</small><strong>@{x.handle}</strong><b>{x.points>0?'+':''}{compact(x.points)}</b></a>)??<></>}{!state?.tape.length&&<div className="flow-empty"><Seal/><span>WAITING FOR THE FIRST VOUCH TO ENTER THE TAPE.</span></div>}<div className="flow-metrics"><div><span>POINTS</span><b>{state?compact(state.totalPoints):'—'}</b>{motion.score!==0&&<em>{motion.score>0?'+':''}{compact(motion.score)}</em>}</div><div><span>RANK</span><b>{state?`#${state.rank}`:'—'}</b>{motion.rank!==0&&<em>{motion.rank>0?'↑':'↓'} {Math.abs(motion.rank)}</em>}</div><div><span>OWNERS</span><b>{state?state.voucherCount:'0'}</b>{motion.owners>0&&<em>+{motion.owners}</em>}</div></div></aside>
    </section>

    <section className="principle-band"><div className="principle-index">02 / MECHANISM</div><Reveal><p>ONE ACCOUNT ACCUMULATES.</p><h2>EVERY VOUCH BECOMES<br/><em>A LINE ON THE CAP TABLE.</em></h2><div className="mechanism-grid"><div><span>01</span><b>VOUCH</b><p>Commons attributes 35% of your base score to the target.</p></div><div><span>02</span><b>OWN</b><p>Your contributed points become your pro-rata share of the pool.</p></div><div><span>03</span><b>SETTLE</b><p>If Common Strategy receives an allocation, the entire amount is distributed to vouchers.</p></div></div></Reveal></section>

    <section className="ownership-section" id="ownership"><div className="ownership-top"><div><span className="section-code">03 / LIVE CAP TABLE</span><h2>OWNERSHIP,<br/><em>NOT FOLLOWERS.</em></h2></div><div className="ownership-total"><span>VOUCHER OWNED</span><b>100.000%</b><small>{state?`${state.voucherCount} CURRENT OWNER${state.voucherCount===1?'':'S'}`:'WAITING FOR FIRST OWNER'}</small></div></div><OwnershipBars owners={state?.owners??[]}/></section>

    <section className="calculator-section"><div className="calculator-copy"><span className="section-code">04 / PRICE YOUR ENTRY</span><h2>WHAT WOULD<br/>YOUR VOUCH<br/><em>OWN?</em></h2><p>Use your live Commons base score to price your contribution before you enter the cap table.</p></div><div className="calculator-panel"><form onSubmit={lookup}><label><span>@</span><input value={quoteName} onChange={e=>setQuoteName(e.target.value)} placeholder="your Commons handle" autoCapitalize="none" disabled={!state}/></label><button disabled={!state||quoteLoading}>{!state?'AVAILABLE WHEN LISTED':quoteLoading?'PRICING…':'PRICE MY VOUCH'}<b>↗</b></button></form>{quote&&<div className="quote-ticket"><div className="ticket-top"><Seal/><span>PRO-FORMA TREASURY ENTRY</span><b>@{quote.handle}</b></div><div className="ticket-grid"><div><span>CONTRIBUTION</span><strong>+{compact(quote.power)}</strong></div><div><span>POOL SHARE</span><strong>{pct(quote.shareAfter)}</strong></div><div><span>COMMONS RANK</span><strong>#{quote.rank}</strong></div></div><a href={vouchHref} target="_blank" rel="noreferrer">ENTER THE CAP TABLE <b>↗</b></a></div>}{quoteError&&<p className="quote-error">{quoteError}</p>} {!state&&<div className="calculator-wait"><span>PRE-LIVE</span><p>The calculator activates automatically when @commonstrat appears on the Commons leaderboard.</p></div>}</div></section>

    <section className="ledger-section" id="ledger"><div className="ledger-title"><span className="section-code">05 / SOURCE OF TRUTH</span><h2>THE<br/><em>PUBLIC TAPE.</em></h2><p>Every ownership change comes directly from the Commons ledger. The page re-syncs every four seconds.</p></div><LiveLedger state={state}/></section>

    <section className="pledge-section" id="pledge"><Seal className="pledge-seal"/><span className="section-code">06 / THE PLEDGE</span><blockquote>“100% of any Commons allocation actually received by Common Strategy will be distributed to positive vouchers, <em>pro rata by the points they contributed.</em>”</blockquote><div className="pledge-grid"><div><span>DISTRIBUTION</span><b>100.00%</b></div><div><span>FOUNDER</span><b>0.00%</b></div><div><span>BASIS</span><b>POINTS CONTRIBUTED</b></div><div><span>SOURCE</span><b>COMMONS LEDGER</b></div></div><small>Pool percentages are informational until the Commons experiment ends and @commonstrat actually receives an allocation. If no allocation is received, there is nothing to distribute. Positive vouches only are included in the ownership denominator.</small></section>

    <footer className="site-footer"><div className="identity"><Seal/><span><b>COMMON</b><em>STRATEGY</em></span></div><span>THE COMMONS TREASURY COMPANY</span><a href={vouchHref} target="_blank" rel="noreferrer">VOUCH @COMMONSTRAT ↗</a></footer>
    {liveEvent&&<div className={`event-stamp ${liveEvent.kind==='slash'?'slash':''}`}><Seal/><span>LEDGER EVENT</span><strong>{liveEvent.kind==='vouch'?'NEW VOUCH':'NEW SLASH'}</strong><p>@{liveEvent.handle}</p><b>{liveEvent.points>0?'+':''}{compact(liveEvent.points)}</b><small>CAP TABLE RECALCULATED</small></div>}
    {error&&!expectedWait&&<button className="data-error" onClick={()=>setError('')}>{error}</button>}
  </main>;
}
