
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
