import { Search } from '@/components/Search';
import { Footer } from '@/components/Footer';
import { CommonsDataError, getCommonsSnapshot } from '@/lib/commons';

export default async function Home(){
  let status:{count:number;time:string;vouches:number;next?:number;nextAt?:string}|null=null;
  try{
    const s=await getCommonsSnapshot();
    status={count:s.totalParticipants??s.participants.length,time:s.upstreamUpdatedAt??s.fetchedAt,vouches:s.vouchLimit??7,next:s.nextVouchLimit,nextAt:s.nextSupplyAt};
  }catch(e){if(!(e instanceof CommonsDataError))throw e;}
  return <main className="home match-home">
    <nav><a className="brand" href="/">COMMONS <b>GTO</b></a><span className={`source-state ${status?'ok':'off'}`}><i/>{status?'COMMONS LIVE':'DATA UNAVAILABLE'}</span><a href="#how">HOW IT WORKS</a></nav>
    <section className="match-home-hero">
      <div className="match-home-copy">
        <p className="eyebrow">VOUCH / PASS</p>
        <h1>FIND SOMEONE<br/>WORTH YOUR<br/><em>VOUCH.</em></h1>
        <p className="dek">Swipe real Commons players. If you both say VOUCH, it’s a match.</p>
        <Search label="START MATCHING"/>
        {status&&<div className="home-live"><span><b>{status.count.toLocaleString()}</b> PLAYERS</span><span><b>{status.vouches}</b> ROUND VOUCHES</span><span>UPDATED <b>{new Date(status.time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} UTC</b></span></div>}
      </div>
      <div className="home-deck" aria-hidden="true">
        <div className="home-card back two"/><div className="home-card back one"/>
        <div className="home-card front">
          <div className="demo-badges"><span>PLAYING NOW</span><span>YOU PUT THEM IN</span></div>
          <div className="demo-person"><div className="demo-avatar">@</div><div><small>#1,084</small><h2>@someone</h2><p>Commons player</p></div></div>
          <div className="demo-swap"><div><span>THEY GIVE YOU</span><b>+94.2K</b><small>#783 → ~#571</small></div><i>⇄</i><div><span>YOU GIVE THEM</span><b>+62.8K</b><small>#1,084 → ~#946</small></div></div>
          <p className="demo-reason">YOUR VOUCH PUTS THEM OVER #1000.</p>
          <div className="demo-buttons"><span>← PASS</span><strong>VOUCH →</strong></div>
        </div>
      </div>
    </section>
    <section className="match-how" id="how"><p className="eyebrow">HOW IT WORKS</p><div><article><small>01</small><h2>SWIPE</h2><p>Every card shows what the exchange does for both sides.</p></article><article><small>02</small><h2>MATCH</h2><p>If both players choose VOUCH, the deal opens.</p></article><article><small>03</small><h2>VOUCH</h2><p>Post the Commons vouch. We check the public ledger.</p></article><article><small>04</small><h2>CLEAR</h2><p>Both sides complete it. Your remaining count updates.</p></article></div></section>
    <Footer/>
  </main>;
}
