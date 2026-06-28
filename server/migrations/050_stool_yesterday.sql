-- Migration 050: add stool_yesterday to daily_checkins
ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS stool_yesterday BOOLEAN;
