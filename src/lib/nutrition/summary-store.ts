// Recompute and upsert daily_nutrition_summary for a given date.
// Called after every add/edit/delete of a meal.

import { apiFetch } from '@/lib/api-client';
import { resolveMealNutrition } from './food-lookup';
import { calcDailySummary } from './summary-calc';
import type { DailySummary } from './types';

interface RecomputeOptions {
  meals: string[];
  date: string;
  calorieTarget?: number | null;
  goalWeightKg?: number;
}

export async function recomputeAndSaveSummary(opts: RecomputeOptions): Promise<DailySummary | null> {
  const nutritions = await Promise.all(opts.meals.map((t) => resolveMealNutrition(t)));
  const summary = calcDailySummary({
    meals: nutritions,
    calorieTarget: opts.calorieTarget ?? null,
    goalWeightKg: opts.goalWeightKg,
  });

  const row = {
    calorie_target: summary.calorie_target,
    calories_eaten_estimated: summary.calories_eaten_estimated,
    calories_left: summary.calories_left,
    protein_estimated_g: summary.protein_estimated_g,
    fat_estimated_g: summary.fat_estimated_g,
    carbs_estimated_g: summary.carbs_estimated_g,
    fiber_estimated_g: summary.fiber_estimated_g,
    protein_status: summary.protein_status,
    fat_status: summary.fat_status,
    carbs_status: summary.carbs_status,
    fiber_status: summary.fiber_status,
    summary_comment: summary.summary_comment,
    is_estimate: summary.is_estimate,
  };

  try {
    await apiFetch(`/nutrition/summary/${opts.date}`, { method: 'PUT', body: row });
  } catch (e) {
    console.error('recomputeAndSaveSummary failed', e);
  }
  return summary;
}

export async function loadSummaryForDate(date: string): Promise<DailySummary | null> {
  try {
    return await apiFetch<DailySummary | null>(`/nutrition/summary/${date}`);
  } catch (e) {
    console.error('loadSummaryForDate failed', e);
    return null;
  }
}
