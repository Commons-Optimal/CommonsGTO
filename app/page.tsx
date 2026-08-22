import { Search } from '@/components/Search';
import { Field } from '@/components/Field';
import { Footer } from '@/components/Footer';
import { CommonsDataError, getCommonsSnapshot } from '@/lib/commons';

export default async function Home(){
  let status: {count:number; time:string; source:string}|null=null;
  try { const s=await getCommonsSnapshot(); status={count:s.participants.length,time:s.upstreamUpdatedAt??s.fetchedAt,source:s.source}; } catch(e) { if (!(e instanceof CommonsDataError)) throw e; }
  return <main className="home">
    <nav><a className="brand" href="/">COMMONS <b>GTO</b></a><span className={`source-state ${status?'ok':'off'}`}><i/>{status?'COMMONS UPDATE':'DATA UNAVAILABLE'}</span><a href="#method">HOW IT WORKS</a></nav>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">COMMONS VOUCH TOOL</p><h1>DON’T WASTE<br/>YOUR <em>SEVEN.</em></h1><p className="dek">See what your vouch is worth,<br/>who needs you, and who can move you.</p><Search/>{!status&&<div className="data-warning"><b>COMMONS DATA UNAVAILABLE</b><span>We couldn’t fetch the latest leaderboard.<br/>Try again after the next Commons update.</span></div>}</div><div className="hero-field"><Field/><p className="field-note">{status?<><b>{status.count.toLocaleString()}</b> PLAYERS<br/>UPDATED {new Date(status.time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} UTC</>:<>COMMONS DATA<br/>UNAVAILABLE</>}</p></div></section>
    <section className="method" id="method"><p className="eyebrow">HOW IT WORKS</p><h2>Your score. Their score.<br/>One vouch each.</h2><div><span>01 / FIND YOUR POSITION</span><span>02 / CHECK WHO NEEDS YOU</span><span>03 / COMPARE WHAT COMES BACK</span><span>04 / KEEP IT IF THE TRADE IS BAD</span></div></section><Footer/>
  </main>;
}
