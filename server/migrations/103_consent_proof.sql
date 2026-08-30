-- Доказательство получения согласия (ч. 3 ст. 9 152-ФЗ: обязанность доказать,
-- что согласие было получено, лежит на операторе). Ответ Управления РКН по
-- Уральскому ФО от 27.08.2026 № 30074-05/66 отдельно напоминает это требование.
--
-- Что добавляем:
--   consent_doc_version  — редакция оферты и политики, действовавшая в момент
--                          согласия. Тексты меняются (первая публикация —
--                          12.08.2026), и без этого поля нельзя установить,
--                          с какой именно версией согласился пользователь.
--   marketing_consent_at — когда дано согласие на рекламную рассылку. Раньше
--                          хранилось только булево, а ст. 18 38-ФЗ требует
--                          доказать факт и момент получения согласия.
--
-- Применяется вручную:
--   docker compose exec -T db psql -U inga_db_user -d postgres < 103_consent_proof.sql

ALTER TABLE public.app_credentials
  ADD COLUMN IF NOT EXISTS consent_doc_version  TEXT,
  ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ;

-- Бэкфилл: у тех, кто уже согласился на рассылку, согласие было дано в момент
-- регистрации — переносим эту метку времени, чтобы не потерять доказательство.
UPDATE public.app_credentials
   SET marketing_consent_at = pd_consent_at
 WHERE marketing_consent = true
   AND marketing_consent_at IS NULL
   AND pd_consent_at IS NOT NULL;
