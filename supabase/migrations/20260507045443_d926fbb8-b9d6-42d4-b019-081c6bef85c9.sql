
-- 1. Add UPDATE/DELETE policies for user-owned tables
CREATE POLICY "Users can update own food logs" ON public.food_logs
  FOR UPDATE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can delete own food logs" ON public.food_logs
  FOR DELETE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can delete own summary" ON public.daily_nutrition_summary
  FOR DELETE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can update own reflections" ON public.evening_reflections
  FOR UPDATE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can delete own reflections" ON public.evening_reflections
  FOR DELETE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can delete own chat events" ON public.chat_events
  FOR DELETE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can delete own events" ON public.user_events
  FOR DELETE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

CREATE POLICY "Users can update own consultations" ON public.consultations
  FOR UPDATE USING (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()));

-- 2. Remove daily_nutrition_summary from realtime publication (not used in app)
ALTER PUBLICATION supabase_realtime DROP TABLE public.daily_nutrition_summary;

-- 3. Lock down SECURITY DEFINER functions: revoke EXECUTE from public roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
