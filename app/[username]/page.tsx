import { Footer } from '@/components/Footer';
import { MatchDeck } from '@/components/MatchDeck';
import { Search } from '@/components/Search';
import { getCommonsSnapshot, CommonsDataError } from '@/lib/commons';
import { analyseMarket } from '@/lib/strategy';

export default async function Result({params,searchParams}:{params:Promise<{username:string}>;searchParams:Promise<{from?:string}>}) {
  const username = decodeURIComponent((await params).username).replace(/^@/,'');
  const invitedBy = (await searchParams).from?.replace(/^@/,'');
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
  if (!analysis || !snapshot) return <main className="result"><nav><a className="brand" href="/">COMMONS <b>GTO</b></a><Search compact/><span className="source-state off"><i/>DATA UNAVAILABLE</span></nav><section className="unavailable"><h1>COMMONS DATA<br/>UNAVAILABLE</h1><p>{error.includes('not present')?error:'We couldn’t fetch the latest leaderboard. Try again shortly.'}</p><a href="/">TRY AGAIN</a></section><Footer/></main>;

  const clientAnalysis = {
    user: analysis.user,
    target: analysis.target,
    ownPower: analysis.ownPower,
    need: analysis.need,
    qualified: analysis.qualified,
    remaining: analysis.remaining,
    candidates: analysis.candidates.slice(0,900),
    directSupporters: analysis.directSupporters,
    warmLeads: analysis.warmLeads,
    rankScores: analysis.rankScores,
  };

  return <>
    <MatchDeck analysis={clientAnalysis} vouchLimit={snapshot.vouchLimit??7} nextSupplyAt={snapshot.nextSupplyAt} invitedBy={invitedBy}/>
  </>;
}
