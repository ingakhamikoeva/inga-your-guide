-- Согласия при регистрации + источник (UTM) — по требованию юрблока лендинга
-- (152-ФЗ: раздельное согласие на обработку ПД и на рассылку) и по задаче
-- аналитики регистраций с лендинга (2.08.2026).
--
-- pd_consent_at — когда пользователь согласился на обработку ПД (обязательно
-- при регистрации, поэтому это метка времени, а не булево: если она есть —
-- значит согласие было дано в момент регистрации).
-- marketing_consent — отдельное необязательное согласие на рассылку.
--
-- Источник регистрации (utm_source и т.д.) в отдельную таблицу не выносим —
-- пишем один раз в user_events как событие 'registration_source', по образцу
-- email_day0_sent (см. server/auth.js).
--
-- Применяется вручную:
--   docker compose exec -T db psql -U inga_db_user -d postgres < 100_registration_consents.sql

ALTER TABLE public.app_credentials
  ADD COLUMN IF NOT EXISTS pd_consent_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false;
