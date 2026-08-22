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
  actionable: MarketCandidate[];
  topAsk?: MarketCandidate;
  directSupporters: CommonsLedgerEntry[];
  warmLeads: WarmLead[];
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
  const warmTop = a.warmLeads[0];
  const warmTopCandidate = warmTop ? pool.find(c => c.username.toLowerCase() === warmTop.username.toLowerCase()) : undefined;
  const [focus,setFocus] = useState<MarketCandidate | undefined>(warmTopCandidate ?? a.topAsk);
  const [filter,setFilter] = useState<'need'|'power'|'all'>('need');
  const [query,setQuery] = useState('');
  const [compare,setCompare] = useState('');
  const [planner,setPlanner] = useState<string[]>([]);
  const [rows,setRows] = useState(20);
  const [manualRemaining,setManualRemaining] = useState<number | undefined>(a.remaining);

  useEffect(() => {
    if (a.remaining !== undefined) {
      setManualRemaining(a.remaining);
      return;
    }
    const raw = window.localStorage.getItem(`commons-gto:vouches-left:${a.user.username.toLowerCase()}:${vouchLimit}`);
    if (raw !== null) {
      const value = Number(raw);
      if (Number.isInteger(value) && value >= 0 && value <= vouchLimit) setManualRemaining(value);
    }
  },[a.remaining,a.user.username,vouchLimit]);

  const personalRemaining = a.remaining ?? manualRemaining;
  const setRemaining = (value:number) => {
    setManualRemaining(value);
    setPlanner(current => current.slice(0,value));
    window.localStorage.setItem(`commons-gto:vouches-left:${a.user.username.toLowerCase()}:${vouchLimit}`,String(value));
  };

  const rankForScore = (score:number) => 1 + a.rankScores.filter(value => value > score).length;
  const focusScore = focus ? a.user.totalScore + focus.power : a.user.totalScore;
  const focusRank = focus ? focus.userRankAfter : a.user.rank;
  const buffer = a.user.totalScore - a.target;
  const ladderPosition = (rank:number) => clamp((1000 - Math.min(1000, Math.max(100, rank))) / 900 * 100, 0, 100);
  const currentPos = ladderPosition(a.user.rank);
  const focusPos = ladderPosition(focusRank);

  const filtered = useMemo(() => {
    let list = pool.filter(c => !c.dominated && !a.directSupporters.some(s => s.authorHandle.toLowerCase() === c.username.toLowerCase()));
    if (filter === 'need') list = list.filter(c => c.need > 0 && c.need <= a.ownPower);
    if (filter === 'power') list = [...list].sort((x,y) => y.power - x.power);
    if (query.trim()) {
      const q = query.toLowerCase().replace(/^@/,'');
      list = list.filter(c => c.username.toLowerCase().includes(q) || c.display?.toLowerCase().includes(q));
    }
    return list;
  },[pool,filter,query,a.ownPower,a.directSupporters]);

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
    if (personalRemaining === undefined || personalRemaining <= 0) return;
    setPlanner(current => {
      if (current.includes(candidate.username) || current.length >= personalRemaining) return current;
      return [...current,candidate.username];
    });
  };

  const focusWarmLead = (lead:WarmLead) => {
    const candidate = pool.find(c => c.username.toLowerCase() === lead.username.toLowerCase());
    if (candidate) setFocus(candidate);
  };

  const heroLine = a.qualified
    ? `YOU'RE ${k(Math.max(0,buffer))} ABOVE #1000.`
    : `${k(a.need)} TO #1000.`;

  return <>
    <section className="gto-hero">
      <div className="gto-identity reveal r1">
        <p className="eyebrow">@{a.user.username.toUpperCase()}</p>
        <div className="rank-hero">#{a.user.rank.toLocaleString()}</div>
        <h1>{a.qualified && a.nextTargetGap !== undefined ? `#${a.nextTargetRank} IS ${k(a.nextTargetGap)} AWAY.` : `YOU NEED ${k(a.need)}.`}</h1>
        <p className="hero-line">{heroLine}</p>
      </div>

      <div className="gto-stats reveal r2">
        <div><span>SCORE</span><b>{k(a.user.totalScore)}</b></div>
        <div><span>BASE</span><b>{k(a.user.baseScore)}</b></div>
        <div><span>YOUR VOUCH</span><b>{k(a.ownPower)}</b></div>
        <div><span>#1000</span><b>{k(a.target)}</b></div>
        <div><span>WARM LEADS</span><b>{a.warmLeads.length}</b></div>
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
        <div><span>ROUND VOUCHES</span><b>{vouchLimit}</b><small>GLOBAL SUPPLY</small></div>
        <div><span>ROUND SLASHES</span><b>{slashLimit}</b><small>GLOBAL SUPPLY</small></div>
        {nextSupplyAt && <div className="unlock"><span>NEXT SUPPLY</span><b><Countdown to={nextSupplyAt}/></b><small>{nextVouchLimit ?? vouchLimit} VOUCHES · {nextSlashLimit ?? slashLimit} SLASHES</small></div>}
      </div>
    </section>

    <section className="network-grid">
      <div className="warm-primary reveal r2">
        <p className="eyebrow">BEST WARM PATH</p>
        {warmTop ? <>
          <h2>@{warmTop.username}</h2>
          <div className="warm-path"><strong>@{warmTop.username}</strong><i>→</i><strong>@{warmTop.via[0]}</strong><i>→</i><strong>YOU</strong></div>
          <p className="warm-explain">@{warmTop.via[0]} already vouched you. @{warmTop.username} already vouched @{warmTop.via[0]}.</p>
          <div className="big-delta">+{k(warmTop.power)}</div>
          <div className="rank-change">#{a.user.rank} <i>→</i> ~#{warmTop.userRankAfter}</div>
          <div className="give-back">
            <span>YOU GIVE</span><b>+{k(a.ownPower)}</b>
            <span>THEY GET</span><b>{warmTop.candidateRankAfter ? `~#${warmTop.candidateRankAfter}` : 'RANK UNKNOWN'}</b>
            <span>WHY THEY CARE</span><b>{warmTop.helpsThemCross ? 'YOUR VOUCH PUTS THEM OVER #1000' : warmTop.candidateRankGain ? `+${warmTop.candidateRankGain} RANKS` : 'CHECK THE ASK'}</b>
          </div>
          <div className="quick-actions"><a href={`https://x.com/${warmTop.username}`} target="_blank" rel="noreferrer">OPEN @{warmTop.username.toUpperCase()} ↗</a><a href={`https://x.com/${warmTop.via[0]}`} target="_blank" rel="noreferrer">OPEN VIA @{warmTop.via[0].toUpperCase()} ↗</a>{warmTopCandidate && <button onClick={()=>addPlan(warmTopCandidate)}>ADD TO PLAN +</button>}</div>
        </> : <><h2>NO SECOND-DEGREE PATH YET.</h2><p className="warm-explain">We found your incoming vouches, but none of their incoming networks produced a useful match in the current market.</p></>}
      </div>

      <div className="supporters-panel reveal r3">
        <p className="eyebrow">ALREADY BACKED YOU</p>
        <div className="supporter-count">{a.directSupporters.length}</div>
        <p>These are the people your warm paths run through.</p>
        <div className="supporter-list">
          {a.directSupporters.slice(0,8).map(s => <a key={`${s.authorHandle}-${s.tweetId ?? ''}`} href={s.tweetUrl || `https://x.com/${s.authorHandle}`} target="_blank" rel="noreferrer"><span>@{s.authorHandle}</span><b>+{k(s.points)}</b></a>)}
        </div>
      </div>

      <div className="personal-panel reveal r4">
        <p className="eyebrow">YOUR VOUCHES LEFT</p>
        {personalRemaining !== undefined ? <>
          <div className="personal-number">{personalRemaining}</div>
          <p>Saved on this device.</p>
          <button className="change-left" onClick={()=>setManualRemaining(undefined)}>CHANGE</button>
        </> : <>
          <div className="personal-number unknown">?</div>
          <p>Commons does not publish this for searched users.</p>
        </>}
        {personalRemaining === undefined && <div className="remaining-picker">{Array.from({length:vouchLimit+1},(_,i)=><button key={i} onClick={()=>setRemaining(i)}>{i}</button>)}</div>}
      </div>
    </section>

    <section className="warm-section">
      <div className="section-heading"><div><p className="eyebrow">YOUR NETWORK</p><h2>PEOPLE ONE STEP AWAY.</h2><p className="section-note">They vouched someone who already vouched you.</p></div><div className="warm-stat"><span>PATHS FOUND</span><b>{a.warmLeads.length}</b></div></div>
      <div className="warm-table">
        <div className="warm-head"><span>PATH</span><span>THEY ADD</span><span>YOU GO</span><span>YOU ADD</span><span>THEY GO</span><span>WHY ASK</span><span></span></div>
        {a.warmLeads.slice(0,18).map(lead => {
          const candidate = pool.find(c => c.username.toLowerCase() === lead.username.toLowerCase());
          return <div className="warm-row" key={lead.username} onMouseEnter={()=>focusWarmLead(lead)} onMouseLeave={()=>setFocus(warmTopCandidate ?? a.topAsk)}>
            <strong><span>@{lead.username}</span><small>via @{lead.via.slice(0,2).join(', @')}</small></strong>
            <span>+{k(lead.power)}</span>
            <span>#{a.user.rank} → <b>~#{lead.userRankAfter}</b></span>
            <span>+{k(a.ownPower)}</span>
            <span>{lead.candidateRankAfter ? `${lead.rank ? `#${lead.rank} → ` : ''}~#${lead.candidateRankAfter}` : '—'}</span>
            <em>{lead.helpsThemCross ? 'YOU PUT THEM IN' : lead.candidateRankGain && lead.candidateRankGain >= 30 ? `THEY GAIN ${lead.candidateRankGain} RANKS` : lead.pathCount > 1 ? `${lead.pathCount} MUTUAL PATHS` : 'WARM PATH'}</em>
            <div className="warm-actions"><a href={`https://x.com/${lead.username}`} target="_blank" rel="noreferrer">↗</a>{candidate && <button onClick={()=>addPlan(candidate)}>+</button>}</div>
          </div>;
        })}
        {!a.warmLeads.length && <div className="warm-empty">NO WARM LEADS FOUND FROM THE CURRENT LEDGER.</div>}
      </div>
    </section>

    <section className="quick-grid market-grid">
      <div className="needs-panel">
        <p className="eyebrow">WHO NEEDS YOUR WEIGHT</p>
        <div className="needs-number">{a.whoNeeds.toLocaleString()}</div>
        <p>people are within one {k(a.ownPower)} vouch of #1000.</p>
        <div className="needs-funnel">{a.thresholds.map(t => <button key={t.amount} onClick={()=>setFilter('need')}><b>{t.count}</b><span>CAN RETURN {k(t.amount)}+</span></button>)}</div>
      </div>
      <div className="market-snapshot">
        <p className="eyebrow">THE MARKET</p>
        <div className="snapshot-row"><span>PLAYERS</span><b>{totalParticipants.toLocaleString()}</b></div>
        {a.ladder.slice().reverse().map(point => <div className="snapshot-row" key={point.rank}><span>#{point.rank}</span><b>{k(point.score)}</b></div>)}
        <div className="snapshot-row"><span>MEDIAN VOUCH</span><b>{k(a.medianVouchPower)}</b></div>
        <div className="snapshot-row"><span>YOUR VOUCH</span><b>TOP {Math.max(1,100-a.vouchPercentile)}%</b></div>
      </div>
      <div className="cold-note">
        <p className="eyebrow">COLD MARKET</p>
        <h3>{filtered.length}</h3>
        <p>Mathematically useful accounts with no known path to you. Use these after the warm list.</p>
      </div>
    </section>

    <section className="asks-section cold-section">
      <div className="section-heading"><div><p className="eyebrow">COLD MARKET</p><h2>NO KNOWN CONNECTION.</h2></div><div className="ask-controls"><button className={filter==='need'?'on':''} onClick={()=>setFilter('need')}>NEED YOU</button><button className={filter==='power'?'on':''} onClick={()=>setFilter('power')}>POWER</button><button className={filter==='all'?'on':''} onClick={()=>setFilter('all')}>ALL</button><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="@username" /></div></div>
      <div className="asks-table">
        <div className="asks-head"><span>USER</span><span>THEY ADD</span><span>YOU GO</span><span>YOU ADD</span><span>THEY GO</span><span>WHY ASK</span><span></span></div>
        {filtered.slice(0,rows).map(c => <div className="ask-row" key={c.username} onMouseEnter={()=>setFocus(c)} onMouseLeave={()=>setFocus(warmTopCandidate ?? a.topAsk)}>
          <strong>@{c.username}</strong><span>+{k(c.power)}</span><span>#{a.user.rank} → <b>~#{c.userRankAfter}</b></span><span>+{k(a.ownPower)}</span><span>#{c.rank} → <b>~#{c.candidateRankAfter}</b></span><em>{c.helpsThemCross ? 'YOU PUT THEM IN' : c.candidateRankGain >= 50 ? `THEY GAIN ${c.candidateRankGain} RANKS` : 'NO WARM PATH'}</em><button onClick={()=>addPlan(c)}>+</button>
        </div>)}
      </div>
      {filtered.length > rows && <button className="load-more" onClick={()=>setRows(x=>x+20)}>SHOW 20 MORE</button>}
    </section>

    <section className="compare-section">
      <div className="compare-copy"><p className="eyebrow">COMPARE</p><h2>CHECK SOMEONE YOU KNOW.</h2><p>Enter a handle and see exactly what a one-for-one does for both sides.</p><div className="compare-input"><span>@</span><input value={compare} onChange={e=>setCompare(e.target.value)} placeholder="username" /></div></div>
      <div className="compare-card">
        {compareUser ? <><div className="compare-name"><span>YOU</span><span>@{compareUser.username}</span></div><div className="compare-flow"><div><small>YOU RECEIVE</small><b>+{k(compareUser.power)}</b><em>#{a.user.rank} → ~#{compareUser.userRankAfter}</em></div><i>⇄</i><div><small>THEY RECEIVE</small><b>+{k(a.ownPower)}</b><em>#{compareUser.rank} → ~#{compareUser.candidateRankAfter}</em></div></div><p className="trade-verdict">{compareUser.helpsThemCross ? 'YOUR VOUCH PUTS THEM OVER #1000.' : compareUser.candidateRankGain > 30 ? `YOUR VOUCH MOVES THEM ${compareUser.candidateRankGain} RANKS.` : 'THE RETURN IS BETTER FOR YOU.'}</p><button onClick={()=>addPlan(compareUser)}>ADD TO PLAN +</button></> : <div className="compare-empty">TYPE A HANDLE.</div>}
      </div>
    </section>

    <section className="seven-section plan-section">
      <div className="seven-head"><div><p className="eyebrow">PLAN THE REST</p><h2>{personalRemaining === undefined ? 'SET YOUR VOUCHES LEFT.' : `${personalRemaining} VOUCH${personalRemaining===1?'':'ES'} LEFT.`}</h2></div><div className="seven-total"><span>IF THEY RETURN</span><b>+{k(plannedInbound)}</b><small>#{a.user.rank} → ~#{plannedRank}</small></div></div>
      {personalRemaining === undefined ? <div className="plan-picker"><span>HOW MANY DO YOU HAVE LEFT?</span><div>{Array.from({length:vouchLimit+1},(_,i)=><button key={i} onClick={()=>setRemaining(i)}>{i}</button>)}</div><small>Commons exposes the round supply, not an arbitrary user's remaining count.</small></div> : <>
        <div className="seven-slots personal-slots" style={{gridTemplateColumns:`repeat(${Math.max(1,Math.min(personalRemaining,7))},1fr)`}}>{Array.from({length:personalRemaining},(_,i) => { const candidate=planned[i]; return <div className={`seven-slot ${candidate?'filled':''}`} key={i}><small>{String(i+1).padStart(2,'0')}</small>{candidate ? <><strong>@{candidate.username}</strong><b>+{k(candidate.power)}</b><span>~#{candidate.userRankAfter} alone</span><button onClick={()=>setPlanner(current=>current.filter(name=>name!==candidate.username))}>REMOVE</button></> : <><strong>OPEN</strong><span>ADD A WARM OR COLD LEAD</span></>}</div>;})}</div>
        <div className="seven-summary"><div><span>SCORE NOW</span><b>{k(a.user.totalScore)}</b></div><div><span>IF ALL RETURN</span><b>{k(plannedScore)}</b></div><div><span>RANK</span><b>~#{plannedRank}</b></div><div><span>TOP-1000 SHARE</span><b>{pct(plannedShare)}</b></div></div>
        <div className="plan-actions">{planner.length>0&&<button className="clear-plan" onClick={()=>setPlanner([])}>CLEAR PLAN</button>}<button className="clear-plan" onClick={()=>setManualRemaining(undefined)}>CHANGE VOUCHES LEFT</button></div>
      </>}
    </section>

    <section className="creator-strip"><span>BUILT BY @CYPHRGM</span><a href="https://x.com/intent/post?text=Hey%20%40commonsmade%2C%20I%20vouch%20for%20%40Cyphrgm" target="_blank" rel="noreferrer">GOT ONE LEFT? VOUCH @CYPHRGM ↗</a><small>UPDATED {new Date(updatedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} UTC</small></section>
  </>;
}
