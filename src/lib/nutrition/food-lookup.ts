// Single entry-point for resolving a free-text meal into nutrients.
// Priority: 1) internal food_reference (when populated)
//           2) external source (USDA — TODO, not wired yet)
//           3) AI estimate via the estimate-nutrition edge function.

import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/api-invoke';
import type { MealNutrition } from './types';

const EMPTY: MealNutrition = {
  calories: 0,
  protein_g: 0,
  fat_g: 0,
  carbs_g: 0,
  fiber_g: 0,
  has_protein: false,
  has_veg: false,
  has_fast_carbs_only: false,
  liquid_calories: false,
  confidence: 'low',
  source: 'empty',
};

async function tryFoodReference(text: string): Promise<MealNutrition | null> {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  // Naive single-product match. Real matcher comes later.
  const { data } = await supabase
    .from('food_reference' as any)
    .select(
      'calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, fiber_per_100g, recommended_portion_g, liquid_calories'
    )
    .ilike('product_name_ru', normalized)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const portion = (data as any).recommended_portion_g ?? 100;
  const k = portion / 100;
  return {
    calories: Math.round(((data as any).calories_per_100g ?? 0) * k),
    protein_g: ((data as any).protein_per_100g ?? 0) * k,
    fat_g: ((data as any).fat_per_100g ?? 0) * k,
    carbs_g: ((data as any).carbs_per_100g ?? 0) * k,
    fiber_g: ((data as any).fiber_per_100g ?? 0) * k,
    has_protein: ((data as any).protein_per_100g ?? 0) >= 8,
    has_veg: false,
    has_fast_carbs_only: false,
    liquid_calories: !!(data as any).liquid_calories,
    confidence: 'high',
    source: 'food_reference',
  };
}

async function tryAIEstimate(text: string): Promise<MealNutrition> {
  try {
    const { data, error } = await invokeFunction<{ estimate?: any }>('estimate-nutrition', { text });
    if (error || !data?.estimate) return EMPTY;
    const e = data.estimate;
    return {
      calories: e.calories ?? 0,
      protein_g: e.protein_g ?? 0,
      fat_g: e.fat_g ?? 0,
      carbs_g: e.carbs_g ?? 0,
      fiber_g: e.fiber_g ?? 0,
      has_protein: !!e.has_protein,
      has_veg: !!e.has_veg,
      has_fast_carbs_only: !!e.has_fast_carbs_only,
      liquid_calories: !!e.liquid_calories,
      confidence: e.confidence ?? 'low',
      source: 'ai_estimate',
    };
  } catch (err) {
    console.error('tryAIEstimate failed', err);
    return EMPTY;
  }
}

export async function resolveMealNutrition(text: string): Promise<MealNutrition> {
  if (!text.trim()) return EMPTY;
  const fromRef = await tryFoodReference(text);
  if (fromRef) return fromRef;
  // TODO: external nutrient source (USDA) goes here, before AI fallback.
  return tryAIEstimate(text);
}
