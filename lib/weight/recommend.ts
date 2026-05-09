/**
 * Weight recommendation logic.
 *
 * Given an estimated 1RM and a target rep range, return a suggested working
 * weight. With no 1RM, fall back to the last logged weight; otherwise return
 * null and the UI should prompt the user to "choose a manageable weight".
 */

export interface RepRange {
  min: number;
  max: number;
}

interface IntensityBand {
  /** Inclusive lower bound on rep range MAX where this band activates. */
  repMaxBelow: number;
  /** Mid-range %1RM, used as the recommendation. */
  midPct: number;
}

// Bands ordered from highest %1RM (lowest reps) to lowest %1RM (highest reps).
// Read as: if rep range max ≤ 8, use ~80% (mid of 75-85). And so on.
const BANDS: IntensityBand[] = [
  { repMaxBelow: 8, midPct: 0.8 },   // 6-8 reps: 75-85%
  { repMaxBelow: 12, midPct: 0.7 },  // 8-12 reps: 65-75%
  { repMaxBelow: 15, midPct: 0.6 },  // 12-15 reps: 55-65%
  { repMaxBelow: 20, midPct: 0.525 }, // 15-20 reps: 45-60%
];

export function pickIntensityPct(repMax: number): number {
  for (const band of BANDS) {
    if (repMax <= band.repMaxBelow) return band.midPct;
  }
  // Beyond 20 reps — keep dropping toward bodyweight territory.
  return 0.4;
}

export function roundToNearest5(weight: number): number {
  return Math.round(weight / 5) * 5;
}

export interface RecommendArgs {
  oneRepMaxLbs?: number | null;
  lastLoggedWeightLbs?: number | null;
  repRange: RepRange;
}

export function recommendWeight(args: RecommendArgs): number | null {
  const { oneRepMaxLbs, lastLoggedWeightLbs, repRange } = args;

  if (oneRepMaxLbs && oneRepMaxLbs > 0) {
    const pct = pickIntensityPct(repRange.max);
    return roundToNearest5(oneRepMaxLbs * pct);
  }

  if (lastLoggedWeightLbs && lastLoggedWeightLbs > 0) {
    return roundToNearest5(lastLoggedWeightLbs);
  }

  return null;
}
