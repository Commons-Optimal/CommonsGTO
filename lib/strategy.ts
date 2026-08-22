import { GAME } from './config';
import type { CommonsLedgerEntry, CommonsSnapshot, MarketCandidate, WarmLead } from './types';

const clamp = (n:number) => Math.max(0, Math.min(1, n));

export function analyseMarket(snapshot: CommonsSnapshot, username: string) {
  const user = snapshot.participants.find(p => p.username.toLowerCase() === username.toLowerCase());
  if (!user) return null;

  const target = snapshot.cutoffRank1000;
  const ownPower = user.baseScore * GAME.vouchRate;
  const need = Math.max(0, target - user.totalScore);
  const qualified = user.totalScore >= target;
  const rankScores = snapshot.participants.map(p => p.totalScore).sort((a,b) => b-a);
  const rankAfter = (score:number) => 1 + rankScores.filter(value => value > score).length;

  const ladderRanks = [100, 250, 500, 750, 900, 1000];
  const ladder = ladderRanks.map(rank => ({
    rank,
    score: snapshot.participants.find(p => p.rank === rank)?.totalScore ?? 0,
  })).filter(point => point.score > 0);

  const nextTargetRank = !qualified ? 1000
    : user.rank > 750 ? 500
    : user.rank > 500 ? 250
    : user.rank > 250 ? 100
    : user.rank > 100 ? 50
    : user.rank > 50 ? 25
    : user.rank > 25 ? 10
    : 1;
  const nextTargetScore = snapshot.participants.find(p => p.rank === nextTargetRank)?.totalScore;
  const nextTargetGap = nextTargetScore ? Math.max(0, nextTargetScore - user.totalScore) : undefined;

  const allCandidates: MarketCandidate[] = snapshot.participants
    .filter(p => p.username.toLowerCase() !== user.username.toLowerCase())
    .map(p => {
      const power = p.baseScore * GAME.vouchRate;
      const theirNeed = Math.max(0, target - p.totalScore);
      const userScoreAfter = user.totalScore + power;
      const userRankAfter = rankAfter(userScoreAfter);
      const userRankGain = Math.max(0, user.rank - userRankAfter);
      const candidateScoreAfter = p.totalScore + ownPower;
      const candidateRankAfter = rankAfter(candidateScoreAfter);
      const candidateRankGain = Math.max(0, p.rank - candidateRankAfter);
      const canMoveUsAcross = need > 0 && power >= need;
      const helpsThemCross = theirNeed > 0 && ownPower >= theirNeed;
      const mutualQualifier = canMoveUsAcross && helpsThemCross;
      const fairness = Math.min(ownPower, power) / Math.max(ownPower, power, 1);
      const available = p.vouchesRemaining === undefined || p.vouchesRemaining > 0;

      const ourUtility = qualified
        ? clamp(userRankGain / Math.max(60, user.rank * .28))
        : (canMoveUsAcross ? 1 : clamp(power / Math.max(need, 1)));
      const theirUtility = p.totalScore >= target
        ? clamp(candidateRankGain / Math.max(60, p.rank * .28))
        : (helpsThemCross ? 1 : clamp(ownPower / Math.max(theirNeed, 1)));
      const powerUtility = clamp(power / Math.max(ownPower * 1.8, 1));
      const score = qualified
        ? .42 * ourUtility + .28 * theirUtility + .18 * fairness + .12 * powerUtility
        : .48 * ourUtility + .30 * theirUtility + .14 * fairness + .08 * powerUtility;

      return {
        ...p,
        power,
        need: theirNeed,
        ourUtility,
        theirUtility,
        available,
        mutualQualifier,
        strategicFit: Math.round(score * 100),
        dominated: false,
        userScoreAfter,
        userRankAfter,
        userRankGain,
        candidateScoreAfter,
        candidateRankAfter,
        candidateRankGain,
        helpsThemCross,
        canMoveUsAcross,
        returnRatio: power / Math.max(ownPower, 1),
      };
    });

  const candidateMap = new Map(allCandidates.map(candidate => [candidate.username.toLowerCase(), candidate]));

  let candidates = allCandidates.filter(c => c.available && (qualified ? c.userRankGain > 0 : (c.power > 0 || c.theirUtility > 0)));
  candidates = candidates.map(c => ({
    ...c,
    dominated: candidates.some(a =>
      a.username !== c.username &&
      a.userRankGain >= c.userRankGain &&
      a.theirUtility >= c.theirUtility &&
      a.power >= c.power &&
      (a.userRankGain > c.userRankGain || a.theirUtility > c.theirUtility || a.power > c.power)
    ),
  })).sort((a,b) =>
    b.strategicFit - a.strategicFit ||
    Number(b.helpsThemCross) - Number(a.helpsThemCross) ||
    b.userRankGain - a.userRankGain ||
    b.power - a.power
  );

  const directSupporters = (snapshot.userLedger?.entries ?? [])
    .filter(entry => entry.kind === 'vouch' && entry.points > 0)
    .sort((a,b) => b.points - a.points)
    .filter((entry,index,arr) => arr.findIndex(other => other.authorHandle.toLowerCase() === entry.authorHandle.toLowerCase()) === index);
  const directSet = new Set(directSupporters.map(entry => entry.authorHandle.toLowerCase()));

  const warmMap = new Map<string, {
    handle:string;
    via:Set<string>;
    observedPower:number;
    lastSeenAt?:string;
  }>();

  for (const [supporterKey, ledger] of Object.entries(snapshot.supporterLedgers ?? {})) {
    const viaHandle = ledger.xHandle || supporterKey;
    for (const entry of ledger.entries) {
      if (entry.kind !== 'vouch' || entry.points <= 0) continue;
      const key = entry.authorHandle.toLowerCase();
      if (key === user.username.toLowerCase() || directSet.has(key)) continue;
      const current = warmMap.get(key) ?? { handle:entry.authorHandle, via:new Set<string>(), observedPower:0, lastSeenAt:entry.tweetCreatedAt };
      current.via.add(viaHandle);
      current.observedPower = Math.max(current.observedPower, entry.points);
      if (!current.lastSeenAt || (entry.tweetCreatedAt && entry.tweetCreatedAt > current.lastSeenAt)) current.lastSeenAt = entry.tweetCreatedAt;
      warmMap.set(key,current);
    }
  }

  const warmLeads: WarmLead[] = Array.from(warmMap.entries()).map(([key,warm]) => {
    const candidate = candidateMap.get(key);
    const power = candidate?.power ?? warm.observedPower;
    const userScoreAfter = user.totalScore + power;
    const userRankAfter = rankAfter(userScoreAfter);
    const userRankGain = Math.max(0,user.rank-userRankAfter);
    const candidateScoreAfter = candidate?.candidateScoreAfter;
    const candidateRankAfter = candidate?.candidateRankAfter;
    const candidateRankGain = candidate?.candidateRankGain;
    const candidateNeed = candidate?.need;
    const helpsThemCross = candidate?.helpsThemCross ?? false;
    const pathCount = warm.via.size;
    const score =
      (helpsThemCross ? 1000 : 0) +
      pathCount * 180 +
      Math.min(250,candidateRankGain ?? 0) * 2 +
      Math.min(250,userRankGain) +
      Math.min(200,power / 1000);
    return {
      username:candidate?.username ?? warm.handle,
      display:candidate?.display,
      avatarUrl:candidate?.avatarUrl,
      via:Array.from(warm.via),
      power,
      lastSeenAt:warm.lastSeenAt,
      pathCount,
      rank:candidate?.rank,
      totalScore:candidate?.totalScore,
      baseScore:candidate?.baseScore,
      userScoreAfter,
      userRankAfter,
      userRankGain,
      candidateScoreAfter,
      candidateRankAfter,
      candidateRankGain,
      candidateNeed,
      helpsThemCross,
      score,
    };
  }).filter(lead => lead.power > 0).sort((a,b) => b.score-a.score || b.power-a.power);

  const actionable = candidates.filter(c => !c.dominated && !directSet.has(c.username.toLowerCase()));
  const peopleWhoNeedYou = allCandidates.filter(c => c.available && c.need > 0 && c.need <= ownPower);
  const reciprocal = peopleWhoNeedYou.filter(c => qualified ? c.power > 0 : c.power >= need);
  const remaining = user.vouchesRemaining ?? (user.vouchersUsed === undefined ? undefined : Math.max(0,(snapshot.vouchLimit ?? GAME.defaultVouches)-user.vouchersUsed));
  const topAsk = actionable[0] ?? candidates.find(c => !directSet.has(c.username.toLowerCase()));

  const top1000 = snapshot.participants.filter(p => p.rank <= 1000);
  const top1000Total = top1000.reduce((sum,p) => sum + p.totalScore, 0);
  const scoreShare = top1000Total > 0 ? user.totalScore / top1000Total : 0;
  const vouchPowers = snapshot.participants.map(p => p.baseScore * GAME.vouchRate).sort((a,b) => a-b);
  const atOrBelow = vouchPowers.filter(power => power <= ownPower).length;
  const vouchPercentile = vouchPowers.length ? Math.round(atOrBelow / vouchPowers.length * 100) : 0;
  const medianVouchPower = vouchPowers.length ? vouchPowers[Math.floor(vouchPowers.length / 2)] : 0;

  const thresholds = [50000, 75000, 100000, 150000].map(amount => ({
    amount,
    count: peopleWhoNeedYou.filter(c => c.power >= amount).length,
  }));

  return {
    user,
    target,
    ownPower,
    need,
    qualified,
    remaining,
    candidates,
    actionable,
    topAsk,
    directSupporters,
    warmLeads,
    whoNeeds: peopleWhoNeedYou.length,
    reciprocal: reciprocal.length,
    ladder,
    nextTargetRank,
    nextTargetScore,
    nextTargetGap,
    scoreShare,
    top1000Total,
    vouchPercentile,
    medianVouchPower,
    thresholds,
    rankScores,
  };
}
