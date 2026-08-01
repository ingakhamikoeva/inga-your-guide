-- Промокоды на бесплатный доступ (бета-тестировщицы, блогеры, подарки).
-- Не зависят от ЮKassa: код просто продлевает paid_until в subscriptions.
-- Применяется вручную: docker compose exec -T db psql -U inga_db_user -d postgres < 080_promo_codes.sql

CREATE TABLE IF NOT EXISTS public.promo_codes (
  code            TEXT PRIMARY KEY,              -- сам код, храним в верхнем регистре: BETA30
  days            INTEGER NOT NULL,              -- на сколько дней даёт доступ
  max_uses        INTEGER,                       -- NULL = без ограничения по количеству
  used_count      INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ,                   -- NULL = код бессрочный
  note            TEXT,                          -- для Инги: кому и зачем выдан
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Кто и когда погасил код. Пара (code, user_id) уникальна:
-- один и тот же код нельзя применить дважды одним аккаунтом.
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL REFERENCES public.promo_codes(code) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  days        INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code, user_id)
);

CREATE INDEX IF NOT EXISTS promo_redemptions_user_idx ON public.promo_redemptions(user_id);

-- Стартовый код для беты: 30 дней, максимум 100 применений.
-- Название FIRST30 выбрано намеренно: в BETA30 все буквы имеют
-- одинаковые по виду кириллические двойники (В, Е, Т, А), и человек
-- легко набирал бы код кириллицей, не понимая, почему он не работает.
INSERT INTO public.promo_codes (code, days, max_uses, note)
VALUES ('FIRST30', 30, 100, 'Бета-тестирование, июль 2026')
ON CONFLICT (code) DO NOTHING;
