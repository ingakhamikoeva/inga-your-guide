// Recompute and upsert daily_nutrition_summary for a given date.
// Called after every add/edit/delete of a meal.

import { supabase } from '@/integrations/supabase/client';
import { resolveMealNutrition } from './food-lookup';
import { calcDailySummary } from './summary-calc';
import type { DailySummary } from './types';

async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('user_id').eq('auth_id', user.id).single();
  return data?.user_id ?? null;
}

interface RecomputeOptions {
  meals: string[];                  // raw meal descriptions for this date
  date: string;                     // 'YYYY-MM-DD'
  calorieTarget?: number | null;
  goalWeightKg?: number;
}

export async function recomputeAndSaveSummary(opts: RecomputeOptions): Promise<DailySummary | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const nutritions = await Promise.all(opts.meals.map(t => resolveMealNutrition(t)));
  const summary = calcDailySummary({
    meals: nutritions,
    calorieTarget: opts.calorieTarget ?? null,
    goalWeightKg: opts.goalWeightKg,
  });

  const row = {
    user_id: userId,
    date: opts.date,
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

  const { data: existing } = await supabase
    .from('daily_nutrition_summary' as any)
    .select('id')
    .eq('user_id', userId)
    .eq('date', opts.date)
    .maybeSingle();

  if (existing) {
    await supabase.from('daily_nutrition_summary' as any).update(row).eq('id', (existing as any).id);
  } else {
    await supabase.from('daily_nutrition_summary' as any).insert(row);
  }

  return summary;
}

export async function loadSummaryForDate(date: string): Promise<DailySummary | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const { data } = await supabase
    .from('daily_nutrition_summary' as any)
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (!data) return null;
  const d = data as any;
  return {
    calorie_target: d.calorie_target,
    calories_eaten_estimated: d.calories_eaten_estimated,
    calories_left: d.calories_left,
    protein_estimated_g: Number(d.protein_estimated_g),
    fat_estimated_g: Number(d.fat_estimated_g),
    carbs_estimated_g: Number(d.carbs_estimated_g),
    fiber_estimated_g: Number(d.fiber_estimated_g),
    protein_status: d.protein_status ?? 'low',
    fat_status: d.fat_status ?? 'ok',
    carbs_status: d.carbs_status ?? 'ok',
    fiber_status: d.fiber_status ?? 'low',
    summary_comment: d.summary_comment ?? '',
    is_estimate: !!d.is_estimate,
    meal_count: d.calories_eaten_estimated > 0 ? 1 : 0,
  };
}
