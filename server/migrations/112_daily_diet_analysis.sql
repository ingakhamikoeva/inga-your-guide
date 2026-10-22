BEGIN;
CREATE TABLE IF NOT EXISTS public.daily_diet_analysis (
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  timezone TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  analysis JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date, timezone)
);
COMMIT;
