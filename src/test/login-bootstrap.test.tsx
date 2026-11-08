import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
vi.hoisted(() => { vi.stubEnv('VITE_API_URL', 'https://api.invalid/api/v1'); });
import App from '@/App';
import { auth } from '@/lib/auth';
import { currentSession, notifyAuthChange, setTokens } from '@/lib/auth-storage';

const routes = ['/profile', '/plan', '/behavior', '/assessment', '/checkins'];
let account = 'A';
let stall = false;
const person = (id: string) => ({ id, user_id: id, email: `${id}@example.invalid` });
function reply(body: unknown) { return new Response(JSON.stringify(body), { status: 200 }); }
function calls(route: string) { return vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith(route)); }
function expectLoads(count: number) { for (const route of routes) expect(calls(route), route).toHaveLength(count); }
async function settle(ms = 10) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function login() {
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: `${account}@example.invalid` } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'synthetic-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  await settle();
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.useFakeTimers(); account = 'A'; stall = false;
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
    const route = new URL(String(url)).pathname.replace('/api/v1', '');
    if (route === '/auth/login') return reply({ access_token: account, refresh_token: `R${account}`, user: person(account) });
    if (stall && routes.includes(route)) return new Promise<Response>(() => {});
    if (route === '/profile') return reply({ name: `Saved ${account}` });
    if (route === '/checkins') return reply([]);
    if (route === '/achievements/sync') return reply({ medals: [], newIds: [], streakDays: 0, uniqueRecipes: 0 });
    if (route === '/subscription') return reply({ active: true });
    return reply(null);
  }));
});
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test('real login loads each bootstrap resource once and renders saved data', async () => {
  render(<App />); await settle(); await login();
  expect(currentSession()?.user.id).toBe('A');
  expect(screen.getByDisplayValue('Saved A')).toBeVisible();
  expectLoads(1); expect(calls('/auth/login')).toHaveLength(1);
  act(() => { setTokens('A-new', 'RA'); notifyAuthChange('TOKEN_REFRESHED'); notifyAuthChange('USER_UPDATED'); });
  await settle(); expectLoads(1);
});

test('saved-session reload performs one bootstrap per mount', async () => {
  setTokens('A', 'RA', person('A'));
  const view = render(<App />); await settle(); expectLoads(1);
  expect(screen.getByDisplayValue('Saved A')).toBeVisible();
  view.unmount(); render(<App />); await settle(); expectLoads(2);
});

test('stalled bootstrap ends in retry; one retry loads data without signing in again', async () => {
  stall = true; render(<App />); await settle(); await login(); expectLoads(1);
  await settle(30001);
  expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить ваши данные');
  expect(screen.queryByDisplayValue('Saved A')).not.toBeInTheDocument();
  stall = false; fireEvent.click(screen.getByRole('button', { name: 'Повторить' })); await settle();
  expect(screen.getByDisplayValue('Saved A')).toBeVisible(); expectLoads(2);
  expect(calls('/auth/login')).toHaveLength(1);
});

test('logout and login to another account load once for each account, without old data', async () => {
  render(<App />); await settle(); await login(); expectLoads(1);
  await act(async () => { await auth.signOut(); }); await settle();
  expect(screen.queryByDisplayValue('Saved A')).not.toBeInTheDocument();
  account = 'B'; await login(); expectLoads(2);
  expect(currentSession()?.user.id).toBe('B');
  expect(screen.getByDisplayValue('Saved B')).toBeVisible();
  expect(screen.queryByDisplayValue('Saved A')).not.toBeInTheDocument();
});
