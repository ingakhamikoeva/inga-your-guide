// Admin-only settings. Reads and writes go through the Node API.
import { apiFetch } from './api-client';

export type SettingKey = 'ai_prompts' | 'ai_model' | 'ai_limits' | 'lesson_overrides';

export async function getSetting<T = unknown>(key: SettingKey): Promise<T | null> {
  try {
    return await apiFetch<T | null>(`/admin/settings/${key}`);
  } catch (e) {
    console.error('getSetting failed', e);
    return null;
  }
}

export async function saveSetting(key: SettingKey, value: unknown): Promise<{ error: string | null }> {
  try {
    await apiFetch(`/admin/settings/${key}`, { method: 'PUT', body: { value } });
    return { error: null };
  } catch (e: any) {
    return { error: e?.message ?? 'save_failed' };
  }
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const r = await apiFetch<{ admin: boolean }>('/admin/me');
    return !!r.admin;
  } catch {
    return false;
  }
}
