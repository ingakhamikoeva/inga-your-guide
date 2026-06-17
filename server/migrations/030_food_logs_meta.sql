-- Add meta JSONB column to food_logs for storing per-meal toggles
-- (protein/carbs/fiber/sweet) and protein portion size.
ALTER TABLE public.food_logs
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;
