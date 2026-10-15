BEGIN;

ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_status_check;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_status_check
  CHECK(status IN ('pending','paid','void','failed'));
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS status_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_next_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_result_code INTEGER,
  ADD COLUMN IF NOT EXISTS status_state_code INTEGER,
  ADD COLUMN IF NOT EXISTS terminal_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terminal_state_code INTEGER,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.payment_status_checks (
  check_id BIGSERIAL PRIMARY KEY,
  invoice TEXT NOT NULL REFERENCES public.payment_orders(invoice),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  result_code INTEGER,
  state_code INTEGER,
  outcome TEXT NOT NULL CHECK(outcome IN ('unknown','pending','paid','terminal_observed','failed','already_paid'))
);
ALTER TABLE public.payment_status_checks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS payment_status_checks_invoice_idx
  ON public.payment_status_checks(invoice,checked_at);
CREATE INDEX IF NOT EXISTS payment_orders_status_due_idx
  ON public.payment_orders(status_next_check_at,created_at) WHERE status='pending' AND kind='renewal';

-- Test/live order namespaces and the live-payment hard stop remain unchanged.
COMMIT;
