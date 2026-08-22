'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CommonsLedgerEntry, MarketCandidate, Participant, WarmLead } from '@/lib/types';

type Analysis = {
  user: Participant;
  target: number;
  ownPower: number;
  need: number;
  qualified: boolean;
  remaining?: number;
  candidates: MarketCandidate[];
  directSupporters: CommonsLedgerEntry[];
  warmLeads: WarmLead[];
  rankScores: number[];
};

type MatchState = {
  enabled: boolean;
  active: string[];
  likes: string[];
  incoming: string[];
  passes: string[];
  matches: string[];
  deals: { id:string; a:string; b:string; createdAt:number; aDone?:boolean; bDone?:boolean; clearedAt?:number }[];
  profiles: Record<string,{handle:string;remaining?:number;goal?:string;rank?:number;power?:number;updatedAt:number}>;
  stats: Record<string,number>;
};

type Props = {
  analysis: Analysis;
  vouchLimit: number;
  nextSupplyAt?: string;
  invitedBy?: string;
};

const k = (n:number) => `${(n / 1000).toFixed(1)}K`;
const lower = (s:string) => s.replace(/^@/,'').toLowerCase();
const unique = (items:string[]) => [...new Set(items.map(lower))];

function Countdown({to}:{to?:string}) {
  const [value,setValue] = useState('');
  useEffect(()=>{
    if (!to) return;
    const tick=()=>{
      const d=Math.max(0,new Date(to).getTime()-Date.now());
      const h=Math.floor(d/3600000),m=Math.floor(d%3600000/60000),s=Math.floor(d%60000/1000);
      setValue(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick(); const id=window.setInterval(tick,1000); return()=>window.clearInterval(id);
  },[to]);
  return <>{value||'—'}</>;
}

export function MatchDeck({analysis:a,vouchLimit,nextSupplyAt,invitedBy}:Props) {
  const storageKey=`commons-gto:vouches-left:${a.user.username.toLowerCase()}:${vouchLimit}`;
  const pendingKey=`commons-gto:pending:${a.user.username.toLowerCase()}`;
  const [remaining,setRemaining]=useState<number|undefined>(a.remaining);
  const [goal,setGoal]=useState<'GET_IN'|'CLIMB'|'MAX_SCORE'>(a.qualified?'CLIMB':'GET_IN');
  const [state,setState]=useState<MatchState>({enabled:false,active:[],likes:[],incoming:[],passes:[],matches:[],deals:[],profiles:{},stats:{}});
  const [direction,setDirection]=useState<'left'|'right'|null>(null);
  const [matchHandle,setMatchHandle]=useState<string|undefined>();
  const [view,setView]=useState<'deck'|'pending'|'matches'>('deck');
  const [checking,setChecking]=useState<string|undefined>();
  const [message,setMessage]=useState('');
  const [localSeen,setLocalSeen]=useState<string[]>([]);
  const [localPending,setLocalPending]=useState<string[]>([]);
  const [drag,setDrag]=useState({x:0,y:0});
  const [dragging,setDragging]=useState(false);
  const dragOrigin=useRef({x:0,y:0});

  const refreshState=async()=>{
    try {
      const res=await fetch(`/api/match?actor=${encodeURIComponent(a.user.username)}`,{cache:'no-store'});
      if (res.ok) {
        const next=await res.json() as MatchState;
        setState(next);
        if(next.enabled){
          setLocalPending(current=>current.filter(handle=>!next.matches.map(lower).includes(lower(handle))));
        }
      }
    } catch {}
  };

  useEffect(()=>{
    if (a.remaining!==undefined) { setRemaining(a.remaining); return; }
    const raw=window.localStorage.getItem(storageKey);
    if(raw!==null){const n=Number(raw);if(Number.isInteger(n)&&n>=0&&n<=vouchLimit)setRemaining(n);}
  },[a.remaining,storageKey,vouchLimit]);

  useEffect(()=>{
    const raw=window.localStorage.getItem(pendingKey);
    if(!raw)return;
    try{
      const values=JSON.parse(raw);
      if(Array.isArray(values))setLocalPending(values.map(String));
    }catch{}
  },[pendingKey]);

  useEffect(()=>{window.localStorage.setItem(pendingKey,JSON.stringify(localPending));},[localPending,pendingKey]);
  useEffect(()=>{refreshState(); const id=window.setInterval(refreshState,12000); return()=>window.clearInterval(id);},[a.user.username]);

  useEffect(()=>{
    if(remaining===undefined)return;
    window.localStorage.setItem(storageKey,String(remaining));
    fetch('/api/match',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'join',actor:a.user.username,remaining,goal,rank:a.user.rank,power:a.ownPower})}).then(refreshState).catch(()=>{});
  },[remaining,goal,a.user.username,a.user.rank,a.ownPower,storageKey]);

  const warmMap=useMemo(()=>new Map(a.warmLeads.map(w=>[lower(w.username),w])),[a.warmLeads]);
  const directSet=useMemo(()=>new Set(a.directSupporters.map(s=>lower(s.authorHandle))),[a.directSupporters]);
  const activeSet=useMemo(()=>new Set(state.active.map(lower)),[state.active]);
  const incomingSet=useMemo(()=>new Set(state.incoming.map(lower)),[state.incoming]);
  const serverSeen=useMemo(()=>new Set([...state.likes,...state.passes,...state.matches].map(lower)),[state.likes,state.passes,state.matches]);
  const localSeenSet=useMemo(()=>new Set(localSeen.map(lower)),[localSeen]);

  const deck=useMemo(()=>{
    const inviter=invitedBy?lower(invitedBy):'';
    return a.candidates
      .filter(c=>!c.dominated&&!directSet.has(lower(c.username))&&!serverSeen.has(lower(c.username))&&!localSeenSet.has(lower(c.username)))
      .filter(c=>c.power>0)
      .sort((x,y)=>{
        const score=(c:MarketCandidate)=>
          (lower(c.username)===inviter?100000:0)+
          (incomingSet.has(lower(c.username))?50000:0)+
          (activeSet.has(lower(c.username))?10000:0)+
          (warmMap.has(lower(c.username))?5000:0)+
          (c.helpsThemCross?2500:0)+
          c.strategicFit*10+c.userRankGain;
        return score(y)-score(x);
      });
  },[a.candidates,directSet,serverSeen,localSeenSet,incomingSet,activeSet,warmMap,invitedBy]);

  const current=deck[0];
  const warm=current?warmMap.get(lower(current.username)):undefined;
  const isActive=current?activeSet.has(lower(current.username)):false;
  const likesYou=current?incomingSet.has(lower(current.username)):false;
  const matchSet=useMemo(()=>new Set(state.matches.map(lower)),[state.matches]);
  const pendingHandles=useMemo(()=>unique([...state.likes,...localPending]).filter(h=>!matchSet.has(h)),[state.likes,localPending,matchSet]);
  const pendingCandidates=useMemo(()=>pendingHandles.map(h=>a.candidates.find(c=>lower(c.username)===h)).filter((c):c is MarketCandidate=>Boolean(c)),[pendingHandles,a.candidates]);
  const matches=state.matches.map(h=>a.candidates.find(c=>lower(c.username)===lower(h))).filter((c):c is MarketCandidate=>Boolean(c));

  const chooseRemaining=(n:number)=>{
    setRemaining(n);
    window.localStorage.setItem(storageKey,String(n));
  };

  const finishCard=(target:string,verdict:'VOUCH'|'PASS')=>{
    setLocalSeen(currentSeen=>unique([...currentSeen,target]));
    if(verdict==='VOUCH')setLocalPending(currentPending=>unique([...currentPending,target]));
    setDirection(null);
    setDrag({x:0,y:0});
  };

  const swipeCard=async(verdict:'VOUCH'|'PASS')=>{
    if(!current||direction)return;
    if(verdict==='VOUCH'&&remaining===0){setMessage('NO VOUCHES LEFT.');return;}
    const target=current.username;
    const alreadyLikes=likesYou;
    setDirection(verdict==='VOUCH'?'right':'left');
    window.setTimeout(()=>finishCard(target,verdict),260);

    try{
      const res=await fetch('/api/match',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'swipe',actor:a.user.username,target,verdict})});
      if(!res.ok)return;
      const result=await res.json() as {matched?:boolean;enabled?:boolean};
      if(verdict==='VOUCH'&&(result.matched||alreadyLikes)){
        setLocalPending(currentPending=>currentPending.filter(h=>lower(h)!==lower(target)));
        window.setTimeout(()=>setMatchHandle(target),300);
      }
      await refreshState();
    }catch{}
  };

  const onPointerDown=(e:React.PointerEvent<HTMLElement>)=>{
    if(direction)return;
    dragOrigin.current={x:e.clientX,y:e.clientY};
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove=(e:React.PointerEvent<HTMLElement>)=>{
    if(!dragging||direction)return;
    setDrag({x:e.clientX-dragOrigin.current.x,y:(e.clientY-dragOrigin.current.y)*.28});
  };
  const releaseDrag=()=>{
    if(!dragging)return;
    setDragging(false);
    if(drag.x>105)swipeCard('VOUCH');
    else if(drag.x<-105)swipeCard('PASS');
    else setDrag({x:0,y:0});
  };

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(view!=='deck'||matchHandle)return;
      if(e.key==='ArrowLeft')swipeCard('PASS');
      if(e.key==='ArrowRight')swipeCard('VOUCH');
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  });

  const verify=async(target:string)=>{
    setChecking(target);setMessage('CHECKING COMMONS…');
    try{
      const res=await fetch('/api/match',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'verify',actor:a.user.username,target})});
      const data=await res.json();
      if(data.verified){
        setMessage('VOUCH FOUND.');
        setRemaining(r=>r===undefined?r:Math.max(0,r-1));
        await refreshState();
      }else setMessage('NOT ON THE LEDGER YET.');
    }catch{setMessage('CHECK FAILED.');}
    setChecking(undefined);
  };

  const xNudge=(target:string)=>{
    const link=`${window.location.origin}/${encodeURIComponent(target)}?from=${encodeURIComponent(a.user.username)}`;
    const text=`@${target} I have a Commons vouch waiting for you. Swipe me back if you want the trade: ${link}`;
    return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
  };

  if(remaining===undefined){
    return <main className="match-app onboarding">
      <section className="onboard-card">
        <p className="commons-word">commons</p>
        <p className="match-kicker">@{a.user.username.toUpperCase()} · #{a.user.rank}</p>
        <h1>HOW MANY<br/><em>VOUCHES LEFT?</em></h1>
        <p>Set it once. Completed matches update the number automatically.</p>
        <div className="vouch-picker">{Array.from({length:vouchLimit+1},(_,i)=><button key={i} onClick={()=>chooseRemaining(i)}>{i}</button>)}</div>
        <small>ROUND SUPPLY: {vouchLimit}</small>
      </section>
    </main>;
  }

  const cardStyle=direction?undefined:{transform:`translate3d(${drag.x}px,${drag.y}px,0) rotate(${drag.x/20}deg)`,transition:dragging?'none':'transform .42s cubic-bezier(.2,.8,.2,1)'};
  const vouchStamp=Math.max(0,Math.min(1,drag.x/90));
  const passStamp=Math.max(0,Math.min(1,-drag.x/90));

  return <main className="match-app">
    <header className="match-topbar">
      <a href="/" className="commons-brand"><span>commons</span><b>match</b></a>
      <div className="match-tabs">
        <button className={view==='deck'?'on':''} onClick={()=>setView('deck')}>DISCOVER</button>
        <button className={view==='pending'?'on':''} onClick={()=>setView('pending')}>PENDING {pendingHandles.length>0&&<i>{pendingHandles.length}</i>}</button>
        <button className={view==='matches'?'on':''} onClick={()=>setView('matches')}>MATCHES {state.matches.length>0&&<i>{state.matches.length}</i>}</button>
      </div>
      <div className="match-inventory"><span>VOUCHES LEFT</span><b>{remaining}</b><small>OF {vouchLimit}</small></div>
    </header>

    {view==='deck'?<section className="deck-stage">
      <aside className="deck-context">
        <p className="match-kicker">VOUCH / PASS</p>
        <h1>FIND YOUR<br/><em>NEXT MATCH.</em></h1>
        <div className="your-chip"><span>YOU</span><strong>@{a.user.username}</strong><b>#{a.user.rank}</b><em>+{k(a.ownPower)} VOUCH</em></div>
        <div className="goal-pills"><button className={goal==='GET_IN'?'on':''} onClick={()=>setGoal('GET_IN')}>GET IN</button><button className={goal==='CLIMB'?'on':''} onClick={()=>setGoal('CLIMB')}>CLIMB</button><button className={goal==='MAX_SCORE'?'on':''} onClick={()=>setGoal('MAX_SCORE')}>MAX SCORE</button></div>
        <div className="pool-stats"><span><b>{state.active.length}</b> PLAYING</span><span><b>{state.incoming.length}</b> LIKE YOU</span><span><b>{pendingHandles.length}</b> PENDING</span>{nextSupplyAt&&<span>NEXT SUPPLY <b><Countdown to={nextSupplyAt}/></b></span>}</div>
      </aside>

      <div className="card-zone">
        {current?<>
          <div className="ghost-card g2"/><div className="ghost-card g1"/>
          <article
            className={`vouch-card ${direction?`swipe-${direction}`:''} ${dragging?'is-dragging':''}`}
            style={cardStyle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={releaseDrag}
            onPointerCancel={releaseDrag}
          >
            <div className="swipe-stamp stamp-vouch" style={{opacity:vouchStamp}}>VOUCH</div>
            <div className="swipe-stamp stamp-pass" style={{opacity:passStamp}}>PASS</div>
            <div className="card-visual">
              {current.avatarUrl?<><img className="card-photo-blur" src={current.avatarUrl} alt=""/><img className="card-avatar" src={current.avatarUrl} alt=""/></>:<div className="card-avatar avatar-fallback">@</div>}
              <div className="card-statuses">{likesYou&&<span className="status-hot">LIKES YOU</span>}{isActive&&<span>PLAYING</span>}{warm&&<span>1 HOP AWAY</span>}{current.helpsThemCross&&<span>YOU PUT THEM IN</span>}</div>
              <div className="card-person"><div><small>#{current.rank.toLocaleString()}</small><h2>@{current.username}</h2><p>{current.display||'Commons player'}</p></div></div>
            </div>
            {warm&&<div className="card-path">@{current.username} <i>→</i> @{warm.via[0]} <i>→</i> YOU</div>}
            <div className="exchange-grid">
              <div><span>YOU GET</span><b>+{k(current.power)}</b><small>#{a.user.rank} → ~#{current.userRankAfter}</small></div>
              <i>♥</i>
              <div><span>THEY GET</span><b>+{k(a.ownPower)}</b><small>#{current.rank} → ~#{current.candidateRankAfter}</small></div>
            </div>
            <div className="card-reason">{likesYou?'THEY ALREADY CHOSE YOU.':warm?`ONE CONNECTION AWAY VIA @${warm.via[0]}.`:current.helpsThemCross?'YOUR VOUCH PUTS THEM OVER #1000.':current.candidateRankGain>=50?`YOUR VOUCH MOVES THEM ${current.candidateRankGain} RANKS.`:current.returnRatio>=1?'THEY BRING BACK MORE WEIGHT THAN YOU GIVE.':'A CLOSE TRADE.'}</div>
            <div className="swipe-actions"><button className="pass" onClick={e=>{e.stopPropagation();swipeCard('PASS')}}><span>×</span><small>PASS</small></button><button className="vouch" onClick={e=>{e.stopPropagation();swipeCard('VOUCH')}}><span>♥</span><small>VOUCH</small></button></div>
            <div className="keyboard-hint">DRAG OR USE ← / →</div>
          </article>
        </>:<div className="deck-empty"><p className="commons-word">commons</p><h2>THAT'S THE DECK.</h2><p>Your right swipes are waiting in Pending.</p><button onClick={()=>setView('pending')}>VIEW PENDING</button></div>}
      </div>

      <aside className="match-activity">
        <p className="match-kicker">RIGHT NOW</p>
        <div><span>PLAYING</span><b>{state.active.length}</b></div>
        <div><span>LIKE YOU</span><b>{state.incoming.length}</b></div>
        <div><span>PENDING</span><b>{pendingHandles.length}</b></div>
        <div><span>MATCHED</span><b>{state.matches.length}</b></div>
        <div><span>CLEARED</span><b>{Number(state.stats.completed??0)}</b></div>
        {!state.enabled&&<p className="store-note">Matching sync is offline. Your local swipes still stay on this device.</p>}
      </aside>
    </section>:view==='pending'?<section className="pending-stage">
      <div className="pending-head"><p className="match-kicker">WAITING ON THEM</p><h1>{pendingHandles.length}<br/><em>PENDING.</em></h1><p>Nothing to do. Keep swiping. If they choose you too, it becomes a match.</p><button onClick={()=>setView('deck')}>BACK TO DISCOVER</button></div>
      <div className="pending-list">{pendingCandidates.map(c=><article key={c.username}><div>{c.avatarUrl?<img src={c.avatarUrl} alt=""/>:<span>@</span>}<strong>@{c.username}</strong><small>#{c.rank}</small></div><b>+{k(c.power)}</b><p>#{a.user.rank} → ~#{c.userRankAfter}</p><span className="pending-pill">WAITING</span><a href={xNudge(c.username)} target="_blank" rel="noreferrer">NUDGE ON X ↗</a></article>)}{!pendingCandidates.length&&<div className="no-matches"><h2>NOTHING PENDING.</h2><p>Swipe VOUCH on someone and they'll wait here without interrupting the deck.</p><button onClick={()=>setView('deck')}>DISCOVER</button></div>}</div>
    </section>:<section className="matches-stage">
      <div className="matches-head"><p className="commons-word">commons</p><p className="match-kicker">YOUR MATCHES</p><h1>YOU BOTH<br/><em>SAID VOUCH.</em></h1></div>
      <div className="matches-list">{matches.map(c=>{
        const deal=state.deals.find(d=>d.a===lower(c.username)||d.b===lower(c.username));
        const actorIsA=deal?.a===lower(a.user.username);
        const youDone=actorIsA?deal?.aDone:deal?.bDone;
        const theyDone=actorIsA?deal?.bDone:deal?.aDone;
        return <article key={c.username} className={deal?.clearedAt?'cleared':''}>
          <div className="match-title"><span>{deal?.clearedAt?'CLEARED':'MATCHED'}</span><h2>@{c.username}</h2><b>+{k(c.power)} TO YOU</b></div>
          <div className="match-flow"><div><span>YOU</span><b>+{k(a.ownPower)}</b><small>{youDone?'LEDGER ✓':'NOT VERIFIED'}</small></div><i>♥</i><div><span>@{c.username}</span><b>+{k(c.power)}</b><small>{theyDone?'LEDGER ✓':'NOT VERIFIED'}</small></div></div>
          <div className="match-buttons"><a href={`https://x.com/intent/post?text=${encodeURIComponent(`Hey @commonsmade, I vouch for @${c.username}`)}`} target="_blank" rel="noreferrer">VOUCH @{c.username.toUpperCase()} ↗</a><button onClick={()=>verify(c.username)} disabled={checking===c.username}>{checking===c.username?'CHECKING…':'CHECK LEDGER'}</button></div>
        </article>;
      })}{!matches.length&&<div className="no-matches"><h2>NO MATCHES YET.</h2><p>Your right swipes stay pending until someone chooses you too.</p><button onClick={()=>setView('deck')}>BACK TO DISCOVER</button></div>}</div>
    </section>}

    {message&&<button className="match-toast" onClick={()=>setMessage('')}>{message}</button>}

    {matchHandle&&<div className="match-overlay"><div className="match-burst one"/><div className="match-burst two"/><div className="match-modal"><p className="commons-word">commons</p><span>IT'S A</span><h2>VOUCH.</h2><div><strong>@{a.user.username}</strong><i>♥</i><strong>@{matchHandle}</strong></div><p>You both chose each other.</p><button onClick={()=>{setMatchHandle(undefined);setView('matches');refreshState()}}>OPEN MATCH</button></div></div>}
  </main>;
}
