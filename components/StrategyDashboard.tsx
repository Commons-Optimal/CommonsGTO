'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MarketCandidate, Participant } from '@/lib/types';

type Analysis = {
  user: Participant;
  target: number;
  ownPower: number;
  need: number;
  qualified: boolean;
  remaining: number;
  candidates: MarketCandidate[];
  actionable: MarketCandidate[];
  topAsk?: MarketCandidate;
  whoNeeds: number;
  reciprocal: number;
  ladder: { rank:number; score:number }[];
  nextTargetRank: number;
  nextTargetScore?: number;
  nextTargetGap?: number;
  scoreShare: number;
  top1000Total: number;
  vouchPercentile: number;
  medianVouchPower: number;
  thresholds: { amount:number; count:number }[];
  rankScores: number[];
};

type Props = {
  analysis: Analysis;
  totalParticipants: number;
  vouchLimit: number;
  slashLimit: number;
  nextSupplyAt?: string;
  nextVouchLimit?: number;
  nextSlashLimit?: number;
  updatedAt: string;
};

const k = (n:number) => `${n < 0 ? '−' : ''}${Math.abs(n / 1000).toFixed(1)}K`;
const pct = (n:number) => `${(n * 100).toFixed(3)}%`;
const clamp = (n:number, lo=0, hi=100) => Math.max(lo, Math.min(hi, n));

function Countdown({to}:{to?:string}) {
  const [text,setText] = useState('');
  useEffect(() => {
    if (!to) return;
    const tick = () => {
      const diff = Math.max(0, new Date(to).getTime() - Date.now());
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor(diff % 3_600_000 / 60_000);
      const s = Math.floor(diff % 60_000 / 1000);
      setText(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  },[to]);
  return <>{text || '—'}</>;
}

export function StrategyDashboard({analysis:a,totalParticipants,vouchLimit,slashLimit,nextSupplyAt,nextVouchLimit,nextSlashLimit,updatedAt}:Props) {
  const pool = a.candidates;
  const [focus,setFocus] = useState<MarketCandidate | undefined>(a.topAsk);
  const [filter,setFilter] = useState<'best'|'need'|'power'>('best');
  const [query,setQuery] = useState('');
  const [compare,setCompare] = useState('');
  const [planner,setPlanner] = useState<string[]>([]);
  const [rows,setRows] = useState(20);

  const rankForScore = (score:number) => 1 + a.rankScores.filter(value => value > score).length;
  const focusScore = focus ? a.user.totalScore + focus.power : a.user.totalScore;
  const focusRank = focus ? focus.userRankAfter : a.user.rank;
  const buffer = a.user.totalScore - a.target;

  const ladderPosition = (rank:number) => clamp((1000 - Math.min(1000, Math.max(100, rank))) / 900 * 100, 0, 100);
  const currentPos = ladderPosition(a.user.rank);
  const focusPos = ladderPosition(focusRank);

  const filtered = useMemo(() => {
    let list = pool.filter(c => !c.dominated);
    if (filter === 'need') list = list.filter(c => c.need > 0 && c.need <= a.ownPower);
    if (filter === 'power') list = [...list].sort((x,y) => y.power - x.power);
    if (query.trim()) {
      const q = query.toLowerCase().replace(/^@/,'');
      list = list.filter(c => c.username.toLowerCase().includes(q) || c.display?.toLowerCase().includes(q));
    }
    return list;
  },[pool,filter,query,a.ownPower]);

  const compareUser = useMemo(() => {
    const q = compare.toLowerCase().replace(/^@/,'').trim();
    if (!q) return undefined;
    return pool.find(c => c.username.toLowerCase() === q) ?? pool.find(c => c.username.toLowerCase().includes(q));
  },[compare,pool]);

  const planned = planner.map(name => pool.find(c => c.username === name)).filter((c):c is MarketCandidate => Boolean(c));
  const plannedInbound = planned.reduce((sum,c) => sum + c.power,0);
  const plannedScore = a.user.totalScore + plannedInbound;
  const plannedRank = rankForScore(plannedScore);
  const plannedShare = (a.top1000Total + plannedInbound) > 0 ? plannedScore / (a.top1000Total + plannedInbound) : a.scoreShare;

  const addPlan = (candidate:MarketCandidate) => {
    setPlanner(current => {
      if (current.includes(candidate.username) || current.length >= vouchLimit) return current;
      return [...current,candidate.username];
    });
  };

  const topThree = a.actionable.slice(0,3);
  const heroLine = a.qualified
    ? `THE LINE IS ${k(Math.max(0,buffer))} BEHIND YOU.`
    : `${k(a.need)} TO #1000.`;

  return <>
    <section className="gto-hero">
      <div className="gto-identity reveal r1">
        <p className="eyebrow">@{a.user.username.toUpperCase()}</p>
        <div className="rank-hero">#{a.user.rank.toLocaleString()}</div>
        <h1>{a.qualified ? 'YOU’RE IN. NOW BUILD SCORE.' : `YOU NEED ${k(a.need)}.`}</h1>
        <p className="hero-line">{heroLine}</p>
      </div>

      <div className="gto-stats reveal r2">
        <div><span>SCORE</span><b>{k(a.user.totalScore)}</b></div>
        <div><span>BASE</span><b>{k(a.user.baseScore)}</b></div>
        <div><span>YOUR VOUCH</span><b>{k(a.ownPower)}</b></div>
        <div><span>#1000</span><b>{k(a.target)}</b></div>
        <div><span>NEXT #{a.nextTargetRank}</span><b>{a.nextTargetGap === undefined ? '—' : `+${k(a.nextTargetGap)}`}</b></div>
        <div><span>VOUCH POWER</span><b>TOP {Math.max(1,100-a.vouchPercentile)}%</b></div>
      </div>

      <div className="rank-stage reveal r3">
        <div className="stage-head"><span>RANK LADDER</span><b>{focus ? `@${focus.username} +${k(focus.power)}` : 'CURRENT'}</b></div>
        <div className="rank-track">
          {[1000,750,500,250,100].map(rank => <span key={rank} className="rank-tick" style={{left:`${ladderPosition(rank)}%`}}>#{rank}</span>)}
          <i className="rank-dot current" style={{left:`${currentPos}%`}}><em>#{a.user.rank}</em></i>
          <i className="rank-dot projected" style={{left:`${focusPos}%`}}><em>#{focusRank}</em></i>
          <div className="rank-fill" style={{left:`${Math.min(currentPos,focusPos)}%`,width:`${Math.abs(focusPos-currentPos)}%`}} />
        </div>
        <div className="stage-foot"><span>NOW {k(a.user.totalScore)}</span><span>{focus ? `WITH VOUCH ${k(focusScore)}` : ''}</span></div>
      </div>

      <div className="supply-panel reveal r4">
        <div><span>VOUCHES</span><b>{vouchLimit}</b></div>
        <div><span>SLASHES</span><b>{slashLimit}</b></div>
        {nextSupplyAt && <div className="unlock"><span>NEXT SUPPLY</span><b><Countdown to={nextSupplyAt}/></b><small>{nextVouchLimit ?? vouchLimit} VOUCHES · {nextSlashLimit ?? slashLimit} SLASHES</small></div>}
      </div>
    </section>

    <section className="quick-grid">
      <div className="quick-primary reveal r2">
        <p className="eyebrow">ONE GOOD VOUCH</p>
        {a.topAsk ? <>
          <h2>@{a.topAsk.username}</h2>
          <div className="big-delta">+{k(a.topAsk.power)}</div>
          <div className="rank-change">#{a.user.rank} <i>→</i> ~#{a.topAsk.userRankAfter}</div>
          <div className="give-back"><span>YOU GIVE</span><b>+{k(a.ownPower)}</b><span>@{a.topAsk.username.toUpperCase()} GOES</span><b>#{a.topAsk.rank} → ~#{a.topAsk.candidateRankAfter}</b></div>
          <div className="quick-actions"><a href={`https://x.com/${a.topAsk.username}`} target="_blank" rel="noreferrer">OPEN ON X ↗</a><button onClick={()=>addPlan(a.topAsk!)}>ADD TO SEVEN +</button></div>
        </> : <h2>NO CLEAR ASK YET.</h2>}
      </div>

      <div className="needs-panel reveal r3">
        <p className="eyebrow">WHO NEEDS YOU</p>
        <div className="needs-number">{a.whoNeeds.toLocaleString()}</div>
        <p>people are within one of your {k(a.ownPower)} vouches of #1000.</p>
        <div className="needs-funnel">
          {a.thresholds.map(t => <button key={t.amount} onClick={()=>setFilter('need')}><b>{t.count}</b><span>CAN RETURN {k(t.amount)}+</span></button>)}
        </div>
      </div>

      <div className="market-snapshot reveal r4">
        <p className="eyebrow">THE MARKET</p>
        <div className="snapshot-row"><span>PLAYERS</span><b>{totalParticipants.toLocaleString()}</b></div>
        {a.ladder.slice().reverse().map(point => <div className="snapshot-row" key={point.rank}><span>#{point.rank}</span><b>{k(point.score)}</b></div>)}
        <div className="snapshot-row"><span>MEDIAN VOUCH</span><b>{k(a.medianVouchPower)}</b></div>
        <div className="snapshot-row"><span>TOP-1000 SCORE SHARE</span><b>{pct(a.scoreShare)}</b></div>
      </div>
    </section>

    <section className="asks-section">
      <div className="section-heading"><div><p className="eyebrow">WHAT ONE VOUCH BUYS</p><h2>PEOPLE WORTH ASKING</h2></div><div className="ask-controls"><button className={filter==='best'?'on':''} onClick={()=>setFilter('best')}>BEST</button><button className={filter==='need'?'on':''} onClick={()=>setFilter('need')}>NEED YOU</button><button className={filter==='power'?'on':''} onClick={()=>setFilter('power')}>POWER</button><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="@username" /></div></div>
      <div className="asks-table">
        <div className="asks-head"><span>USER</span><span>THEY ADD</span><span>YOU GO</span><span>YOU ADD</span><span>THEY GO</span><span>WHY ASK</span><span></span></div>
        {filtered.slice(0,rows).map(c => <div className="ask-row" key={c.username} onMouseEnter={()=>setFocus(c)} onMouseLeave={()=>setFocus(a.topAsk)}>
          <strong>@{c.username}</strong>
          <span>+{k(c.power)}</span>
          <span>#{a.user.rank} → <b>~#{c.userRankAfter}</b></span>
          <span>+{k(a.ownPower)}</span>
          <span>#{c.rank} → <b>~#{c.candidateRankAfter}</b></span>
          <em>{c.helpsThemCross ? 'THEY CROSS #1000' : c.candidateRankGain >= 50 ? `THEY GAIN ${c.candidateRankGain} RANKS` : c.power >= a.ownPower ? 'MORE BACK THAN YOU GIVE' : 'FAIR SIZE'}</em>
          <button onClick={()=>addPlan(c)}>+</button>
        </div>)}
      </div>
      {filtered.length > rows && <button className="load-more" onClick={()=>setRows(x=>x+20)}>SHOW 20 MORE</button>}
    </section>

    <section className="compare-section">
      <div className="compare-copy"><p className="eyebrow">COMPARE</p><h2>CHECK A TRADE.</h2><p>Type a handle from the current market and see what one-for-one actually does.</p><div className="compare-input"><span>@</span><input value={compare} onChange={e=>setCompare(e.target.value)} placeholder="username" /></div></div>
      <div className="compare-card">
        {compareUser ? <>
          <div className="compare-name"><span>YOU</span><span>@{compareUser.username}</span></div>
          <div className="compare-flow"><div><small>YOU RECEIVE</small><b>+{k(compareUser.power)}</b><em>#{a.user.rank} → ~#{compareUser.userRankAfter}</em></div><i>⇄</i><div><small>THEY RECEIVE</small><b>+{k(a.ownPower)}</b><em>#{compareUser.rank} → ~#{compareUser.candidateRankAfter}</em></div></div>
          <p className="trade-verdict">{compareUser.helpsThemCross ? 'THEY CROSS #1000.' : compareUser.candidateRankGain > 30 ? `THEY GAIN ${compareUser.candidateRankGain} RANKS.` : 'YOU BENEFIT MORE.'}</p>
          <button onClick={()=>addPlan(compareUser)}>ADD TO SEVEN +</button>
        </> : <div className="compare-empty">TYPE A HANDLE.</div>}
      </div>
    </section>

    <section className="seven-section">
      <div className="seven-head"><div><p className="eyebrow">YOUR SEVEN</p><h2>MODEL THE RETURN.</h2></div><div className="seven-total"><span>IF THEY RETURN</span><b>+{k(plannedInbound)}</b><small>#{a.user.rank} → ~#{plannedRank}</small></div></div>
      <div className="seven-slots">
        {Array.from({length:vouchLimit},(_,i) => {
          const candidate = planned[i];
          return <div className={`seven-slot ${candidate?'filled':''}`} key={i}>
            <small>{String(i+1).padStart(2,'0')}</small>
            {candidate ? <><strong>@{candidate.username}</strong><b>+{k(candidate.power)}</b><span>~#{candidate.userRankAfter} alone</span><button onClick={()=>setPlanner(current=>current.filter(name=>name!==candidate.username))}>REMOVE</button></> : <><strong>OPEN</strong><span>ADD FROM THE TABLE</span></>}
          </div>;
        })}
      </div>
      <div className="seven-summary"><div><span>SCORE NOW</span><b>{k(a.user.totalScore)}</b></div><div><span>IF ALL RETURN</span><b>{k(plannedScore)}</b></div><div><span>RANK</span><b>~#{plannedRank}</b></div><div><span>TOP-1000 SHARE</span><b>{pct(plannedShare)}</b></div></div>
      {planner.length > 0 && <button className="clear-plan" onClick={()=>setPlanner([])}>CLEAR PLAN</button>}
    </section>

    <section className="top-asks-strip">
      <p className="eyebrow">THREE TO LOOK AT FIRST</p>
      <div>{topThree.map((c,i)=><button key={c.username} onMouseEnter={()=>setFocus(c)} onClick={()=>addPlan(c)}><small>0{i+1}</small><strong>@{c.username}</strong><span>+{k(c.power)}</span><em>~#{c.userRankAfter}</em></button>)}</div>
    </section>

    <section className="creator-strip"><span>BUILT BY @CYPHRGM</span><a href="https://x.com/intent/post?text=Hey%20%40commonsmade%2C%20I%20vouch%20for%20%40Cyphrgm" target="_blank" rel="noreferrer">GOT ONE LEFT? VOUCH @CYPHRGM ↗</a><small>UPDATED {new Date(updatedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} UTC</small></section>
  </>;
}
