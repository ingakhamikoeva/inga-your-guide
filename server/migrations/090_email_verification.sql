-- Подтверждение email (мягкий вариант, решение Инги от 28.07.2026):
-- доступ даётся сразу, но пока адрес не подтверждён — в приложении висит
-- напоминание, а к моменту оплаты подтверждение станет обязательным.
--
-- Поле app_credentials.email_verified уже существует (см. 020_auth_standalone.sql),
-- здесь добавляем только хранилище одноразовых токенов — по образцу
-- password_reset_tokens: в базе лежит хеш, в письмо уходит сам токен.
--
-- Применяется вручную:
--   docker compose exec -T db psql -U inga_db_user -d postgres < 090_email_verification.sql

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  token_hash  TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  email       TEXT NOT NULL,          -- на какой адрес отправляли (на случай смены почты)
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx
  ON public.email_verification_tokens (user_id);
