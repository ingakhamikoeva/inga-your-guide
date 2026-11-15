-- Water is independent of morning check-ins and achievement streaks.
CREATE TABLE IF NOT EXISTS public.daily_water (
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  date date NOT NULL,
  glasses integer NOT NULL CHECK (glasses BETWEEN 0 AND 1000),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);
-- The standalone API uses the table owner; all queries are scoped to req.userId.
ALTER TABLE public.daily_water ENABLE ROW LEVEL SECURITY;
