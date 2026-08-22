import type { Match } from "./matching";

export type QualifyingCombination = { matches: Match[]; total: number; surplus: number; reciprocity: number };

export function findMinimumQualifyingCombination(matches: Match[], need: number, maxSize = 5): QualifyingCombination | null {
  if (need <= 0) return { matches: [], total: 0, surplus: 0, reciprocity: 1 };
  const candidates = matches.filter((m) => m.candidatePower > 0).slice(0, 60);
  let best: QualifyingCombination | null = null;
  const search = (start: number, chosen: Match[], total: number) => {
    if (total >= need) {
      const option = { matches: [...chosen], total, surplus: total - need, reciprocity: chosen.reduce((s, m) => s + m.reciprocity, 0) / chosen.length };
      if (!best || option.matches.length < best.matches.length || (option.matches.length === best.matches.length && (option.surplus < best.surplus || option.surplus === best.surplus && option.reciprocity > best.reciprocity))) best = option;
      return;
    }
    if (chosen.length >= maxSize || (best && chosen.length >= best.matches.length)) return;
    for (let i = start; i < candidates.length; i++) search(i + 1, [...chosen, candidates[i]], total + candidates[i].candidatePower);
  };
  search(0, [], 0);
  return best;
}
