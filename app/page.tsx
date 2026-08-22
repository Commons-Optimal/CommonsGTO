import { Search } from '@/components/Search';
import { Field } from '@/components/Field';
import { Footer } from '@/components/Footer';
import { CommonsDataError, getCommonsSnapshot } from '@/lib/commons';

export default async function Home(){
  let status: {count:number; time:string; source:string}|null=null;
  try { const s=await getCommonsSnapshot(); status={count:s.participants.length,time:s.upstreamUpdatedAt??s.fetchedAt,source:s.source}; } catch(e) { if (!(e instanceof CommonsDataError)) throw e; }
  return <main className="home">
    <nav><a className="brand" href="/">COMMONS <b>GTO</b></a><span className={`source-state ${status?'ok':'off'}`}><i/>{status?'COMMONS SNAPSHOT':'DATA UNAVAILABLE'}</span><a href="#method">METHOD ↘</a></nav>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">LIVE VOUCH MARKET / STRATEGY ENGINE</p><h1>DON’T WASTE<br/>YOUR <em>FIVE.</em></h1><p className="dek">Find the strongest move from the real Commons game state—not a sample leaderboard.</p><Search/>{!status&&<div className="data-warning"><b>COMMONS DATA UNAVAILABLE</b><span>Analysis is paused until the authoritative source reconnects. No sample data will be substituted.</span></div>}</div><div className="hero-field"><Field/><p className="field-note">{status?<><b>{status.count.toLocaleString()}</b> PARTICIPANTS<br/>FETCHED {new Date(status.time).toLocaleString('en-GB',{timeZone:'UTC'})} UTC<br/>SOURCE {status.source}</>:<>MARKET VISUAL<br/>AWAITING SNAPSHOT</>}</p></div></section>
    <section className="method" id="method"><p className="eyebrow">ONE SCARCE ASSET / MANY POSSIBLE MOVES</p><h2>Optimise the exchange,<br/>not just the gap.</h2><div><span>01 / WHO NEEDS YOU</span><span>02 / MUTUAL UTILITY</span><span>03 / RESERVATION VALUE</span><span>04 / HOLD WHEN DOMINATED</span></div></section><Footer/>
  </main>;
}
