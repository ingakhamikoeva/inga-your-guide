BEGIN;

-- No backfill: old registrations did not use these separate checkboxes.
-- Existing pd_consent_at / marketing_consent_at retain their meaning.
ALTER TABLE public.app_credentials
  ADD COLUMN IF NOT EXISTS terms_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registration_consent_proof JSONB;

COMMIT;
