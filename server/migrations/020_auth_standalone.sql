-- ============================================================
-- Phase 1: Stand-alone auth (no GoTrue / no auth.users dependency)
-- ============================================================

-- Make public.users.auth_id optional and detach it from auth.users
-- (so the table works on a plain PostgreSQL without the Supabase auth schema).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND constraint_name = 'users_auth_id_fkey'
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_auth_id_fkey;
  END IF;
END $$;

ALTER TABLE public.users ALTER COLUMN auth_id DROP NOT NULL;

-- Drop the auth.users trigger if it exists (was created in 000_init.sql).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
  END IF;
END $$;

-- ── app_credentials ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_credentials (
  user_id        UUID PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  password_hash  TEXT,                                  -- nullable for OAuth-only users
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_credentials_email_lower_idx
  ON public.app_credentials (lower(email));

-- ── password_reset_tokens ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  token_hash  TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON public.password_reset_tokens (user_id);

-- ── oauth_accounts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oauth_accounts (
  provider          TEXT NOT NULL,
  provider_user_id  TEXT NOT NULL,
  user_id           UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS oauth_accounts_user_idx
  ON public.oauth_accounts (user_id);

-- Auth happens at the API layer; RLS on these tables is unnecessary
-- and would block the Node server (which connects as plain superuser).
-- We leave RLS disabled on these auth-only tables.
