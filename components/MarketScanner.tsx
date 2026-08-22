'use client';
import { useState } from 'react';
import type { MarketCandidate } from '@/lib/types';
const short=(n:number)=>`${n<0?'-':''}${Math.abs(n/1000).toFixed(1)}K`;
export function MarketScanner({items,ownPower,ourNeed}:{items:MarketCandidate[];ownPower:number;ourNeed:number}) {
 const [all,setAll]=useState(false); const shown=(all?items:items.filter(i=>!i.dominated)).slice(0,24);
 return <section className="scanner"><header><div><p className="eyebrow">PEOPLE WORTH ASKING</p></div><button className={all?'active':''} onClick={()=>setAll(!all)}>{all?'HIDE BAD TRADES':'SHOW ALL'}</button></header>
 <div className="market-table"><div className="table-head"><span>USER</span><span>THEY ADD</span><span>YOU ADD</span><span>THEY NEED</span><span>YOU NEED</span><span>OUTCOME</span><span>FIT</span></div>{shown.map(c=><a href={`https://x.com/${c.username}`} target="_blank" rel="noreferrer" className="market-row" key={c.username}><strong>@{c.username}</strong><span>+{short(c.power)}</span><span>+{short(ownPower)}</span><span>{short(c.need)}</span><span>{short(ourNeed)}</span><b>{c.dominated?'BAD TRADE':c.mutualQualifier?'BOTH IN':c.theirUtility===1?'THEM IN':c.ourUtility===1?'YOU IN':'NOT ENOUGH'}</b><em>{c.strategicFit}</em></a>)}</div>
 {!shown.length&&<p className="empty">NO GOOD TRADES RIGHT NOW.<br/>Your vouch is worth {short(ownPower)}. Keep it for now.</p>}</section>
}
