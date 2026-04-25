
CREATE TABLE public.chat_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date_time timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  message_summary text NOT NULL,
  related_food_log_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_events_user_time ON public.chat_events(user_id, date_time DESC);

ALTER TABLE public.chat_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat events"
ON public.chat_events FOR SELECT
USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can insert own chat events"
ON public.chat_events FOR INSERT
WITH CHECK (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));
