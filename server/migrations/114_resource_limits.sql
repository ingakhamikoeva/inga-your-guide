-- B3: durable quotas and short-lived AI concurrency leases. Additive/idempotent.
BEGIN;
CREATE TABLE IF NOT EXISTS public.resource_limit_buckets (
  key TEXT PRIMARY KEY,
  hits BIGINT NOT NULL CHECK (hits >= 0),
  units BIGINT NOT NULL DEFAULT 0 CHECK (units >= 0),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS resource_limit_buckets_expiry_idx ON public.resource_limit_buckets(expires_at);
CREATE TABLE IF NOT EXISTS public.ai_request_leases (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_request_leases_expiry_idx ON public.ai_request_leases(expires_at);
COMMIT;
