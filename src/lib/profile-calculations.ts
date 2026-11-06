import { calculateAll, calculateCalorieCorridor, roundTo50 } from './calculations';
import type { Calculations, UserProfile } from './types';

// New measurements refresh body metrics, never silently rewrite a chosen plan.
export function refreshBodyCalculations(profile: Partial<UserProfile>, previous: Calculations | null): Calculations | null {
  if (!profile.height || !profile.weight || !profile.age || !profile.gender) return previous;
  const fresh = calculateAll(profile);
  return previous ? {
    ...fresh, totalCalories: previous.totalCalories, deficit25: previous.deficit25,
    corridorMin: previous.corridorMin, corridorMax: previous.corridorMax,
  } : fresh;
}

export function restorePlanCalculations(profile: Partial<UserProfile>, plan: {
  calorieTarget?: number; corridorMin?: number; corridorMax?: number;
} | null): Calculations {
  const calc = calculateAll(profile);
  if (plan?.calorieTarget) {
    calc.totalCalories = roundTo50(plan.calorieTarget);
    Object.assign(calc, calculateCalorieCorridor(plan.calorieTarget));
  }
  // Preserve explicitly saved valid bounds; legacy sub-1000 plans keep B4's floor.
  if (Number.isFinite(plan?.corridorMin) && Number.isFinite(plan?.corridorMax)
    && plan!.corridorMin! >= 1000 && plan!.corridorMax! >= plan!.corridorMin!) {
    calc.corridorMin = plan!.corridorMin!;
    calc.corridorMax = plan!.corridorMax!;
  }
  return calc;
}
