
-- 1. Hide internal staff notes on consultations from end users via column privileges.
-- RLS still permits row access; column-level privileges block reading notes_internal.
REVOKE SELECT (notes_internal) ON public.consultations FROM anon, authenticated, PUBLIC;
REVOKE UPDATE (notes_internal) ON public.consultations FROM anon, authenticated, PUBLIC;
REVOKE INSERT (notes_internal) ON public.consultations FROM anon, authenticated, PUBLIC;

-- Grant SELECT on the safe columns explicitly to authenticated.
GRANT SELECT (consultation_id, user_id, status, scheduled_at, payment_id, created_at)
  ON public.consultations TO authenticated;
GRANT INSERT (user_id, status, scheduled_at, payment_id)
  ON public.consultations TO authenticated;
GRANT UPDATE (status, scheduled_at, payment_id)
  ON public.consultations TO authenticated;

-- 2. Restrict users table policies to authenticated role only (drop public-role policies).
DROP POLICY IF EXISTS "Users can insert own" ON public.users;
DROP POLICY IF EXISTS "Users can update own" ON public.users;
DROP POLICY IF EXISTS "Users can view own" ON public.users;

CREATE POLICY "Users can insert own"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "Users can update own"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "Users can view own"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_id);
