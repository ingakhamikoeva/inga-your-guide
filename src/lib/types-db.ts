// Domain types for the PostgreSQL backend (post-Supabase migration).
// Hand-curated from the legacy auto-generated `Database` type — only the
// Row/Insert shapes and enums the app actually uses.
//
// The Node API (`server/`) is the source of truth; keep this file in sync
// with `server/migrations/010_init.sql` when columns change.

// ── Enums ───────────────────────────────────────────────────────────
export type AppRole = 'admin' | 'user';
export type CoachingStyle = 'supportive' | 'structured' | 'mixed';
export type ConsultationStatus = 'requested' | 'paid' | 'scheduled' | 'done' | 'canceled';
export type ContentType = 'recipe' | 'sos' | 'lesson' | 'audio';
export type EatingPattern = 'emotional' | 'restorative' | 'chaotic' | 'intuitive';
export type FiberStatus = 'low' | 'ok' | 'good';
export type InputType = 'text' | 'photo' | 'voice';
export type InteroceptionLevel = 'high' | 'medium' | 'low';
export type MacroStatus = 'ok' | 'high' | 'too_high';
export type MealTag = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'unknown';
export type NutrientStatus = 'low' | 'ok' | 'high' | 'unknown';
export type PaceType = 'fast' | 'slow';
export type ProteinStatus = 'low' | 'ok' | 'good';
export type SubscriptionStatus = 'active' | 'expired';
export type TrackingMethod = 'calories' | 'palm' | 'plate';
export type TriggerType = 'fatigue' | 'stress' | 'hunger' | 'no_plan' | 'social';
export type UserStatus = 'trial' | 'active' | 'expired';
export type VulnerableTime = 'morning' | 'day' | 'evening' | 'night';
export type WeightStage = 'loss' | 'fixation' | 'maintenance';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [k: string]: Json | undefined }
  | Json[];

// ── Core tables ─────────────────────────────────────────────────────
export interface UserRow {
  user_id: string;
  auth_id: string | null;     // historical link to legacy Supabase auth.users
  status: UserStatus;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfileRow {
  user_id: string;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  sex: 'male' | 'female' | null;
  activity_level: string | null;
  target_weight_kg: number | null;
  pace: PaceType | null;
  tracking_method: TrackingMethod | null;
  current_stage: WeightStage;
  goal_reached_at: string | null;
  fixation_started_at: string | null;
  maintenance_started_at: string | null;
  equilibrium_calories: number | null;
  current_fixation_calories: number | null;
  fixation_week_number: number | null;
  last_calorie_increase_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserBehaviorRow {
  user_id: string;
  eating_pattern: EatingPattern | null;
  interoception: InteroceptionLevel | null;
  primary_trigger: TriggerType | null;
  coaching_style: CoachingStyle | null;
  vulnerable_time: VulnerableTime | null;
  notes: string | null;
  updated_at: string;
}

export interface DailyPlanRow {
  user_id: string;
  date: string;
  calorie_target: number | null;
  protein_target: number | null;
  fat_target: number | null;
  carbs_target: number | null;
  fiber_target: number | null;
  created_at: string;
  updated_at: string;
}

export interface DailyCheckinRow {
  id: string;
  user_id: string;
  date: string;
  hunger: number | null;
  satiety: number | null;
  mood: number | null;
  energy: number | null;
  sleep_hours: number | null;
  notes: string | null;
  created_at: string;
}

export interface FoodLogRow {
  id: string;
  user_id: string;
  date: string;
  meal_tag: MealTag;
  input_type: InputType;
  raw_input: string | null;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  ai_response: Json | null;
  created_at: string;
}

export interface DailyNutritionSummaryRow {
  user_id: string;
  date: string;
  calories_consumed: number | null;
  protein_consumed: number | null;
  fat_consumed: number | null;
  carbs_consumed: number | null;
  fiber_consumed: number | null;
  protein_status: ProteinStatus | NutrientStatus | null;
  fat_status: MacroStatus | NutrientStatus | null;
  carbs_status: MacroStatus | NutrientStatus | null;
  fiber_status: FiberStatus | NutrientStatus | null;
  created_at: string;
  updated_at: string;
}

export interface EveningReflectionRow {
  id: string;
  user_id: string;
  date: string;
  text: string | null;
  mood: number | null;
  created_at: string;
}

export interface ChatEventRow {
  id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  context: Json | null;
  created_at: string;
}

export interface UserEventRow {
  id: string;
  user_id: string;
  event_type: string;
  payload: Json | null;
  created_at: string;
}

export interface ConsultationRow {
  id: string;
  user_id: string;
  status: ConsultationStatus;
  scheduled_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface AppSettingRow {
  key: string;
  value: Json;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface FoodReferenceRow {
  id: string;
  product_name_ru: string;
  product_name_en: string | null;
  category: string | null;
  calories_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
  carbs_per_100g: number | null;
  fiber_per_100g: number | null;
  allowed_as_snack: boolean | null;
  allowed_active_loss: boolean | null;
  allowed_fixation: boolean | null;
  allowed_maintenance: boolean | null;
  high_fat: boolean | null;
  high_sugar: boolean | null;
  liquid_calories: boolean | null;
  recommended_portion_g: number | null;
  replacement_options: Json | null;
  user_explanation: string | null;
  created_at: string;
  updated_at: string;
}
