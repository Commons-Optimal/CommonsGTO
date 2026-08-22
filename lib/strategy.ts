import { GAME } from './config';
import type { CommonsSnapshot, MarketCandidate } from './types';

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

  const actionable = candidates.filter(c => !c.dominated);
  const peopleWhoNeedYou = allCandidates.filter(c => c.available && c.need > 0 && c.need <= ownPower);
  const reciprocal = peopleWhoNeedYou.filter(c => qualified ? c.power > 0 : c.power >= need);
  const remaining = user.vouchesRemaining ?? Math.max(0, (snapshot.vouchLimit ?? GAME.defaultVouches) - (user.vouchersUsed ?? 0));
  const topAsk = actionable[0] ?? candidates[0];

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
