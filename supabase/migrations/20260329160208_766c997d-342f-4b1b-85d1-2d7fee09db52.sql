
-- Fix the security definer view issue by recreating with security_invoker
DROP VIEW IF EXISTS public.consultations_user_view;
CREATE VIEW public.consultations_user_view
  WITH (security_invoker = true)
  AS SELECT consultation_id, user_id, status, scheduled_at, created_at
  FROM public.consultations;
