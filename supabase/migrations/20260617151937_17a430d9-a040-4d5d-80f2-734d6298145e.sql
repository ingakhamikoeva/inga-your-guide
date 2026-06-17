ALTER TABLE public.evening_reflections
  ADD COLUMN IF NOT EXISTS sweet_point_done boolean,
  ADD COLUMN IF NOT EXISTS day_win text;