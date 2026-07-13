-- Migration 060: фото прогресса в профиле (несколько штук, для коллажа «до/после»)
CREATE TABLE IF NOT EXISTS public.profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  image_data TEXT NOT NULL,        -- base64 data URL, сжато на клиенте перед отправкой (до ~1000px)
  thumb_data TEXT NOT NULL,        -- маленькая версия для галереи (до ~200px), чтобы список грузился быстро
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_photos_user_id_idx ON public.profile_photos (user_id, taken_at);
