import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const person = (id: string) => ({ id, user_id: id, email: `${id}@example.invalid` });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
function deferred<T = Response>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
}
const disposers: Array<() => void> = [];
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.resetModules();
  vi.stubEnv('VITE_API_URL', 'http://b1.invalid/api/v1');
});
afterEach(() => {
  disposers.splice(0).forEach(off => off());
  vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks();
});
async function setup() {
  const storage = await import('./auth-storage');
  const { apiFetch } = await import('./api-client');
  storage.setTokens('access-A', 'refresh-A', person('A'));
  return { storage, apiFetch };
}

test('B1: delayed 401 never replays A profile with B credentials', async () => {
  const { storage, apiFetch } = await setup(); const first = deferred();
  const fetch = vi.fn().mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce(json({ access_token: 'access-B-new' })).mockResolvedValue(json({ ok: true }));
  vi.stubGlobal('fetch', fetch);
  const result = apiFetch('/profile', { method: 'PUT', body: { name: 'PRIVATE A' } }).catch(e => e);
  storage.setTokens('access-B', 'refresh-B', person('B')); storage.notifyAuthChange('SIGNED_IN');
  first.resolve(json({}, 401));
  expect(await result).toMatchObject({ name: 'AbortError' });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(storage.currentSession()?.access_token).toBe('access-B');
});

for (const outcome of ['success', '401', 'network'] as const) {
  test(`B1: late A refresh (${outcome}) cannot overwrite or sign out B`, async () => {
    const { storage, apiFetch } = await setup(); const refresh = deferred();
    const fetch = vi.fn().mockResolvedValueOnce(json({}, 401)).mockReturnValueOnce(refresh.promise)
      .mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    const result = apiFetch('/profile').catch(e => e);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    storage.setTokens('access-B', 'refresh-B', person('B')); storage.notifyAuthChange('SIGNED_IN');
    if (outcome === 'network') refresh.reject(new TypeError('network'));
    else refresh.resolve(outcome === 'success' ? json({ access_token: 'access-A-new' }) : json({}, 401));
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(storage.currentSession()).toMatchObject({ access_token: 'access-B', user: person('B') });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
}

test('B1: late successful response and diary event are discarded after account switch', async () => {
  const { storage, apiFetch } = await setup(); const first = deferred(); const saved = vi.fn();
  window.addEventListener('legche:diary-saved', saved);
  disposers.push(() => window.removeEventListener('legche:diary-saved', saved));
  vi.stubGlobal('fetch', vi.fn(() => first.promise));
  const result = apiFetch('/profile', { method: 'PUT', body: { name: 'A' } }).catch(e => e);
  storage.setTokens('access-B', 'refresh-B', person('B')); storage.notifyAuthChange('SIGNED_IN');
  first.resolve(json({ name: 'A' }));
  expect(await result).toMatchObject({ name: 'AbortError' }); expect(saved).not.toHaveBeenCalled();
});

test('B1: successful response body delayed across account switch is discarded', async () => {
  const { storage, apiFetch } = await setup(); const body = deferred<string>();
  const text = vi.fn(() => body.promise);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, text }));
  const result = apiFetch('/profile').catch(e => e);
  await vi.waitFor(() => expect(text).toHaveBeenCalledOnce());
  storage.setTokens('access-B', 'refresh-B', person('B'));
  body.resolve('{"name":"A"}');
  expect(await result).toMatchObject({ name: 'AbortError' });
});

test('B1: logout and login to the same user invalidates the previous request', async () => {
  const { storage, apiFetch } = await setup(); const first = deferred();
  const fetch = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(json({ access_token: 'new' }));
  vi.stubGlobal('fetch', fetch);
  const result = apiFetch('/profile').catch(e => e);
  storage.clearTokens(); storage.setTokens('access-A2', 'refresh-A2', person('A'));
  first.resolve(json({}, 401));
  expect(await result).toMatchObject({ name: 'AbortError' }); expect(fetch).toHaveBeenCalledTimes(1);
});

test('B1: ordinary refresh retries once with the new token and the original body', async () => {
  const { storage, apiFetch } = await setup();
  const fetch = vi.fn().mockResolvedValueOnce(json({}, 401))
    .mockResolvedValueOnce(json({ access_token: 'access-A-new', refresh_token: 'refresh-A' }))
    .mockResolvedValueOnce(json({ ok: true }));
  vi.stubGlobal('fetch', fetch);
  expect(await apiFetch('/profile', { method: 'PUT', body: { name: 'A' } })).toEqual({ ok: true });
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls[2][1]).toMatchObject({ body: '{"name":"A"}', headers: { Authorization: 'Bearer access-A-new' } });
  expect(storage.currentSession()?.user.id).toBe('A');
});

test('B1: concurrent requests within one session share a refresh', async () => {
  const { apiFetch } = await setup(); const refresh = deferred(); let refreshCalls = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, opts: RequestInit) => {
    if (url.endsWith('/auth/refresh')) { refreshCalls++; return refresh.promise; }
    return json({}, (opts.headers as Record<string, string>).Authorization === 'Bearer access-A' ? 401 : 200);
  }));
  const requests = [apiFetch('/profile'), apiFetch('/checkins')];
  await vi.waitFor(() => expect(refreshCalls).toBe(1));
  refresh.resolve(json({ access_token: 'access-A-new' }));
  await Promise.all(requests); expect(refreshCalls).toBe(1);
});

test('B1: failed refresh of the current session still signs out', async () => {
  const { storage, apiFetch } = await setup(); const changed = vi.fn();
  disposers.push(storage.subscribe(changed));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 401)));
  await expect(apiFetch('/profile')).rejects.toBeInstanceOf(Error);
  expect(storage.currentSession()).toBeNull(); expect(changed).toHaveBeenCalledWith('SIGNED_OUT', null);
});

test('B1: delayed logout of A does not clear a newer login B', async () => {
  const { storage } = await setup(); const { auth } = await import('./auth'); const pending = deferred();
  vi.stubGlobal('fetch', vi.fn(() => pending.promise));
  const result = auth.signOut();
  storage.setTokens('access-B', 'refresh-B', person('B')); storage.notifyAuthChange('SIGNED_IN');
  pending.resolve(json({ ok: true })); await result;
  expect(storage.currentSession()?.user.id).toBe('B');
});

// Reproduce browser storage events using an independent module instance as another tab.
test('B1: other-tab login, token refresh, logout and clear notify subscribers', async () => {
  const { storage } = await setup(); const changed = vi.fn(); disposers.push(storage.subscribe(changed));
  vi.resetModules(); const otherTab = await import('./auth-storage');
  const publish = (action: () => void) => {
    const before = new Map(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]));
    action();
    for (const key of new Set([...before.keys(), ...Object.keys(localStorage)])) {
      const oldValue = before.get(key) ?? null; const newValue = localStorage.getItem(key);
      if (oldValue !== newValue) window.dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue, storageArea: localStorage }));
    }
  };
  publish(() => otherTab.setTokens('access-B', 'refresh-B', person('B')));
  expect(changed).toHaveBeenLastCalledWith('SIGNED_IN', expect.objectContaining({ user: person('B') }));
  publish(() => otherTab.setTokens('access-B-new', 'refresh-B'));
  expect(changed).toHaveBeenLastCalledWith('TOKEN_REFRESHED', expect.objectContaining({ access_token: 'access-B-new' }));
  publish(() => otherTab.clearTokens()); expect(changed).toHaveBeenLastCalledWith('SIGNED_OUT', null);
  publish(() => otherTab.setTokens('access-C', 'refresh-C', person('C')));
  localStorage.clear(); window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }));
  expect(changed).toHaveBeenLastCalledWith('SIGNED_OUT', null);
});

test('B1: B uses its own refresh while A refresh is still pending', async () => {
  const { storage, apiFetch } = await setup(); const oldRefresh = deferred();
  const tokens: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, opts: RequestInit) => {
    if (url.endsWith('/auth/refresh')) {
      const token = JSON.parse(opts.body as string).refresh_token; tokens.push(token);
      return token === 'refresh-A' ? oldRefresh.promise : json({ access_token: 'access-B-new' });
    }
    return json({ ok: true }, (opts.headers as Record<string, string>).Authorization.endsWith('-new') ? 200 : 401);
  }));
  const a = apiFetch('/profile').catch(e => e);
  await vi.waitFor(() => expect(tokens).toEqual(['refresh-A']));
  storage.setTokens('access-B', 'refresh-B', person('B')); storage.notifyAuthChange('SIGNED_IN');
  expect(await apiFetch('/profile')).toEqual({ ok: true });
  oldRefresh.resolve(json({ access_token: 'access-A-new' }));
  expect(await a).toMatchObject({ name: 'AbortError' });
  expect(tokens).toEqual(['refresh-A', 'refresh-B']);
  expect(storage.currentSession()?.access_token).toBe('access-B-new');
});

test('B1: existing three-key session survives reload and migrates atomically', async () => {
  localStorage.setItem('inga_access_token', 'access-A'); localStorage.setItem('inga_refresh_token', 'refresh-A');
  localStorage.setItem('inga_user', JSON.stringify(person('A')));
  const storage = await import('./auth-storage');
  const snapshot = storage.sessionSnapshot(); expect(storage.currentSession()?.user.id).toBe('A');
  storage.setTokens('access-A-new', 'refresh-A');
  expect(storage.isSessionCurrent(snapshot)).toBe(true);
  vi.resetModules(); const reloaded = await import('./auth-storage');
  expect(reloaded.currentSession()).toMatchObject({ access_token: 'access-A-new', user: person('A') });
  reloaded.clearTokens();
  vi.resetModules(); expect((await import('./auth-storage')).currentSession()).toBeNull();
});

test('B1: caller abort is preserved without clearing the session', async () => {
  const { storage, apiFetch } = await setup(); const pending = deferred(); const controller = new AbortController();
  const fetch = vi.fn(() => pending.promise); vi.stubGlobal('fetch', fetch);
  const result = apiFetch('/profile', { signal: controller.signal }).catch(e => e);
  controller.abort(); pending.resolve(json({ ok: true }));
  expect(await result).toMatchObject({ name: 'AbortError' });
  expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true);
  expect(storage.currentSession()?.user.id).toBe('A');
});

test('B1: stale access denial cannot emit a subscription event for B', async () => {
  const { storage, apiFetch } = await setup(); const pending = deferred(); const denied = vi.fn();
  window.addEventListener('legche:access-denied', denied);
  disposers.push(() => window.removeEventListener('legche:access-denied', denied));
  vi.stubGlobal('fetch', vi.fn(() => pending.promise));
  const result = apiFetch('/profile').catch(e => e);
  storage.setTokens('access-B', 'refresh-B', person('B'));
  pending.resolve(json({ error: 'access_required' }, 403)); await result;
  expect(denied).not.toHaveBeenCalled();
});

test('B1: access denial for the current account still emits its original event', async () => {
  const { apiFetch } = await setup(); const denied = vi.fn();
  window.addEventListener('legche:access-denied', denied);
  disposers.push(() => window.removeEventListener('legche:access-denied', denied));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'access_required' }, 403)));
  await expect(apiFetch('/profile')).rejects.toMatchObject({ status: 403, message: 'access_required' });
  expect(denied).toHaveBeenCalledOnce(); expect(denied.mock.calls[0][0].detail.userId).toBe('A');
});

test('B1: late login result cannot replace an intervening login', async () => {
  const { storage } = await setup(); const { auth } = await import('./auth'); const pending = deferred();
  vi.stubGlobal('fetch', vi.fn(() => pending.promise));
  const result = auth.signInWithPassword({ email: 'C@example.invalid', password: 'example' });
  storage.setTokens('access-B', 'refresh-B', person('B'));
  pending.resolve(json({ access_token: 'access-C', refresh_token: 'refresh-C', user: person('C') }));
  expect((await result).error).not.toBeNull(); expect(storage.currentSession()?.user.id).toBe('B');
});

test('B1: ordinary login and user metadata refresh keep the expected generation', async () => {
  const { storage } = await setup(); const { auth } = await import('./auth'); const old = storage.sessionSnapshot();
  const fetch = vi.fn().mockResolvedValueOnce(json({ access_token: 'access-B', refresh_token: 'refresh-B', user: person('B') }))
    .mockResolvedValueOnce(json({ user: { ...person('B'), email_verified: true } }));
  vi.stubGlobal('fetch', fetch);
  expect((await auth.signInWithPassword({ email: 'B@example.invalid', password: 'example' })).error).toBeNull();
  expect(storage.isSessionCurrent(old)).toBe(false); const signedIn = storage.sessionSnapshot();
  expect((await auth.getUser({ refresh: true })).data.user?.email_verified).toBe(true);
  expect(storage.isSessionCurrent(signedIn)).toBe(true);
});

test('B1: a queued cross-tab commit rechecks its session after acquiring the lock', async () => {
  const { storage } = await setup(); const snapshot = storage.sessionSnapshot();
  const entered = deferred<void>(); const release = deferred<void>();
  const original = Object.getOwnPropertyDescriptor(navigator, 'locks');
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: async (_name: string, callback: () => boolean) => { entered.resolve(); await release.promise; return callback(); },
  } });
  disposers.push(() => { if (original) Object.defineProperty(navigator, 'locks', original); else delete (navigator as unknown as { locks?: unknown }).locks; });
  const update = vi.fn(() => storage.setTokens('access-A-new', 'refresh-A'));
  const result = storage.commitSession(snapshot, update); await entered.promise;
  storage.setTokens('access-B', 'refresh-B', person('B')); release.resolve();
  expect(await result).toBe(false); expect(update).not.toHaveBeenCalled();
  expect(storage.currentSession()?.access_token).toBe('access-B');
});
