import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
vi.hoisted(() => { vi.stubEnv('VITE_API_URL', 'http://b2.invalid/api/v1'); });
vi.mock('@/lib/achievement-client', () => ({
  useAchievements: () => ({ medals: [], streakDays: 0, uniqueRecipes: 0, reset: resetAchievements }),
  deviceTimezone: () => 'Europe/Moscow', localDay: () => '2026-10-28',
}));
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: () => ({ access: { active: true }, refresh: async () => null }) }));
vi.mock('@/components/inga/ProgressPhotosSection', () => ({ ProgressPhotosSection: () => null }));
vi.mock('@/lib/app-settings', () => ({ getSetting: async () => null }));
import { AppProvider, useApp } from '@/context/AppContext';
import { setTokens } from '@/lib/auth-storage';
import { MenuScreen } from '@/components/inga/MenuScreen';
import { SurveyDataScreen } from '@/components/inga/SurveyDataScreen';
import { loadUserProfile, loadUserPlan, loadBehaviorProfile, loadAssessmentAnswers, loadCheckins } from '@/lib/db';
const resetAchievements = () => {};
let app: ReturnType<typeof useApp>;
function Probe() { app = useApp(); return null; }
const profile = { name: 'Мария', age: 40, gender: 'female', height: 165, weight: 70, goalWeight: 65, stepsPerDay: 5000, waist: 80, hips: 95 };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
let failure: '503' | '400' | 'offline' | null;
let saved: Record<string, unknown>;
let writes: Record<string, unknown>[];
let pending: (() => Promise<Response>) | null;
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); failure = null; pending = null; saved = { ...profile }; writes = [];
  setTokens('A', 'RA', { id: 'A', user_id: 'A', email: 'a@example.invalid', email_verified: true });
  localStorage.setItem('inga-app-state', JSON.stringify({ userId: 'A', step: 'menu', profile }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url: string, opts: RequestInit) => {
    if (url.endsWith('/profile') && opts.method === 'PUT') {
      writes.push(JSON.parse(opts.body as string));
      if (pending) return pending();
      if (failure === 'offline') throw new TypeError('Failed to fetch');
      if (failure) return json({ error: 'test_failure' }, Number(failure));
      Object.assign(saved, writes.at(-1)); return json({ ok: true });
    }
    if (url.endsWith('/profile')) return json(saved);
    if (url.endsWith('/checkins')) return json([]);
    return json(null);
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function openProfile() {
  localStorage.setItem('inga-menu-jump', JSON.stringify({ section: 'profile' }));
  render(<AppProvider><Probe /><MenuScreen /></AppProvider>);
  await screen.findByText('Личные данные');
}

for (const kind of ['503', '400', 'offline'] as const) {
  test(`B2/API: failed profile name save (${kind}) retains draft, retry and reload use confirmed value`, async () => {
    failure = kind; await openProfile();
    fireEvent.click(screen.getAllByRole('button', { name: 'Изменить' })[0]);
    fireEvent.change(screen.getByPlaceholderText('Ваше имя'), { target: { value: 'Новое имя' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить изменения. Попробуйте ещё раз.');
    expect(screen.getByPlaceholderText('Ваше имя')).toHaveValue('Новое имя');
    expect(app.profile.name).toBe('Мария'); expect(saved.name).toBe('Мария');
    failure = null; fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(screen.queryByPlaceholderText('Ваше имя')).not.toBeInTheDocument());
    expect(app.profile.name).toBe('Новое имя'); expect(saved.name).toBe('Новое имя');
    await act(async () => { await app.hydrateFromDb(); });
    expect(app.profile.name).toBe('Новое имя'); expect(writes).toHaveLength(2);
  });
}

test('B2/API: numeric Enter + blur is one request, failure retains editor', async () => {
  let resolve!: (response: Response) => void;
  pending = () => new Promise<Response>(r => { resolve = r; });
  await openProfile();
  const row = screen.getByText('Возраст', { exact: true }).parentElement!;
  fireEvent.click(within(row).getByRole('button', { name: 'Изменить' }));
  const input = within(row).getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '41' } });
  fireEvent.keyDown(input, { key: 'Enter' }); fireEvent.blur(input);
  expect(writes).toHaveLength(1); expect(app.profile.age).toBe(40);
  await act(async () => { resolve(json({ error: 'temporary' }, 503)); });
  expect(await screen.findByRole('alert')).toBeVisible(); expect(input).toHaveValue(41);
  pending = null; fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(app.profile.age).toBe(41));
  expect(writes).toHaveLength(2); expect(saved.age).toBe(41);
});

test('B2/API: measurement date changes only after successful save', async () => {
  failure = '503'; await openProfile();
  const row = screen.getByText('Талия', { exact: true }).parentElement!;
  fireEvent.click(within(row).getByRole('button', { name: 'Изменить' }));
  const input = within(row).getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '79' } }); fireEvent.blur(input);
  await screen.findByRole('alert');
  expect(localStorage.getItem('inga-measurements-updated')).toBeNull();
  failure = null; fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(app.profile.waist).toBe(79));
  expect(localStorage.getItem('inga-measurements-updated')).not.toBeNull();
});

test('B2/API: survey data preserves all inputs after rejection and advances only on retry success', async () => {
  failure = '503'; render(<AppProvider><Probe /><SurveyDataScreen /></AppProvider>);
  fireEvent.change(screen.getByPlaceholderText('30'), { target: { value: '41' } });
  fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
  await screen.findByRole('alert'); expect(app.step).toBe('menu');
  expect(screen.getByPlaceholderText('30')).toHaveValue(41);
  failure = null; fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
  await waitFor(() => expect(app.step).toBe('tracking-method'));
  expect(saved.age).toBe(41);
});

for (const [name, loader] of Object.entries({ profile: loadUserProfile, plan: loadUserPlan, behavior: loadBehaviorProfile, assessment: loadAssessmentAnswers, checkins: loadCheckins })) {
  test(`B2/API: strict ${name} load rejects a server error instead of returning empty data`, async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'unavailable' }, 503)));
    await expect(loader({ strict: true })).rejects.toMatchObject({ status: 503 });
  });
}
