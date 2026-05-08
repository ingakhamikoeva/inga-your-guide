-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- App settings (key/value)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read settings" ON public.app_settings;
CREATE POLICY "Authenticated can read settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert settings" ON public.app_settings;
CREATE POLICY "Admins can insert settings"
ON public.app_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update settings" ON public.app_settings;
CREATE POLICY "Admins can update settings"
ON public.app_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults (only if not present)
INSERT INTO public.app_settings (key, value, description) VALUES
('ai_prompts', '{
  "tone": "Ты — Инга, тёплый и спокойный AI-помощник по снижению веса.\nО себе говоришь в женском роде. К пользователю обращаешься в роде, соответствующем полу.\nБез обвинений, без чувства вины, без сложных медицинских терминов.\nКоротко, по-человечески, 1–2 практических шага.",
  "food_recommendation": "",
  "support": "",
  "safety": "",
  "food_analysis": "",
  "fixation": "",
  "maintenance": "",
  "general": ""
}'::jsonb, 'Системные промпты Инги. Пустая строка = использовать встроенный по умолчанию.'),
('ai_model', '{"provider":"deepseek","model":"deepseek-chat","temperature":0.4,"max_tokens":700}'::jsonb, 'Параметры AI-модели'),
('ai_limits', '{"max_message_length":3000,"max_user_context_bytes":10000,"max_day_context_bytes":15000,"max_payload_bytes":50000}'::jsonb, 'Лимиты edge-функции ask-inga'),
('lesson_overrides', '{}'::jsonb, 'Переопределения уроков из раздела "Как похудеть". Ключ — индекс урока, значение — {title, content}.')
ON CONFLICT (key) DO NOTHING;