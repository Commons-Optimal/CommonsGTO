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
    <nav>
      <a className="commons-brand" href="/"><span>commons</span><b>match</b></a>
      <span className={`source-state ${status?'ok':'off'}`}><i/>{status?'LIVE':'OFFLINE'}</span>
      <a href="#how">HOW IT WORKS</a>
    </nav>
    <section className="match-home-hero">
      <div className="match-home-copy">
        <p className="commons-word">commons</p>
        <p className="eyebrow">UNOFFICIAL MATCHING TOOL</p>
        <h1>VOUCH<br/><em>OR PASS.</em></h1>
        <p className="dek">Swipe Commons players. A mutual VOUCH opens the deal.</p>
        <Search label="START SWIPING"/>
        {status&&<div className="home-live"><span><b>{status.count.toLocaleString()}</b> PLAYERS</span><span><b>{status.vouches}</b> ROUND VOUCHES</span><span>UPDATED <b>{new Date(status.time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} UTC</b></span></div>}
      </div>
      <div className="home-deck" aria-hidden="true">
        <div className="home-card back two"/><div className="home-card back one"/>
        <div className="home-card front">
          <div className="demo-badges"><span>LIKES YOU</span><span>YOU PUT THEM IN</span></div>
          <div className="demo-person"><div className="demo-avatar">@</div><div><small>#1,084</small><h2>@someone</h2><p>Commons player</p></div></div>
          <div className="demo-swap"><div><span>YOU GET</span><b>+94.2K</b><small>#783 → ~#571</small></div><i>♥</i><div><span>THEY GET</span><b>+62.8K</b><small>#1,084 → ~#946</small></div></div>
          <p className="demo-reason">THEY ALREADY CHOSE YOU.</p>
          <div className="demo-buttons"><span>× &nbsp; PASS</span><strong>♥ &nbsp; VOUCH</strong></div>
        </div>
      </div>
    </section>
    <section className="match-how" id="how"><p className="eyebrow">HOW IT WORKS</p><div><article><small>01</small><h2>SWIPE</h2><p>Every card shows what one vouch does for both sides.</p></article><article><small>02</small><h2>WAIT</h2><p>Right swipes sit quietly in Pending. Keep moving.</p></article><article><small>03</small><h2>MATCH</h2><p>If they choose you too, the deal opens.</p></article><article><small>04</small><h2>CLEAR</h2><p>Post the vouch. The Commons ledger verifies it.</p></article></div></section>
    <Footer/>
  </main>;
}
