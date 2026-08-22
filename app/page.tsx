import { Search } from '@/components/Search';
import { Field } from '@/components/Field';
import { Footer } from '@/components/Footer';
import { CommonsDataError, getCommonsMeta } from '@/lib/commons';

const words: Record<number,string> = {5:'FIVE',6:'SIX',7:'SEVEN',8:'EIGHT',9:'NINE',10:'TEN',11:'ELEVEN',12:'TWELVE'};
const short=(n:number)=>n>=1_000_000?`${(n/1_000_000).toFixed(2)}M`:`${(n/1_000).toFixed(1)}K`;

export default async function Home(){
  let status: {count:number; time:string; source:string; cutoff:number; vouches:number}|null=null;
  try {
    const s=await getCommonsMeta();
    status={count:s.totalParticipants??0,time:s.fetchedAt,source:s.source,cutoff:s.cutoffRank1000,vouches:s.vouchLimit??7};
  } catch(e) { if (!(e instanceof CommonsDataError)) throw e; }
  const supply=status?.vouches??7;
  const supplyLabel=words[supply]??String(supply);
  return <main className="home">
    <nav><a className="brand" href="/">COMMONS <b>GTO</b></a><span className={`source-state ${status?'ok':'off'}`}><i/>{status?'COMMONS CONNECTED':'DATA UNAVAILABLE'}</span><a href="#method">HOW IT WORKS</a></nav>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">COMMONS VOUCH TOOL</p><h1>DON’T WASTE<br/>YOUR <em>{supplyLabel}.</em></h1><p className="dek">See what your vouch is worth,<br/>who needs you, and who can move you.</p><Search/>{!status&&<div className="data-warning"><b>COMMONS DATA UNAVAILABLE</b><span>We couldn’t fetch the leaderboard.<br/>Try again.</span></div>}</div><div className="hero-field"><Field/><p className="field-note">{status?<><b>{status.count.toLocaleString()}</b> PLAYERS<br/>TOP 1000 · {short(status.cutoff)}<br/>{status.vouches} VOUCHES · {status.vouches} SLASHES<br/>CHECKED {new Date(status.time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} UTC</>:<>COMMONS DATA<br/>UNAVAILABLE</>}</p></div></section>
    <section className="method" id="method"><p className="eyebrow">HOW IT WORKS</p><h2>Your score. Their score.<br/>One vouch each.</h2><div><span>01 / FIND YOUR POSITION</span><span>02 / CHECK WHO NEEDS YOU</span><span>03 / COMPARE WHAT COMES BACK</span><span>04 / KEEP IT IF THE TRADE IS BAD</span></div></section><Footer/>
  </main>;
}
