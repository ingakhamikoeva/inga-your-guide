BEGIN;

-- Separate from test orders and from the renewal scheduler. One invoice total,
-- even if the allowed account is changed or concurrent requests are received.
CREATE TABLE IF NOT EXISTS public.payment_pilot_orders (
  invoice TEXT PRIMARY KEY CHECK(invoice ~ '^2[0-9]{17}$'),
  singleton SMALLINT NOT NULL DEFAULT 1 UNIQUE CHECK(singleton=1),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(user_id),
  environment TEXT NOT NULL DEFAULT 'live' CHECK(environment='live'),
  merchant_login TEXT NOT NULL CHECK(merchant_login='legcheonline'),
  amount INTEGER NOT NULL CHECK(amount=10000),
  plan TEXT NOT NULL DEFAULT 'month' CHECK(plan='month'),
  nonce TEXT NOT NULL CHECK(nonce ~ '^[a-f0-9]{48}$'),
  email TEXT NOT NULL,
  receipt JSONB NOT NULL,
  consent_snapshot JSONB NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  paid_at TIMESTAMPTZ,
  access_until TIMESTAMPTZ,
  CHECK((status='pending' AND paid_at IS NULL AND access_until IS NULL)
    OR (status='paid' AND paid_at IS NOT NULL AND access_until IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.payment_pilot_events (
  event_id BIGSERIAL PRIMARY KEY,
  invoice TEXT NOT NULL REFERENCES public.payment_pilot_orders(invoice),
  type TEXT NOT NULL CHECK(type IN ('consent','paid')),
  details JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(invoice,type)
);
ALTER TABLE public.payment_pilot_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_pilot_events ENABLE ROW LEVEL SECURITY;
COMMIT;
