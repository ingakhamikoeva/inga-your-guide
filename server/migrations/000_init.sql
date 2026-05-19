
-- Enum types
CREATE TYPE public.pace_type AS ENUM ('fast', 'slow');
CREATE TYPE public.tracking_method_type AS ENUM ('calories', 'palm', 'plate');
CREATE TYPE public.eating_pattern AS ENUM ('emotional', 'restorative', 'chaotic', 'intuitive');
CREATE TYPE public.trigger_type AS ENUM ('fatigue', 'stress', 'hunger', 'no_plan', 'social');
CREATE TYPE public.vulnerable_time AS ENUM ('morning', 'day', 'evening', 'night');
CREATE TYPE public.interoception_level AS ENUM ('high', 'medium', 'low');
CREATE TYPE public.coaching_style AS ENUM ('supportive', 'structured', 'mixed');
CREATE TYPE public.user_status AS ENUM ('trial', 'active', 'expired');
CREATE TYPE public.subscription_status AS ENUM ('active', 'expired');
CREATE TYPE public.consultation_status AS ENUM ('requested', 'paid', 'scheduled', 'done', 'canceled');
CREATE TYPE public.content_type AS ENUM ('recipe', 'sos', 'lesson', 'audio');
CREATE TYPE public.input_type AS ENUM ('text', 'photo', 'voice');
CREATE TYPE public.meal_tag AS ENUM ('breakfast', 'lunch', 'dinner', 'snack', 'unknown');
CREATE TYPE public.nutrient_status AS ENUM ('low', 'ok', 'high', 'unknown');

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2.1 users
CREATE TABLE public.users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT,
  timezone TEXT DEFAULT 'Europe/Moscow',
  language TEXT DEFAULT 'ru',
  status public.user_status NOT NULL DEFAULT 'trial'
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own" ON public.users FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "Users can insert own" ON public.users FOR INSERT WITH CHECK (auth.uid() = auth_id);
CREATE POLICY "Users can update own" ON public.users FOR UPDATE USING (auth.uid() = auth_id);

-- 2.2 user_profile
CREATE TABLE public.user_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE UNIQUE,
  sex TEXT,
  birth_year INT,
  age INT,
  height_cm INT,
  start_weight_kg NUMERIC(5,1),
  current_weight_kg NUMERIC(5,1),
  goal_weight_kg NUMERIC(5,1),
  waist_cm NUMERIC(5,1),
  hips_cm NUMERIC(5,1),
  steps_baseline INT,
  weight_gain_reasons TEXT[],
  emotional_trigger TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.user_profile FOR SELECT USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can insert own profile" ON public.user_profile FOR INSERT WITH CHECK (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can update own profile" ON public.user_profile FOR UPDATE USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE TRIGGER update_user_profile_updated_at BEFORE UPDATE ON public.user_profile
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.3 user_plan
CREATE TABLE public.user_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE UNIQUE,
  pace public.pace_type,
  calorie_target INT,
  calorie_corridor_low INT,
  calorie_corridor_high INT,
  tracking_method public.tracking_method_type,
  reminders_level TEXT DEFAULT 'soft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plan" ON public.user_plan FOR SELECT USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can insert own plan" ON public.user_plan FOR INSERT WITH CHECK (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can update own plan" ON public.user_plan FOR UPDATE USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE TRIGGER update_user_plan_updated_at BEFORE UPDATE ON public.user_plan
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.4 assessment_answers
CREATE TABLE public.assessment_answers (
  assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  answers_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own assessments" ON public.assessment_answers FOR SELECT USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can insert own assessments" ON public.assessment_answers FOR INSERT WITH CHECK (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);

-- 2.5 behavior_profile
CREATE TABLE public.behavior_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE UNIQUE,
  eating_pattern public.eating_pattern,
  primary_trigger public.trigger_type,
  vulnerable_time public.vulnerable_time,
  interoception_level public.interoception_level,
  recommended_coaching_style public.coaching_style,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.behavior_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own behavior" ON public.behavior_profile FOR SELECT USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can insert own behavior" ON public.behavior_profile FOR INSERT WITH CHECK (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can update own behavior" ON public.behavior_profile FOR UPDATE USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE TRIGGER update_behavior_profile_updated_at BEFORE UPDATE ON public.behavior_profile
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.6 daily_checkins
CREATE TABLE public.daily_checkins (
  checkin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg NUMERIC(5,1),
  sleep_hours NUMERIC(3,1),
  steps_yesterday INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own checkins" ON public.daily_checkins FOR SELECT USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can insert own checkins" ON public.daily_checkins FOR INSERT WITH CHECK (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can update own checkins" ON public.daily_checkins FOR UPDATE USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);

-- 2.7 food_logs
CREATE TABLE public.food_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  datetime TIMESTAMPTZ NOT NULL DEFAULT now(),
  input_type public.input_type NOT NULL DEFAULT 'text',
  raw_text TEXT,
  photo_url TEXT,
  meal_tag public.meal_tag NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own food logs" ON public.food_logs FOR SELECT USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can insert own food logs" ON public.food_logs FOR INSERT WITH CHECK (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);

-- 2.8 food_analysis
CREATE TABLE public.food_analysis (
  analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES public.food_logs(log_id) ON DELETE CASCADE,
  calories_estimated INT,
  protein_status public.nutrient_status,
  fat_status public.nutrient_status,
  fiber_status public.nutrient_status,
  risk_flags_json JSONB,
  recommendation_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.food_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own food analysis" ON public.food_analysis FOR SELECT USING (
  log_id IN (
    SELECT fl.log_id FROM public.food_logs fl
    WHERE fl.user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
  )
);
CREATE POLICY "Users can insert own food analysis" ON public.food_analysis FOR INSERT WITH CHECK (
  log_id IN (
    SELECT fl.log_id FROM public.food_logs fl
    WHERE fl.user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
  )
);

-- 2.9 evening_reflections
CREATE TABLE public.evening_reflections (
  reflection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  emotion TEXT,
  hunger_level INT CHECK (hunger_level BETWEEN 1 AND 5),
  hardest_part TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.evening_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reflections" ON public.evening_reflections FOR SELECT USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can insert own reflections" ON public.evening_reflections FOR INSERT WITH CHECK (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);

-- 2.10 content_library
CREATE TABLE public.content_library (
  content_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.content_type NOT NULL,
  title TEXT NOT NULL,
  tags_json JSONB,
  nutrition_json JSONB,
  body_text TEXT,
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Content is readable by all authenticated" ON public.content_library FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_content_library_updated_at BEFORE UPDATE ON public.content_library
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.11 subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE UNIQUE,
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  subscription_status public.subscription_status NOT NULL DEFAULT 'active',
  paid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can insert own subscription" ON public.subscriptions FOR INSERT WITH CHECK (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);

-- 2.12 consultations
CREATE TABLE public.consultations (
  consultation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  status public.consultation_status NOT NULL DEFAULT 'requested',
  scheduled_at TIMESTAMPTZ,
  payment_id TEXT,
  notes_internal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own consultations" ON public.consultations FOR SELECT USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can insert own consultations" ON public.consultations FOR INSERT WITH CHECK (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);

-- user_events
CREATE TABLE public.user_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON public.user_events FOR SELECT USING (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);
CREATE POLICY "Users can insert own events" ON public.user_events FOR INSERT WITH CHECK (
  user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid())
);

-- Auto-create user record on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX idx_daily_checkins_user_date ON public.daily_checkins(user_id, date);
CREATE INDEX idx_food_logs_user_datetime ON public.food_logs(user_id, datetime);
CREATE INDEX idx_evening_reflections_user_date ON public.evening_reflections(user_id, date);
CREATE INDEX idx_user_events_user_type ON public.user_events(user_id, type);
CREATE INDEX idx_content_library_type ON public.content_library(type);

-- Fix 1: Remove user-facing INSERT and UPDATE policies on subscriptions
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;

-- Fix 2: Create a view for consultations that excludes notes_internal
CREATE OR REPLACE VIEW public.consultations_user_view AS
  SELECT consultation_id, user_id, status, scheduled_at, created_at
  FROM public.consultations;

-- Drop the existing SELECT policy that exposes notes_internal
DROP POLICY IF EXISTS "Users can view own consultations" ON public.consultations;

-- Create a restrictive SELECT policy that still works but we'll use the view in app code
-- We need the base table policy for the view to work (views use caller's RLS)
CREATE POLICY "Users can view own consultations"
  ON public.consultations
  FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

-- Fix the security definer view issue by recreating with security_invoker
DROP VIEW IF EXISTS public.consultations_user_view;
CREATE VIEW public.consultations_user_view
  WITH (security_invoker = true)
  AS SELECT consultation_id, user_id, status, scheduled_at, created_at
  FROM public.consultations;

CREATE TABLE public.chat_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date_time timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  message_summary text NOT NULL,
  related_food_log_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_events_user_time ON public.chat_events(user_id, date_time DESC);

ALTER TABLE public.chat_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat events"
ON public.chat_events FOR SELECT
USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can insert own chat events"
ON public.chat_events FOR INSERT
WITH CHECK (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));
-- Table for storing user's meal plans for next day
CREATE TABLE public.meal_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date_for DATE NOT NULL,
  plan_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, date_for)
);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal plans"
  ON public.meal_plans
  FOR SELECT
  USING (user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can insert own meal plans"
  ON public.meal_plans
  FOR INSERT
  WITH CHECK (user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can update own meal plans"
  ON public.meal_plans
  FOR UPDATE
  USING (user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid()));

CREATE TRIGGER update_meal_plans_updated_at
  BEFORE UPDATE ON public.meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_meal_plans_user_date ON public.meal_plans(user_id, date_for);
-- Enums for nutrition statuses
DO $$ BEGIN
  CREATE TYPE public.protein_status_t AS ENUM ('low','ok','good');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fiber_status_t AS ENUM ('low','ok','good');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.macro_status_t AS ENUM ('ok','high','too_high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ DAILY NUTRITION SUMMARY ============
CREATE TABLE IF NOT EXISTS public.daily_nutrition_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  calorie_target integer,
  calories_eaten_estimated integer NOT NULL DEFAULT 0,
  calories_left integer,
  protein_estimated_g numeric(6,1) NOT NULL DEFAULT 0,
  fat_estimated_g numeric(6,1) NOT NULL DEFAULT 0,
  carbs_estimated_g numeric(6,1) NOT NULL DEFAULT 0,
  fiber_estimated_g numeric(6,1) NOT NULL DEFAULT 0,
  protein_status public.protein_status_t,
  fat_status public.macro_status_t,
  carbs_status public.macro_status_t,
  fiber_status public.fiber_status_t,
  summary_comment text,
  is_estimate boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.daily_nutrition_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own summary"
  ON public.daily_nutrition_summary FOR SELECT
  USING (user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can insert own summary"
  ON public.daily_nutrition_summary FOR INSERT
  WITH CHECK (user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can update own summary"
  ON public.daily_nutrition_summary FOR UPDATE
  USING (user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid()));

CREATE TRIGGER update_daily_nutrition_summary_updated_at
  BEFORE UPDATE ON public.daily_nutrition_summary
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_nutrition_summary;

-- ============ FOOD REFERENCE (internal product dictionary) ============
CREATE TABLE IF NOT EXISTS public.food_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name_ru text NOT NULL,
  product_name_en text,
  category text,
  calories_per_100g numeric(6,1),
  protein_per_100g numeric(5,1),
  fat_per_100g numeric(5,1),
  carbs_per_100g numeric(5,1),
  fiber_per_100g numeric(5,1),
  allowed_as_snack boolean DEFAULT false,
  allowed_active_loss boolean DEFAULT true,
  allowed_fixation boolean DEFAULT true,
  allowed_maintenance boolean DEFAULT true,
  high_fat boolean DEFAULT false,
  high_sugar boolean DEFAULT false,
  liquid_calories boolean DEFAULT false,
  recommended_portion_g integer,
  replacement_options jsonb,
  user_explanation text,
  -- External source hooks (USDA etc., not used yet)
  external_source text,
  external_id text,
  external_food_name text,
  source_priority integer DEFAULT 100,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_reference_name_ru
  ON public.food_reference (lower(product_name_ru));
CREATE INDEX IF NOT EXISTS idx_food_reference_external
  ON public.food_reference (external_source, external_id);

ALTER TABLE public.food_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Food reference readable by authenticated"
  ON public.food_reference FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_food_reference_updated_at
  BEFORE UPDATE ON public.food_reference
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NUTRIENTS REFERENCE (future USDA detail, empty for now) ============
CREATE TABLE IF NOT EXISTS public.nutrients_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id uuid REFERENCES public.food_reference(id) ON DELETE CASCADE,
  nutrient_name text NOT NULL,
  nutrient_code text,
  amount_per_100g numeric(10,3),
  unit text,
  source text,
  source_food_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrients_reference_food ON public.nutrients_reference(food_id);

ALTER TABLE public.nutrients_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutrients reference readable by authenticated"
  ON public.nutrients_reference FOR SELECT
  TO authenticated
  USING (true);

DO $$ BEGIN
  CREATE TYPE public.weight_stage AS ENUM ('loss', 'fixation', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS current_stage public.weight_stage NOT NULL DEFAULT 'loss',
  ADD COLUMN IF NOT EXISTS goal_reached_at date,
  ADD COLUMN IF NOT EXISTS fixation_started_at date,
  ADD COLUMN IF NOT EXISTS maintenance_started_at date,
  ADD COLUMN IF NOT EXISTS equilibrium_calories integer,
  ADD COLUMN IF NOT EXISTS current_fixation_calories integer,
  ADD COLUMN IF NOT EXISTS fixation_week_number integer,
  ADD COLUMN IF NOT EXISTS last_calorie_increase_at date;

-- 1. Add UPDATE/DELETE policies for user-owned tables
CREATE POLICY "Users can update own food logs" ON public.food_logs
  FOR UPDATE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can delete own food logs" ON public.food_logs
  FOR DELETE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can delete own summary" ON public.daily_nutrition_summary
  FOR DELETE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can update own reflections" ON public.evening_reflections
  FOR UPDATE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can delete own reflections" ON public.evening_reflections
  FOR DELETE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can delete own chat events" ON public.chat_events
  FOR DELETE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can delete own events" ON public.user_events
  FOR DELETE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can update own consultations" ON public.consultations
  FOR UPDATE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

-- 2. Remove daily_nutrition_summary from realtime publication (not used in app)
ALTER PUBLICATION supabase_realtime DROP TABLE public.daily_nutrition_summary;

-- 3. Lock down SECURITY DEFINER functions: revoke EXECUTE from public roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 1. Hide internal staff notes on consultations from end users via column privileges.
-- RLS still permits row access; column-level privileges block reading notes_internal.
REVOKE SELECT (notes_internal) ON public.consultations FROM anon, authenticated, PUBLIC;
REVOKE UPDATE (notes_internal) ON public.consultations FROM anon, authenticated, PUBLIC;
REVOKE INSERT (notes_internal) ON public.consultations FROM anon, authenticated, PUBLIC;

-- Grant SELECT on the safe columns explicitly to authenticated.
GRANT SELECT (consultation_id, user_id, status, scheduled_at, payment_id, created_at)
  ON public.consultations TO authenticated;
GRANT INSERT (user_id, status, scheduled_at, payment_id)
  ON public.consultations TO authenticated;
GRANT UPDATE (status, scheduled_at, payment_id)
  ON public.consultations TO authenticated;

-- 2. Restrict users table policies to authenticated role only (drop public-role policies).
DROP POLICY IF EXISTS "Users can insert own" ON public.users;
DROP POLICY IF EXISTS "Users can update own" ON public.users;
DROP POLICY IF EXISTS "Users can view own" ON public.users;

CREATE POLICY "Users can insert own"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "Users can update own"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "Users can view own"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_id);
-- Restrict access to consultations.notes_internal (staff-only)
REVOKE ALL ON TABLE public.consultations FROM anon, authenticated, PUBLIC;

GRANT SELECT (consultation_id, user_id, status, scheduled_at, payment_id, created_at)
  ON public.consultations TO authenticated;
GRANT INSERT (consultation_id, user_id, status, scheduled_at, payment_id)
  ON public.consultations TO authenticated;
GRANT UPDATE (status, scheduled_at)
  ON public.consultations TO authenticated;

-- Restrict access to realtime.messages so no client can subscribe
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all realtime messages" ON realtime.messages;
CREATE POLICY "Deny all realtime messages"
  ON realtime.messages
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- App settings (key/value)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read settings" ON public.app_settings;
CREATE POLICY "Authenticated can read settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert settings" ON public.app_settings;
CREATE POLICY "Admins can insert settings"
ON public.app_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update settings" ON public.app_settings;
CREATE POLICY "Admins can update settings"
ON public.app_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults (only if not present)
INSERT INTO public.app_settings (key, value, description) VALUES
('ai_prompts', '{
  "tone": "Ты — Инга, тёплый и спокойный AI-помощник по снижению веса.\nО себе говоришь в женском роде. К пользователю обращаешься в роде, соответствующем полу.\nБез обвинений, без чувства вины, без сложных медицинских терминов.\nКоротко, по-человечески, 1–2 практических шага.",
  "food_recommendation": "",
  "support": "",
  "safety": "",
  "food_analysis": "",
  "fixation": "",
  "maintenance": "",
  "general": ""
}'::jsonb, 'Системные промпты Инги. Пустая строка = использовать встроенный по умолчанию.'),
('ai_model', '{"provider":"deepseek","model":"deepseek-chat","temperature":0.4,"max_tokens":700}'::jsonb, 'Параметры AI-модели'),
('ai_limits', '{"max_message_length":3000,"max_user_context_bytes":10000,"max_day_context_bytes":15000,"max_payload_bytes":50000}'::jsonb, 'Лимиты edge-функции ask-inga'),
('lesson_overrides', '{}'::jsonb, 'Переопределения уроков из раздела "Как похудеть". Ключ — индекс урока, значение — {title, content}.')
ON CONFLICT (key) DO NOTHING;