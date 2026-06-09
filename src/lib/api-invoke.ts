// Unified function invocation for AI endpoints.
// If VITE_API_URL/VITE_API_BASE_URL is set, POST to the self-hosted Node API.
// Otherwise, fall back to supabase.functions.invoke for the Lovable preview.

import { supabase } from '@/integrations/supabase/client';
import { HAS_API, API_BASE, ApiError } from './api-client';
import { getAccessToken } from './auth-storage';

export async function invokeFunction<T = unknown>(
  name: string,
  body: unknown,
): Promise<{ data: T | null; error: Error | null }> {
  if (!HAS_API) {
    const { data, error } = await supabase.functions.invoke(name, { body });
    return { data: (data as T) ?? null, error: (error as Error) ?? null };
  }

  try {
    const token = getAccessToken();
    const url = `${API_BASE}/${name}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { data: (json as T) ?? null, error: new ApiError(res.status, json) };
    }
    return { data: json as T, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}
