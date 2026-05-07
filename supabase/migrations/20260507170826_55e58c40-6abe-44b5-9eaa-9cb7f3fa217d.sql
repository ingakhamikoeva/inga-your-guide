-- Restrict access to consultations.notes_internal (staff-only)
REVOKE ALL ON TABLE public.consultations FROM anon, authenticated, PUBLIC;

GRANT SELECT (consultation_id, user_id, status, scheduled_at, payment_id, created_at)
  ON public.consultations TO authenticated;
GRANT INSERT (consultation_id, user_id, status, scheduled_at, payment_id)
  ON public.consultations TO authenticated;
GRANT UPDATE (status, scheduled_at)
  ON public.consultations TO authenticated;

-- Restrict access to realtime.messages so no client can subscribe
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all realtime messages" ON realtime.messages;
CREATE POLICY "Deny all realtime messages"
  ON realtime.messages
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);