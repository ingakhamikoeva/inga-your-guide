import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { WaterTracker } from '@/components/inga/WaterTracker';
import { currentSession, setTokens, clearTokens, notifyAuthChange } from '@/lib/auth-storage';
import { LOAD_ERROR, SAVE_ERROR } from '@/hooks/use-save-action';
import { requestDeadline } from '@/lib/api-transport';

const mocked = vi.hoisted(() => ({ api: vi.fn(), day: '2026-11-15' }));
vi.mock('@/lib/api-client', () => ({ apiFetch: (...args: unknown[]) => mocked.api(...args) }));
vi.mock('@/lib/achievement-client', () => ({ localDay: () => mocked.day }));

type Water = { glasses: number; revision: number };
let records: Map<string, Water>;
const signIn = (id = 'A') => {
  setTokens(`access-${id}`, `refresh-${id}`, { id, user_id: id, email: `${id}@example.invalid` });
  notifyAuthChange('SIGNED_IN');
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function ready(count = 0) {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить' })).toBeEnabled());
  expect(screen.getByText(`${count} из 6`)).toBeInTheDocument();
}
beforeEach(() => {
  localStorage.clear(); records = new Map(); mocked.day = '2026-11-15';
  signIn();
  mocked.api.mockReset().mockImplementation(async (path, options) => {
    const key = `${currentSession()?.user.id}:${path}`;
    const old = records.get(key) || { glasses: 0, revision: 0 };
    if (options.method === 'GET') return { ...old };
    if (options.body.revision !== old.revision) throw new Error('conflict');
    const next = { glasses: options.body.glasses, revision: old.revision + 1 };
    records.set(key, next);
    return { ...next };
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('saved water survives remount and logout/login; legacy browser count is not imported into an account', async () => {
  localStorage.setItem('waterCount', '9'); localStorage.setItem('waterDate', mocked.day);
  const first = render(<StrictMode><WaterTracker date={mocked.day} /></StrictMode>);
  await ready();
  for (let i = 1; i <= 3; i++) { fireEvent.click(screen.getByRole('button', { name: 'Добавить' })); await ready(i); }
  first.unmount();
  clearTokens(); notifyAuthChange('SIGNED_OUT'); signIn();
  render(<WaterTracker date={mocked.day} />);
  await ready(3);
});

test('zero and more than six glasses persist with the existing controls', async () => {
  render(<WaterTracker date={mocked.day} />); await ready();
  for (let i = 1; i <= 6; i++) { fireEvent.click(screen.getByRole('button', { name: 'Добавить' })); await ready(i); }
  fireEvent.click(screen.getByRole('button', { name: 'Добавить' })); await ready(7);
  for (let i = 6; i >= 0; i--) { fireEvent.click(screen.getByRole('button', { name: 'Убавить' })); await ready(i); }
  expect(screen.getByRole('button', { name: 'Убавить' })).toBeDisabled();
  expect(records.get('A:/water/2026-11-15')?.glasses).toBe(0);
});

test('a delayed write blocks duplicate taps and only confirmed data appears in the counter', async () => {
  render(<WaterTracker date={mocked.day} />); await ready();
  const pending = deferred<Water>(); mocked.api.mockImplementationOnce(() => pending.promise);
  const plus = screen.getByRole('button', { name: 'Добавить' });
  fireEvent.click(plus); fireEvent.click(plus);
  expect(plus).toBeDisabled(); expect(screen.getByText('0 из 6')).toBeInTheDocument();
  expect(mocked.api.mock.calls.filter(([, options]) => options.method === 'PUT')).toHaveLength(1);
  await act(async () => pending.resolve({ glasses: 1, revision: 1 })); await ready(1);
});

test('failed initial load never writes zero and can be retried', async () => {
  mocked.api.mockRejectedValueOnce(new Error('network'));
  render(<WaterTracker date={mocked.day} />);
  expect(await screen.findByText(LOAD_ERROR)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Добавить' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' })); await ready();
  expect(mocked.api.mock.calls.every(([, options]) => options.method === 'GET')).toBe(true);
});

test('lost save response reloads the committed count instead of repeating an increment', async () => {
  render(<WaterTracker date={mocked.day} />); await ready();
  mocked.api.mockImplementationOnce(async () => {
    records.set('A:/water/2026-11-15', { glasses: 1, revision: 1 });
    throw new Error('response lost');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
  expect(await screen.findByText(SAVE_ERROR)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Добавить' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' })); await ready(1);
  expect(mocked.api.mock.calls.filter(([, options]) => options.method === 'PUT')).toHaveLength(1);
});

test('a stale tab cannot overwrite another device; focus also reloads the server value', async () => {
  render(<WaterTracker date={mocked.day} />); await ready();
  records.set('A:/water/2026-11-15', { glasses: 4, revision: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
  await screen.findByText(SAVE_ERROR);
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' })); await ready(4);
  records.set('A:/water/2026-11-15', { glasses: 5, revision: 2 });
  fireEvent.focus(window); await ready(5);
});

test.each(['GET', 'PUT'])('late %s from previous account cannot change the new account', async method => {
  const pending = deferred<Water>();
  if (method === 'GET') mocked.api.mockImplementationOnce(() => pending.promise);
  render(<WaterTracker date={mocked.day} />);
  if (method === 'PUT') {
    await ready(); mocked.api.mockImplementationOnce(() => pending.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
  }
  act(() => { clearTokens(); notifyAuthChange('SIGNED_OUT'); signIn('B'); });
  await ready();
  await act(async () => pending.resolve({ glasses: 6, revision: 3 }));
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Добавить' })); await ready(1);
  expect(records.get('B:/water/2026-11-15')?.glasses).toBe(1);
});

test('midnight starts a separate day and discards a delayed response for yesterday', async () => {
  const view = render(<WaterTracker date={mocked.day} />); await ready();
  const pending = deferred<Water>(); mocked.api.mockImplementationOnce(() => pending.promise);
  fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
  mocked.day = '2026-11-16'; view.rerender(<WaterTracker date={mocked.day} />);
  await ready(); await act(async () => pending.resolve({ glasses: 1, revision: 1 })); await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Добавить' })); await ready(1);
  expect(records.get('A:/water/2026-11-16')?.glasses).toBe(1);
});

test('water reads and writes have a bounded timeout', () => {
  expect(requestDeadline('/water/2026-11-15')).toBe(30000);
  expect(requestDeadline('/api/v1/water/2026-11-15', 'PUT')).toBe(30000);
});
