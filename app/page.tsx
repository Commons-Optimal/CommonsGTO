import { getCutoff, getLeaderboard } from "@/lib/commons";
import SearchForm from "./search-form";

const number = new Intl.NumberFormat("en-US");

export default async function Home() {
  const state = await getLeaderboard();
  const cutoff = getCutoff(state.participants);
  return <div className="shell home">
    {state.source === "demo" && <div className="demo-notice"><b>DEMO DATA</b><span>Live Commons access is not configured. Recommendations are illustrative.</span></div>}
    <section className="hero">
      <p className="eyebrow">THE COMMONS VOUCH OPTIMISER</p>
      <h1>Don&apos;t waste<br />your <em>five.</em></h1>
      <p className="lede">Find the mathematically efficient move from the current public game state.</p>
      <SearchForm />
    </section>
    <section className="ticker" aria-label="Leaderboard status">
      <div><span>TOP 1,000 CUTOFF</span><strong>{number.format(cutoff)}</strong></div>
      <div><span>PARTICIPANTS</span><strong>{number.format(state.participants.length)}</strong></div>
      <div><span>DATA STATUS</span><strong className={state.source === "live" ? "positive" : "amber"}>{state.source === "live" ? "LIVE" : "DEMO"}</strong></div>
    </section>
    <section className="principles">
      <article><b>01</b><h2>Know what you need</h2><p>Find the exact inbound vouch weight required to cross the line.</p></article>
      <article><b>02</b><h2>Find mutual matches</h2><p>See who benefits from your vouch just as much as you benefit from theirs.</p></article>
      <article><b>03</b><h2>Use your five optimally</h2><p>Stop treating every vouch as equal. The numbers are the strategy.</p></article>
    </section>
  </div>;
}
