// Shared nutrition types. Provider-agnostic — UI never imports DeepSeek/USDA directly.

export type ProteinStatus = 'low' | 'ok' | 'good';
export type FiberStatus = 'low' | 'ok' | 'good';
export type MacroStatus = 'ok' | 'high' | 'too_high';

export interface MealNutrition {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  has_protein: boolean;
  has_veg: boolean;
  has_fast_carbs_only: boolean;
  liquid_calories: boolean;
  confidence: 'low' | 'medium' | 'high';
  source: 'food_reference' | 'ai_estimate' | 'external' | 'empty';
}

export interface DailySummary {
  calorie_target: number | null;
  calories_eaten_estimated: number;
  calories_left: number | null;
  protein_estimated_g: number;
  fat_estimated_g: number;
  carbs_estimated_g: number;
  fiber_estimated_g: number;
  protein_status: ProteinStatus;
  fat_status: MacroStatus;
  carbs_status: MacroStatus;
  fiber_status: FiberStatus;
  summary_comment: string;
  is_estimate: boolean;
  meal_count: number;
}
