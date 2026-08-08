-- Инга здоровалась в каждом ответе, потому что модель не помнит предыдущие
-- сообщения — каждый запрос к DeepSeek уходит без истории переписки.
-- Храним дату последнего приветствия, чтобы здороваться один раз в сутки.
--
-- Дата, а не тайместамп: "раз в сутки" = раз в календарный день.
--
-- Применяется вручную:
--   docker compose exec -T db psql -U inga_db_user -d postgres < 102_chat_greeting_tracking.sql

ALTER TABLE public.app_credentials
  ADD COLUMN IF NOT EXISTS last_chat_greeting_on DATE;
