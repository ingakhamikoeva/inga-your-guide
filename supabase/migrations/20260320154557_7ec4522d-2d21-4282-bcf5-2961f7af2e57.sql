
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
