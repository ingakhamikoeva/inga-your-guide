-- Table for storing user's meal plans for next day
CREATE TABLE public.meal_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date_for DATE NOT NULL,
  plan_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, date_for)
);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal plans"
  ON public.meal_plans
  FOR SELECT
  USING (user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can insert own meal plans"
  ON public.meal_plans
  FOR INSERT
  WITH CHECK (user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can update own meal plans"
  ON public.meal_plans
  FOR UPDATE
  USING (user_id IN (SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid()));

CREATE TRIGGER update_meal_plans_updated_at
  BEFORE UPDATE ON public.meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_meal_plans_user_date ON public.meal_plans(user_id, date_for);