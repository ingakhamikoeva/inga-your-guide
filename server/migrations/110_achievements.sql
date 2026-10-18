BEGIN;

-- Old check-ins deliberately have no recording timestamp. Opening an account
-- must not turn an old measurement into a fresh maintenance milestone.
ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS weight_recorded_at timestamptz;

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, achievement_id)
);
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

COMMIT;
