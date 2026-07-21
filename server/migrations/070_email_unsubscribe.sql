-- Отписка от email-цепочки триала (требование закона — ссылка в подвале писем).
-- Применяется вручную: psql < 070_email_unsubscribe.sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_unsubscribed_at TIMESTAMPTZ;
