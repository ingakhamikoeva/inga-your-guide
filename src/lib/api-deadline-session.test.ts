import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear();
  vi.stubEnv('VITE_API_URL', 'https://api.invalid/api/v1');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function setup() {
  const storage = await import('./auth-storage');
  storage.setTokens('private-access', 'private-refresh', { id: 'A', user_id: 'A', email: 'private@example.invalid' });
  return { storage, ...(await import('./api-client')) };
}
test('refresh timeout retains account and next attempt can recover', async () => {
  const { storage, apiFetch } = await setup();
  const fetch = vi.fn().mockResolvedValueOnce(json({}, 401)).mockImplementationOnce(() => new Promise<Response>(() => {}));
  vi.stubGlobal('fetch', fetch);
  const failed = apiFetch('/profile').catch(e => e);
  await vi.advanceTimersByTimeAsync(30001);
  expect(await failed).toMatchObject({ name: 'TimeoutError' });
  expect(storage.currentSession()?.user.id).toBe('A');
  fetch.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ access_token: 'renewed' })).mockResolvedValueOnce(json({ name: 'A' }));
  expect(await apiFetch('/profile')).toEqual({ name: 'A' });
  expect(storage.currentSession()?.access_token).toBe('renewed');
});
test.each(['network', '503'])('transient refresh failure %s does not sign out', async mode => {
  const { storage, apiFetch } = await setup();
  const fetch = vi.fn().mockResolvedValueOnce(json({}, 401));
  if (mode === 'network') fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  else fetch.mockResolvedValueOnce(json({}, 503));
  vi.stubGlobal('fetch', fetch);
  await expect(apiFetch('/profile')).rejects.toBeInstanceOf(Error);
  expect(storage.currentSession()?.user.id).toBe('A');
});
test('late login success after timeout cannot create session', async () => {
  const { storage } = await setup(); storage.clearTokens();
  const { auth } = await import('./auth');
  let resolve!: (res: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(r => { resolve = r; })));
  const result = auth.signInWithPassword({ email: 'private@example.invalid', password: 'private' });
  await vi.advanceTimersByTimeAsync(30001);
  expect((await result).error?.name).toBe('TimeoutError');
  resolve(json({ access_token: 'late', refresh_token: 'late', user: { id: 'A' } }));
  await vi.advanceTimersByTimeAsync(1);
  expect(storage.currentSession()).toBeNull();
});
