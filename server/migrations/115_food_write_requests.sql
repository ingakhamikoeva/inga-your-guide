-- One saved meal per authenticated user's create action, including lost replies.
-- Keep the key after a meal is deleted so a late retry cannot resurrect it.
CREATE TABLE IF NOT EXISTS public.food_write_requests (
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  payload_hash text NOT NULL,
  log_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
ALTER TABLE public.food_write_requests ENABLE ROW LEVEL SECURITY;
