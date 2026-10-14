BEGIN;

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'manual' CHECK(kind IN ('manual','initial','renewal')),
  ADD COLUMN IF NOT EXISTS renewal_epoch BIGINT,
  ADD COLUMN IF NOT EXISTS parent_invoice TEXT REFERENCES public.payment_orders(invoice),
  ADD COLUMN IF NOT EXISTS dispatch_state TEXT NOT NULL DEFAULT 'none'
    CHECK(dispatch_state IN ('none','claimed','accepted','unknown','cancelled'));
ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_status_check;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_status_check CHECK(status IN ('pending','paid','void'));

CREATE TABLE IF NOT EXISTS public.payment_auto_renewal (
  user_id UUID PRIMARY KEY REFERENCES public.users(user_id),
  epoch BIGINT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT false,
  initial_invoice TEXT REFERENCES public.payment_orders(invoice),
  parent_invoice TEXT REFERENCES public.payment_orders(invoice),
  next_due TIMESTAMPTZ,
  stopped_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.payment_renewal_cycles (
  user_id UUID NOT NULL REFERENCES public.users(user_id),
  epoch BIGINT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  charge_at TIMESTAMPTZ NOT NULL,
  notice_sent_at TIMESTAMPTZ,
  notice_attempted_at TIMESTAMPTZ,
  notice_email TEXT,
  invoice TEXT UNIQUE REFERENCES public.payment_orders(invoice),
  PRIMARY KEY(user_id,epoch,due_at)
);
CREATE TABLE IF NOT EXISTS public.payment_renewal_events (
  event_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(user_id),
  epoch BIGINT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('intent','activated','cancelled','paused','reminder','dispatch','provider_response')),
  details JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_auto_renewal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_renewal_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_renewal_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS payment_auto_renewal_due_idx ON public.payment_auto_renewal(next_due) WHERE enabled;
CREATE INDEX IF NOT EXISTS payment_renewal_events_user_idx ON public.payment_renewal_events(user_id,created_at);

COMMIT;
