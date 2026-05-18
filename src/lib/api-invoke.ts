// Unified function invocation.
// If VITE_API_BASE_URL is set (self-hosted server), POST there.
// Otherwise, use supabase.functions.invoke (Lovable Cloud edge functions).

import { supabase } from '@/integrations/supabase/client';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export async function invokeFunction<T = unknown>(
  name: string,
  body: unknown,
): Promise<{ data: T | null; error: Error | null }> {
  if (!API_BASE) {
    const { data, error } = await supabase.functions.invoke(name, { body });
    return { data: (data as T) ?? null, error: (error as Error) ?? null };
  }

  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    const res = await fetch(`${API_BASE}/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { data: (json as T) ?? null, error: new Error((json as any)?.error || `HTTP ${res.status}`) };
    }
    return { data: json as T, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}
