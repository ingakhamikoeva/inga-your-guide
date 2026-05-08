import { supabase } from '@/integrations/supabase/client';

export type SettingKey = 'ai_prompts' | 'ai_model' | 'ai_limits' | 'lesson_overrides';

export async function getSetting<T = unknown>(key: SettingKey): Promise<T | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error || !data) return null;
  return data.value as T;
}

export async function saveSetting(key: SettingKey, value: unknown): Promise<{ error: string | null }> {
  const { data: userResp } = await supabase.auth.getUser();
  const updated_by = userResp.user?.id ?? null;
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value: value as never, updated_by, updated_at: new Date().toISOString() });
  return { error: error?.message ?? null };
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data: userResp } = await supabase.auth.getUser();
  const uid = userResp.user?.id;
  if (!uid) return false;
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', uid)
    .eq('role', 'admin')
    .maybeSingle();
  if (error) return false;
  return !!data;
}
