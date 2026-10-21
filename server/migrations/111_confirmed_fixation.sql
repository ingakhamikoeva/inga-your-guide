BEGIN;

-- Stage changes only; legacy fixation users need no new setup or backfill.
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS fixation_progress jsonb;

COMMIT;
