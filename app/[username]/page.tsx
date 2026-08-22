import Link from "next/link";
import { notFound } from "next/navigation";
import { CREATOR, RULES } from "@/lib/config";
import { getCutoff, getLeaderboard } from "@/lib/commons";
import { findMinimumQualifyingCombination } from "@/lib/combinations";
import { findBestMatches, type Match } from "@/lib/matching";
import { minimumDonorBase, pointsNeeded, safetyMargin, slashRiskBase, vouchValue } from "@/lib/scoring";

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const n = (value: number) => whole.format(Math.ceil(value));
const k = (value: number) => compact.format(value).toLowerCase();

function MatchCard({ match }: { match: Match }) {
  const m = match;
  return <article className="match-card">
    <div className="match-head"><div><span className="avatar">{m.candidate.username[0].toUpperCase()}</span><div><h3>@{m.candidate.username}</h3><p>BASE {k(m.candidate.baseScore)} · RANK #{n(m.candidate.rank)}</p></div></div><strong>{Math.round(m.score * 100)} <small>MATCH</small></strong></div>
    {m.mutuallyQualifying && <div className="win">✓ WIN / WIN — BOTH CROSS TOP 1,000</div>}
    <div className="exchange">
      <div><span>THEY GIVE YOU</span><b>+{k(m.candidatePower)}</b><small>YOU NEED +{k(m.userNeed)}</small></div>
      <i>⇄</i>
      <div><span>YOU GIVE THEM</span><b>+{k(m.userPower)}</b><small>{m.candidateNeed ? `THEY NEED +${k(m.candidateNeed)}` : "ALREADY QUALIFIED"}</small></div>
    </div>
    <div className="match-foot"><span>{m.oneVouchSolution ? "ENOUGH IN ONE" : `${Math.round(m.qualification * 100)}% OF YOUR GAP`}</span><a href={`https://x.com/${m.candidate.username}`} target="_blank">VIEW ON X ↗</a></div>
  </article>;
}

export default async function Profile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const state = await getLeaderboard();
  const user = state.participants.find((p) => p.username.toLowerCase() === decodeURIComponent(username).toLowerCase());
  if (!user) notFound();
  const cutoff = getCutoff(state.participants, RULES.qualifyingRank);
  const need = pointsNeeded(user.totalScore, cutoff);
  const power = vouchValue(user.baseScore);
  const margin = safetyMargin(user.totalScore, cutoff);
  const matches = findBestMatches(user, state.participants, cutoff);
  const combo = findMinimumQualifyingCombination(matches, need);
  const shareText = `Looking for a strategic Commons vouch match.\n\nMy vouch: +${k(power)}\nI need: +${k(need)}\nBest match: ${k(minimumDonorBase(need))}+ base\n\nCheck compatibility: ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://commonsoptimal.xyz"}/${user.username}`;
  const creatorIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Hey @commonsmade, I vouch for @${CREATOR}`)}`;

  return <div className="shell profile">
    <Link href="/" className="back">← NEW SEARCH</Link>
    {state.source === "demo" && <div className="demo-notice"><b>DEMO DATA</b><span>Live endpoint unavailable. Do not act on these illustrative scores.</span></div>}
    <section className="identity">
      <div><p className="eyebrow">STRATEGY FOR</p><h1>@{user.username}</h1><span className="timestamp">● {state.source === "live" ? "LIVE STATE" : "ILLUSTRATIVE STATE"}</span></div>
      <div className="rank"><span>CURRENT RANK</span><strong>#{n(user.rank)}</strong><small>{need === 0 ? "INSIDE" : "OUTSIDE"} TOP 1,000</small></div>
    </section>
    <section className="score-grid">
      <div><span>CURRENT SCORE</span><strong>{n(user.totalScore)}</strong><small>BASE {n(user.baseScore)}</small></div>
      <div><span>{need ? "TO TOP 1,000" : "SAFETY MARGIN"}</span><strong className={need ? "amber" : "positive"}>{need ? "+" : "+"}{n(need || margin)}</strong><small>CUTOFF {n(cutoff)}</small></div>
      <div><span>YOUR VOUCH</span><strong className="positive">+{n(power)}</strong><small>35% OF BASE</small></div>
      <div><span>{need ? "MINIMUM DONOR BASE" : "ONE-SLASH RISK BASE"}</span><strong>{n(need ? minimumDonorBase(need) : slashRiskBase(margin))}</strong><small>{need ? "FOR ONE VOUCH" : "ERASES MARGIN"}</small></div>
    </section>
    <section className="best-move">
      <div><p className="eyebrow">YOUR BEST MOVE</p><h2>{need === 0 ? "You’re in. Build a safer margin." : matches.some((m) => m.oneVouchSolution) ? "One vouch can get you in." : "Build the smallest qualifying route."}</h2></div>
      <p>{need === 0 ? `You are ${n(margin)} points above the line. One slash from roughly ${k(slashRiskBase(margin))}+ base would erase that margin.` : <>Target someone with <b>≥{k(minimumDonorBase(need))} base</b> who needs <b>≤{k(power)}</b> themselves. That gives both sides a reason to move.</>}</p>
    </section>
    {need > 0 && combo && <section className="route"><div><p className="eyebrow">MOST EFFICIENT ROUTE</p><h2>{combo.matches.map((m) => `@${m.candidate.username}`).join(" + ")}</h2></div><div><strong>+{k(combo.total)}</strong><span>CROSSES BY +{k(combo.surplus)}</span></div></section>}
    <section className="matches"><div className="section-head"><div><p className="eyebrow">BEST MATCHES</p><h2>People with a reason to say yes.</h2></div><span>{matches.filter((m) => m.candidateNeed > 0 && m.userPower >= m.candidateNeed).length} NEED YOU</span></div><div className="match-list">{matches.slice(0, 6).map((m) => <MatchCard key={m.candidate.username} match={m} />)}</div></section>
    <section className="share"><div><p className="eyebrow">MAKE THE MARKET</p><h2>Share what you need.</h2><p>Let compatible participants check the trade for themselves.</p></div><a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`} target="_blank">SHARE STRATEGY ON X ↗</a></section>
    <section className="creator"><p>FOUND THIS USEFUL?</p><h2>If this improved your strategy and you have a spare vouch, support its creator.</h2><a href={creatorIntent} target="_blank">VOUCH @{CREATOR} ↗</a></section>
  </div>;
}
