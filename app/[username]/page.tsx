import { Footer } from '@/components/Footer';
import { Search } from '@/components/Search';
import { StrategyDashboard } from '@/components/StrategyDashboard';
import { getCommonsSnapshot, CommonsDataError } from '@/lib/commons';
import { analyseMarket } from '@/lib/strategy';

export default async function Result({params}:{params:Promise<{username:string}>}) {
  const username = decodeURIComponent((await params).username).replace(/^@/,'');
  let analysis: ReturnType<typeof analyseMarket> = null;
  let snapshot;
  let error = '';

  try {
    snapshot = await getCommonsSnapshot(username);
    analysis = analyseMarket(snapshot,username);
    if (!analysis) error = `@${username} is not present in the current Commons snapshot.`;
  } catch (e) {
    error = e instanceof CommonsDataError ? e.message : 'The Commons snapshot could not be loaded.';
  }

  if (!analysis || !snapshot) {
    return <main className="result">
      <nav><a className="brand" href="/">COMMONS <b>GTO</b></a><Search compact/><span className="source-state off"><i/>DATA UNAVAILABLE</span></nav>
      <section className="unavailable"><h1>COMMONS DATA<br/>UNAVAILABLE</h1><p>{error.includes('not present') ? error : 'We couldn’t fetch the latest leaderboard. Try again shortly.'}</p><a href="/">TRY AGAIN</a></section>
      <Footer/>
    </main>;
  }

  const updatedAt = snapshot.upstreamUpdatedAt ?? snapshot.fetchedAt;
  const clientAnalysis = {
    ...analysis,
    candidates: analysis.candidates.slice(0,750),
    actionable: analysis.actionable.slice(0,250),
  };

  return <main className="result result-v2">
    <nav className="result-nav"><a className="brand" href="/">COMMONS <b>GTO</b></a><Search compact/><span className="source-state ok"><i/>UPDATED · {new Date(updatedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} UTC</span></nav>
    <StrategyDashboard
      analysis={clientAnalysis}
      totalParticipants={snapshot.totalParticipants ?? snapshot.participants.length}
      vouchLimit={snapshot.vouchLimit ?? 7}
      slashLimit={snapshot.slashLimit ?? 7}
      nextSupplyAt={snapshot.nextSupplyAt}
      nextVouchLimit={snapshot.nextVouchLimit}
      nextSlashLimit={snapshot.nextSlashLimit}
      updatedAt={updatedAt}
    />
    <Footer/>
  </main>;
}
