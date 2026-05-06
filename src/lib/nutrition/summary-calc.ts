// Pure calculation: meals + targets → DailySummary.

import type { DailySummary, MealNutrition, MacroStatus, ProteinStatus, FiberStatus } from './types';
import { buildSummaryComment } from './summary-comment';

interface CalcInput {
  meals: MealNutrition[];
  calorieTarget: number | null;
  goalWeightKg?: number;
}

function proteinStatusFor(grams: number, goalWeightKg?: number): ProteinStatus {
  // 0.8–1.2 g per kg of goal weight (fallback: 60 / 90 g)
  const low = goalWeightKg ? goalWeightKg * 0.8 : 60;
  const good = goalWeightKg ? goalWeightKg * 1.2 : 90;
  if (grams < low) return 'low';
  if (grams >= good) return 'good';
  return 'ok';
}

function macroStatusByPercent(grams: number, kcalPerG: number, totalKcal: number, hi: number, tooHi: number): MacroStatus {
  if (totalKcal <= 0) return 'ok';
  const pct = (grams * kcalPerG) / totalKcal;
  if (pct > tooHi) return 'too_high';
  if (pct > hi) return 'high';
  return 'ok';
}

function fiberStatusFor(grams: number): FiberStatus {
  if (grams < 15) return 'low';
  if (grams >= 25) return 'good';
  return 'ok';
}

export function calcDailySummary(input: CalcInput): DailySummary {
  const { meals, calorieTarget, goalWeightKg } = input;

  const totals = meals.reduce(
    (acc, m) => {
      acc.calories += m.calories;
      acc.protein += m.protein_g;
      acc.fat += m.fat_g;
      acc.carbs += m.carbs_g;
      acc.fiber += m.fiber_g;
      return acc;
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
  );

  const calories_eaten_estimated = Math.round(totals.calories);
  const calories_left = calorieTarget != null ? Math.max(0, calorieTarget - calories_eaten_estimated) : null;

  const summary: DailySummary = {
    calorie_target: calorieTarget,
    calories_eaten_estimated,
    calories_left,
    protein_estimated_g: Math.round(totals.protein),
    fat_estimated_g: Math.round(totals.fat),
    carbs_estimated_g: Math.round(totals.carbs),
    fiber_estimated_g: Math.round(totals.fiber),
    protein_status: proteinStatusFor(totals.protein, goalWeightKg),
    fat_status: macroStatusByPercent(totals.fat, 9, calories_eaten_estimated, 0.35, 0.45),
    carbs_status: macroStatusByPercent(totals.carbs, 4, calories_eaten_estimated, 0.55, 0.65),
    fiber_status: fiberStatusFor(totals.fiber),
    summary_comment: '',
    is_estimate: meals.some(m => m.source !== 'food_reference'),
    meal_count: meals.length,
  };

  summary.summary_comment = buildSummaryComment(summary);
  return summary;
}
