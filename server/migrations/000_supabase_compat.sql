-- ============================================================
-- Supabase compatibility shim for plain PostgreSQL 15.
--
-- The original schema (010_init.sql) was written for the Supabase
-- distribution and references:
--   • extension `pgcrypto` (for gen_random_uuid)
--   • schema   `auth`     (auth.users)
--   • function `auth.uid()` (returns the current user's id from JWT)
--
-- On plain `postgres:15-alpine` none of that exists. This shim creates
-- minimal stubs so the existing CREATE TABLE / CREATE POLICY statements
-- run unchanged.
--
-- RLS still gets enabled, but our Node API connects as the DB owner
-- (which bypasses RLS), and auth.uid() returns NULL so any leftover
-- RLS check from app code denies — defence in depth.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claim.role', true)
$$;
