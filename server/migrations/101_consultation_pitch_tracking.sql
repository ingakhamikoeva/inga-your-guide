-- "Экологичная продажа" личной консультации внутри чата «Спросить Ингу»:
-- показываем не чаще раза в 2 месяца и только пользователям, у которых уже
-- есть минимальный стаж в приложении (доверие). created_at в app_credentials
-- уже даёт дату регистрации, не хватало только даты последнего показа питча.
--
-- Применяется вручную:
--   docker compose exec -T db psql -U inga_db_user -d postgres < 101_consultation_pitch_tracking.sql

ALTER TABLE public.app_credentials
  ADD COLUMN IF NOT EXISTS last_consultation_pitch_at TIMESTAMPTZ;
