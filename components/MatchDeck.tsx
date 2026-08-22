'use client';

import { useEffect, useMemo, useState } from 'react';
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

function Countdown({to}:{to?:string}) {
  const [value,setValue] = useState('');
  useEffect(()=>{
    if (!to) return;
    const tick=()=>{
      const d=Math.max(0,new Date(to).getTime()-Date.now());
      const h=Math.floor(d/3600000),m=Math.floor(d%3600000/60000),s=Math.floor(d%60000/1000);
      setValue(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick(); const id=setInterval(tick,1000); return()=>clearInterval(id);
  },[to]);
  return <>{value||'—'}</>;
}

export function MatchDeck({analysis:a,vouchLimit,nextSupplyAt,invitedBy}:Props) {
  const storageKey=`commons-gto:vouches-left:${a.user.username.toLowerCase()}:${vouchLimit}`;
  const [remaining,setRemaining]=useState<number|undefined>(a.remaining);
  const [goal,setGoal]=useState<'GET_IN'|'CLIMB'|'MAX_SCORE'>(a.qualified?'CLIMB':'GET_IN');
  const [state,setState]=useState<MatchState>({enabled:false,active:[],likes:[],incoming:[],passes:[],matches:[],deals:[],profiles:{},stats:{}});
  const [index,setIndex]=useState(0);
  const [direction,setDirection]=useState<'left'|'right'|null>(null);
  const [matchHandle,setMatchHandle]=useState<string|undefined>();
  const [inviteHandle,setInviteHandle]=useState<string|undefined>();
  const [view,setView]=useState<'deck'|'matches'>('deck');
  const [checking,setChecking]=useState<string|undefined>();
  const [message,setMessage]=useState('');

  const refreshState=async()=>{
    try {
      const res=await fetch(`/api/match?actor=${encodeURIComponent(a.user.username)}`,{cache:'no-store'});
      if (res.ok) setState(await res.json());
    } catch {}
  };

  useEffect(()=>{
    if (a.remaining!==undefined) { setRemaining(a.remaining); return; }
    const raw=window.localStorage.getItem(storageKey);
    if(raw!==null){const n=Number(raw);if(Number.isInteger(n)&&n>=0&&n<=vouchLimit)setRemaining(n);}
  },[a.remaining,storageKey,vouchLimit]);

  useEffect(()=>{refreshState(); const id=setInterval(refreshState,20000); return()=>clearInterval(id);},[a.user.username]);

  useEffect(()=>{
    if(remaining===undefined)return;
    window.localStorage.setItem(storageKey,String(remaining));
    fetch('/api/match',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'join',actor:a.user.username,remaining,goal,rank:a.user.rank,power:a.ownPower})}).then(refreshState).catch(()=>{});
  },[remaining,goal,a.user.username,a.user.rank,a.ownPower,storageKey]);

  const warmMap=useMemo(()=>new Map(a.warmLeads.map(w=>[lower(w.username),w])),[a.warmLeads]);
  const directSet=useMemo(()=>new Set(a.directSupporters.map(s=>lower(s.authorHandle))),[a.directSupporters]);
  const activeSet=useMemo(()=>new Set(state.active.map(lower)),[state.active]);
  const incomingSet=useMemo(()=>new Set(state.incoming.map(lower)),[state.incoming]);
  const seenSet=useMemo(()=>new Set([...state.likes,...state.passes,...state.matches].map(lower)),[state.likes,state.passes,state.matches]);

  const deck=useMemo(()=>{
    const inviter=invitedBy?lower(invitedBy):'';
    return a.candidates
      .filter(c=>!c.dominated&&!directSet.has(lower(c.username))&&!seenSet.has(lower(c.username)))
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
  },[a.candidates,directSet,seenSet,incomingSet,activeSet,warmMap,invitedBy]);

  const current=deck[index]??deck[0];
  const warm=current?warmMap.get(lower(current.username)):undefined;
  const isActive=current?activeSet.has(lower(current.username)):false;
  const likesYou=current?incomingSet.has(lower(current.username)):false;
  const rankForScore=(score:number)=>1+a.rankScores.filter(v=>v>score).length;

  const chooseRemaining=(n:number)=>{
    setRemaining(n);
    window.localStorage.setItem(storageKey,String(n));
  };

  const swipeCard=async(verdict:'VOUCH'|'PASS')=>{
    if(!current||direction)return;
    if(verdict==='VOUCH'&&remaining===0){setMessage('NO VOUCHES LEFT.');return;}
    setDirection(verdict==='VOUCH'?'right':'left');
    let result:{matched?:boolean;enabled?:boolean}={};
    try{
      const res=await fetch('/api/match',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'swipe',actor:a.user.username,target:current.username,verdict})});
      if(res.ok)result=await res.json();
    }catch{}
    window.setTimeout(()=>{
      if(verdict==='VOUCH'){
        if(result.matched||likesYou){setMatchHandle(current.username);setInviteHandle(undefined);}
        else if(!isActive){setInviteHandle(current.username);setMessage(`@${current.username} ISN'T PLAYING YET.`);}
        else setMessage(`VOUCHED RIGHT ON @${current.username}.`);
      }
      setIndex(i=>i+1);setDirection(null);
    },330);
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

  const xInvite=(target:string)=>{
    const link=`${window.location.origin}/${encodeURIComponent(target)}?from=${encodeURIComponent(a.user.username)}`;
    const text=`@${target} I swiped VOUCH on you. If the numbers work for you, swipe back: ${link}`;
    return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
  };

  if(remaining===undefined){
    return <main className="match-app onboarding">
      <section className="onboard-card">
        <p className="match-kicker">@{a.user.username.toUpperCase()} · #{a.user.rank}</p>
        <h1>HOW MANY<br/><em>VOUCHES LEFT?</em></h1>
        <p>Commons doesn't publish outgoing usage for searched accounts. Set it once. From here, completed matches update it automatically.</p>
        <div className="vouch-picker">{Array.from({length:vouchLimit+1},(_,i)=><button key={i} onClick={()=>chooseRemaining(i)}>{i}</button>)}</div>
        <small>ROUND SUPPLY: {vouchLimit}</small>
      </section>
    </main>;
  }

  const matches=state.matches.map(h=>a.candidates.find(c=>lower(c.username)===lower(h))).filter((c):c is MarketCandidate=>Boolean(c));

  return <main className="match-app">
    <header className="match-topbar">
      <a href="/" className="brand">COMMONS <b>GTO</b></a>
      <div className="match-tabs"><button className={view==='deck'?'on':''} onClick={()=>setView('deck')}>DISCOVER</button><button className={view==='matches'?'on':''} onClick={()=>setView('matches')}>MATCHES <i>{state.matches.length}</i></button></div>
      <div className="match-inventory"><span>YOU HAVE</span><b>{remaining}</b><small>VOUCH{remaining===1?'':'ES'} LEFT</small></div>
    </header>

    {view==='deck'?<section className="deck-stage">
      <aside className="deck-context">
        <p className="match-kicker">VOUCH / PASS</p>
        <h1>FIND SOMEONE<br/>WORTH YOUR VOUCH.</h1>
        <div className="your-chip"><span>YOU</span><strong>@{a.user.username}</strong><b>#{a.user.rank}</b><em>+{k(a.ownPower)} VOUCH</em></div>
        <div className="goal-pills"><button className={goal==='GET_IN'?'on':''} onClick={()=>setGoal('GET_IN')}>GET IN</button><button className={goal==='CLIMB'?'on':''} onClick={()=>setGoal('CLIMB')}>CLIMB</button><button className={goal==='MAX_SCORE'?'on':''} onClick={()=>setGoal('MAX_SCORE')}>MAX SCORE</button></div>
        <div className="pool-stats"><span><b>{state.active.length}</b> PLAYING NOW</span><span><b>{state.incoming.length}</b> VOUCHED RIGHT ON YOU</span>{nextSupplyAt&&<span>NEXT SUPPLY <b><Countdown to={nextSupplyAt}/></b></span>}</div>
      </aside>

      <div className="card-zone">
        {current?<>
          <div className="ghost-card g2"/><div className="ghost-card g1"/>
          <article className={`vouch-card ${direction?`swipe-${direction}`:''}`}>
            <div className="card-statuses">{likesYou&&<span className="status-hot">LIKES YOU</span>}{isActive&&<span>PLAYING NOW</span>}{warm&&<span>WARM PATH</span>}{current.helpsThemCross&&<span>YOU PUT THEM IN</span>}</div>
            <div className="card-person">
              {current.avatarUrl?<img src={current.avatarUrl} alt=""/>:<div className="avatar-fallback">@</div>}
              <div><small>#{current.rank.toLocaleString()}</small><h2>@{current.username}</h2><p>{current.display||'Commons player'}</p></div>
            </div>
            {warm&&<div className="card-path">@{current.username} <i>→</i> @{warm.via[0]} <i>→</i> YOU</div>}
            <div className="exchange-grid">
              <div><span>THEY GIVE YOU</span><b>+{k(current.power)}</b><small>#{a.user.rank} → ~#{current.userRankAfter}</small></div>
              <i>⇄</i>
              <div><span>YOU GIVE THEM</span><b>+{k(a.ownPower)}</b><small>#{current.rank} → ~#{current.candidateRankAfter}</small></div>
            </div>
            <div className="card-reason">{likesYou?'THEY ALREADY SWIPED VOUCH ON YOU.':warm?`YOU'RE ONE CONNECTION APART VIA @${warm.via[0]}.`:current.helpsThemCross?'YOUR VOUCH PUTS THEM OVER #1000.':current.candidateRankGain>=50?`YOUR VOUCH MOVES THEM ${current.candidateRankGain} RANKS.`:current.returnRatio>=1?'THEY RETURN MORE WEIGHT THAN YOU GIVE.':'THE NUMBERS ARE CLOSE.'}</div>
            <div className="swipe-actions"><button className="pass" onClick={()=>swipeCard('PASS')}><span>←</span> PASS</button><button className="vouch" onClick={()=>swipeCard('VOUCH')}>VOUCH <span>→</span></button></div>
            <div className="keyboard-hint">← PASS <span/> VOUCH →</div>
          </article>
        </>:<div className="deck-empty"><h2>YOU'VE SEEN THE DECK.</h2><p>Come back after the next Commons update, or open your matches.</p><button onClick={()=>{setIndex(0);setView('matches')}}>VIEW MATCHES</button></div>}
      </div>

      <aside className="match-activity">
        <p className="match-kicker">RIGHT NOW</p>
        <div><span>ACTIVE POOL</span><b>{state.active.length}</b></div>
        <div><span>LIKES YOU</span><b>{state.incoming.length}</b></div>
        <div><span>MATCHES</span><b>{state.matches.length}</b></div>
        <div><span>CLEARED</span><b>{Number(state.stats.completed??0)}</b></div>
        {!state.enabled&&<p className="store-note">Live mutual matching needs the Vercel KV binding. Swipe invites still work.</p>}
      </aside>
    </section>:<section className="matches-stage">
      <div className="matches-head"><p className="match-kicker">YOUR MATCHES</p><h1>YOU BOTH<br/>SAID VOUCH.</h1></div>
      <div className="matches-list">{matches.map(c=>{
        const deal=state.deals.find(d=>d.a===lower(c.username)||d.b===lower(c.username));
        const actorIsA=deal?.a===lower(a.user.username);
        const youDone=actorIsA?deal?.aDone:deal?.bDone;
        const theyDone=actorIsA?deal?.bDone:deal?.aDone;
        return <article key={c.username} className={deal?.clearedAt?'cleared':''}>
          <div className="match-title"><span>{deal?.clearedAt?'CLEARED':'MATCHED'}</span><h2>@{c.username}</h2><b>+{k(c.power)} TO YOU</b></div>
          <div className="match-flow"><div><span>YOU</span><b>+{k(a.ownPower)}</b><small>{youDone?'LEDGER ✓':'NOT VERIFIED'}</small></div><i>⇄</i><div><span>@{c.username}</span><b>+{k(c.power)}</b><small>{theyDone?'LEDGER ✓':'NOT VERIFIED'}</small></div></div>
          <div className="match-buttons"><a href={`https://x.com/intent/post?text=${encodeURIComponent(`Hey @commonsmade, I vouch for @${c.username}`)}`} target="_blank" rel="noreferrer">VOUCH @{c.username.toUpperCase()} ↗</a><button onClick={()=>verify(c.username)} disabled={checking===c.username}>{checking===c.username?'CHECKING…':'CHECK LEDGER'}</button></div>
        </article>;
      })}{!matches.length&&<div className="no-matches"><h2>NO MATCHES YET.</h2><p>Swipe VOUCH on people you'd actually trade with. If they swipe back, they land here.</p><button onClick={()=>setView('deck')}>BACK TO DISCOVER</button></div>}</div>
    </section>}

    {message&&<button className="match-toast" onClick={()=>setMessage('')}>{message}</button>}

    {inviteHandle&&<div className="invite-sheet"><div><p className="match-kicker">NOT PLAYING YET</p><h2>BRING @{inviteHandle.toUpperCase()} IN.</h2><p>You swiped VOUCH. Send them the card and let them decide.</p><div><a href={xInvite(inviteHandle)} target="_blank" rel="noreferrer">INVITE ON X ↗</a><button onClick={()=>setInviteHandle(undefined)}>KEEP SWIPING</button></div></div></div>}

    {matchHandle&&<div className="match-overlay"><div className="match-burst"/><div className="match-modal"><p>IT'S A</p><h2>VOUCH.</h2><div><strong>@{a.user.username}</strong><i>⇄</i><strong>@{matchHandle}</strong></div><p>You both swiped right. The deal is open.</p><button onClick={()=>{setMatchHandle(undefined);setView('matches');refreshState()}}>OPEN MATCH</button></div></div>}
  </main>;
}
