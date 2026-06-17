-- Migration 040: add motivation[] and kg_to_lose to user_profile
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS motivation TEXT[],
  ADD COLUMN IF NOT EXISTS kg_to_lose NUMERIC(5,1);
