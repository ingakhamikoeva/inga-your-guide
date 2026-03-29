
-- Fix 1: Remove user-facing INSERT and UPDATE policies on subscriptions
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;

-- Fix 2: Create a view for consultations that excludes notes_internal
CREATE OR REPLACE VIEW public.consultations_user_view AS
  SELECT consultation_id, user_id, status, scheduled_at, created_at
  FROM public.consultations;

-- Drop the existing SELECT policy that exposes notes_internal
DROP POLICY IF EXISTS "Users can view own consultations" ON public.consultations;

-- Create a restrictive SELECT policy that still works but we'll use the view in app code
-- We need the base table policy for the view to work (views use caller's RLS)
CREATE POLICY "Users can view own consultations"
  ON public.consultations
  FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));
