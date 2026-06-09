// AI endpoint invocation. Routes everything through the Node API.
import { apiFetch, ApiError } from './api-client';

export async function invokeFunction<T = unknown>(
  name: string,
  body: unknown,
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const data = await apiFetch<T>(`/${name}`, { method: 'POST', body: body ?? {} });
    return { data, error: null };
  } catch (e) {
    if (e instanceof ApiError) {
      return { data: (e.body as T) ?? null, error: e };
    }
    return { data: null, error: e as Error };
  }
}
