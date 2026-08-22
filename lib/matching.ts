import { RULES } from "./config";
import { efficiency, pointsNeeded, qualificationCoverage, rawFairness, vouchValue } from "./scoring";
import type { Participant } from "./types";

export type Match = {
  candidate: Participant;
  score: number;
  qualification: number;
  reciprocity: number;
  fairness: number;
  efficiency: number;
  userNeed: number;
  candidateNeed: number;
  userPower: number;
  candidatePower: number;
  mutuallyQualifying: boolean;
  oneVouchSolution: boolean;
};

export function matchCandidate(user: Participant, candidate: Participant, cutoff: number): Match {
  const userNeed = pointsNeeded(user.totalScore, cutoff);
  const candidateNeed = pointsNeeded(candidate.totalScore, cutoff);
  const userPower = vouchValue(user.baseScore);
  const candidatePower = vouchValue(candidate.baseScore);
  const qualification = qualificationCoverage(candidatePower, userNeed);
  // Qualified accounts still value score/safety, but less than a candidate whose outcome changes.
  const reciprocity = candidateNeed === 0 ? 0.25 : qualificationCoverage(userPower, candidateNeed);
  const fairness = rawFairness(userPower, candidatePower);
  const efficient = efficiency(candidatePower, userNeed);
  const w = RULES.matchWeights;
  const score = qualification * w.qualification + reciprocity * w.reciprocity + fairness * w.fairness + efficient * w.efficiency;
  return {
    candidate, score, qualification, reciprocity, fairness, efficiency: efficient,
    userNeed, candidateNeed, userPower, candidatePower,
    mutuallyQualifying: userNeed > 0 && candidateNeed > 0 && candidatePower >= userNeed && userPower >= candidateNeed,
    oneVouchSolution: userNeed > 0 && candidatePower >= userNeed,
  };
}

export function findBestMatches(user: Participant, participants: Participant[], cutoff: number) {
  return participants
    .filter((p) => p.username.toLowerCase() !== user.username.toLowerCase())
    .filter((p) => p.vouchersUsed === undefined || p.vouchersUsed < RULES.maxVouches)
    .map((p) => matchCandidate(user, p, cutoff))
    .sort((a, b) => Number(b.mutuallyQualifying) - Number(a.mutuallyQualifying) || b.score - a.score);
}
