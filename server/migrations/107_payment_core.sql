BEGIN;

-- First delivery is test-only. Live payments/renewals require a later release.
CREATE TABLE IF NOT EXISTS public.payment_orders (
  invoice TEXT PRIMARY KEY CHECK (invoice ~ '^1[0-9]{17}$'),
  user_id UUID NOT NULL REFERENCES public.users(user_id),
  environment TEXT NOT NULL DEFAULT 'test' CHECK (environment = 'test'),
  merchant_login TEXT NOT NULL,
  nonce TEXT NOT NULL,
  quote_digest TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('month','year')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  special BOOLEAN NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  receipt JSONB NOT NULL,
  consent_snapshot JSONB NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  access_until TIMESTAMPTZ,
  UNIQUE(user_id,quote_digest)
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_one_pending
  ON public.payment_orders(user_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS payment_orders_owner_idx
  ON public.payment_orders(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_special_seats (
  seat INTEGER PRIMARY KEY CHECK(seat BETWEEN 1 AND 100),
  user_id UUID UNIQUE REFERENCES public.users(user_id),
  invoice TEXT REFERENCES public.payment_orders(invoice),
  granted_at TIMESTAMPTZ
);
INSERT INTO public.payment_special_seats(seat)
  SELECT generate_series(1,100) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.payment_events (
  event_id BIGSERIAL PRIMARY KEY,
  invoice TEXT NOT NULL REFERENCES public.payment_orders(invoice),
  type TEXT NOT NULL CHECK(type IN ('consent','paid')),
  details JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(invoice,type)
);
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_special_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
COMMIT;
