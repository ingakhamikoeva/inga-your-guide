import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
vi.hoisted(() => { vi.stubEnv('VITE_API_URL', 'https://api.invalid/api/v1'); });
import App from '@/App';
import { setTokens, currentSession } from '@/lib/auth-storage';
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.useFakeTimers();
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
});
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function openLogin() {
  render(<App />);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'synthetic@example.invalid' } });
}
test('login spinner ends with the existing error text after a stalled request', async () => {
  await openLogin();
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'synthetic-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  expect(screen.getByRole('button', { name: '...' })).toBeDisabled();
  await act(async () => { await vi.advanceTimersByTimeAsync(30001); });
  expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled();
  expect(screen.getByText('Произошла ошибка')).toBeVisible();
  expect(currentSession()).toBeNull();
});
test('forgot-password spinner ends without a false sent confirmation or automatic retry', async () => {
  await openLogin();
  fireEvent.click(screen.getByRole('button', { name: 'Забыли пароль?' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(60001); });
  expect(screen.getByRole('button', { name: 'Забыли пароль?' })).toBeEnabled();
  expect(screen.getByText('Не удалось отправить письмо')).toBeVisible();
  expect(screen.queryByText(/Письмо со ссылкой для восстановления отправлено/)).not.toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/auth/forgot-password'))).toHaveLength(1);
});
test('saved session stops showing a blank screen; retry can load profile when network returns', async () => {
  setTokens('synthetic-access', 'synthetic-refresh', { id: 'A', user_id: 'A', email: 'synthetic@example.invalid' });
  render(<App />);
  await act(async () => { await vi.advanceTimersByTimeAsync(30001); });
  expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить ваши данные. Попробуйте ещё раз.');
  expect(currentSession()?.user.id).toBe('A');
  vi.mocked(fetch).mockImplementation(async url => new Response(JSON.stringify(String(url).endsWith('/profile') ? { name: 'Synthetic' } : String(url).endsWith('/checkins') ? [] : null), { status: 200 }));
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument();
  expect(document.body.textContent?.trim().length).toBeGreaterThan(0);
});
