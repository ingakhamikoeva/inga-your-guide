-- Apply to the existing database before deploying the new API.
-- Old JWTs without a session_id (sid) are deliberately rejected by the new API.
BEGIN;
CREATE TABLE IF NOT EXISTS public.app_sessions (
  session_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS app_sessions_user_id_idx
  ON public.app_sessions (user_id);
COMMIT;
