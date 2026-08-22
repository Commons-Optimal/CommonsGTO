import { GAME } from './config';
import type { CommonsSnapshot, MarketCandidate, Participant } from './types';

const clamp = (n:number) => Math.max(0, Math.min(1, n));
const coverage = (power:number, need:number) => need <= 0 ? 0 : clamp(power / need);
const efficiency = (power:number, need:number) => need <= 0 ? .25 : Math.min(power, need) / Math.max(power, need);

export function analyseMarket(snapshot: CommonsSnapshot, username: string) {
  const user = snapshot.participants.find(p => p.username.toLowerCase() === username.toLowerCase());
  if (!user) return null;
  const target = snapshot.cutoffRank1000;
  const ownPower = user.baseScore * GAME.vouchRate;
  const need = Math.max(0, target - user.totalScore);
  let candidates: MarketCandidate[] = snapshot.participants.filter(p => p.username !== user.username).map(p => {
    const power = p.baseScore * GAME.vouchRate, theirNeed = Math.max(0, target-p.totalScore);
    const ourUtility = coverage(power, need), theirUtility = coverage(ownPower, theirNeed);
    const fairness = Math.min(ownPower,power) / Math.max(ownPower,power,1);
    const available = p.vouchesRemaining === undefined || p.vouchesRemaining > 0;
    const nash = Math.sqrt(ourUtility * theirUtility);
    const fit = GAME.weights.nash*nash + GAME.weights.fairness*fairness + GAME.weights.efficiency*efficiency(power,need) + GAME.weights.availability*(available?1:0);
    return {...p,power,need:theirNeed,ourUtility,theirUtility,available,mutualQualifier:need>0&&power>=need&&theirNeed>0&&ownPower>=theirNeed,strategicFit:Math.round(100*fit),dominated:false};
  }).filter(c => c.available && (c.ourUtility>0 || c.theirUtility>0));
  candidates = candidates.map(c => ({...c,dominated:candidates.some(a => a.username!==c.username && a.power>=c.power && a.theirUtility>=c.theirUtility && a.strategicFit>=c.strategicFit && (a.power>c.power || a.theirUtility>c.theirUtility || a.strategicFit>c.strategicFit))})).sort((a,b)=>b.strategicFit-a.strategicFit || b.power-a.power);
  const actionable = candidates.filter(c=>!c.dominated);
  const remaining = user.vouchesRemaining ?? Math.max(0, GAME.defaultVouches-(user.vouchersUsed ?? 0));
  const viableReturns = candidates.filter(c=>c.theirUtility>.35).map(c=>c.power).sort((a,b)=>b-a);
  const reservationValue = viableReturns[Math.min(Math.max(remaining-1,0),viableReturns.length-1)] ?? 0;
  const best = actionable[0];
  const hold = !best || remaining===0 || best.strategicFit < GAME.holdThreshold*100 || (best.power < reservationValue && !best.mutualQualifier);
  const rankAfter = (score:number) => 1 + snapshot.participants.filter(p=>p.totalScore>score).length;
  return {
    user,target,ownPower,need,remaining,reservationValue,candidates,actionable,
    whoNeeds: candidates.filter(c=>c.need>0&&c.need<=ownPower).length,
    reciprocal: candidates.filter(c=>c.need>0&&c.need<=ownPower&&c.power>=need).length,
    decision: hold ? {type:'HOLD' as const,title:'Preserve your optionality',inbound:0,rank:user.rank,margin:user.totalScore-target,candidate:undefined} : {type:'DIRECT' as const,title:`Reciprocal with @${best.username}`,inbound:best.power,rank:rankAfter(user.totalScore+best.power),margin:user.totalScore+best.power-target,candidate:best},
  };
}
