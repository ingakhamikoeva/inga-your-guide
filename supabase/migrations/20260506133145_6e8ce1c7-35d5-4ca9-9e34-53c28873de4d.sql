
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
