import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StrictMode, type ReactNode } from 'react';
import Index from '@/pages/Index';
import { useApp } from '@/context/AppContext';
import { clearTokens, notifyAuthChange, sessionSnapshot, setTokens } from '@/lib/auth-storage';
import { readView, saveView } from '@/lib/view-storage';
import * as db from '@/lib/db';

const access = vi.hoisted(() => ({ active: true }));
const reset = () => {};
vi.mock('@/lib/achievement-client', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/achievement-client')>(),
  useAchievements: () => ({ medals: [], streakDays: 0, uniqueRecipes: 0, reset }),
}));
vi.mock('@/context/SubscriptionContext', () => ({
  SubscriptionProvider: ({ children }: { children: ReactNode }) => children,
  useSubscription: () => ({ access, refresh: async () => null }),
}));
vi.mock('@/components/inga/DailyScreen', () => ({ DailyScreen: () => {
  const { setStep } = useApp();
  return <button onClick={() => setStep('menu')}>Открыть меню тест</button>;
} }));
vi.mock('@/components/inga/AuthScreen', () => ({ AuthScreen: () => <p>auth-test</p> }));
vi.mock('@/lib/app-settings', () => ({ getSetting: async () => null }));
vi.mock('@/lib/db', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/db')>(),
  loadUserProfile: vi.fn(), loadUserPlan: vi.fn(), loadBehaviorProfile: vi.fn(),
  loadAssessmentAnswers: vi.fn(), loadCheckins: vi.fn(),
  loadProgramProgress: async () => null,
}));
function login(id = 'A') {
  setTokens('access', 'refresh', { id, user_id: id, email: `${id}@example.invalid` });
}
function mount() { return render(<StrictMode><Index /></StrictMode>); }
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); access.active = true;
  login();
  vi.mocked(db.loadUserProfile).mockResolvedValue({ name: 'Инга', gender: 'female', trackingMethod: 'plate' });
  vi.mocked(db.loadUserPlan).mockResolvedValue(null);
  vi.mocked(db.loadBehaviorProfile).mockResolvedValue(null);
  vi.mocked(db.loadAssessmentAnswers).mockResolvedValue(null);
  vi.mocked(db.loadCheckins).mockResolvedValue([]);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('profile survives reload after server hydration; normal back still opens menu', async () => {
  const first = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Открыть меню тест' }));
  fireEvent.click(await screen.findByRole('button', { name: /Профиль Данные/ }));
  await screen.findByRole('heading', { name: 'Профиль' });
  expect(readView()).toEqual({ step: 'menu', section: 'profile' });
  first.unmount();
  mount();
  await screen.findByRole('heading', { name: 'Профиль' });
  expect(screen.queryByText('Открыть меню тест')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Назад/ }));
  await screen.findByRole('heading', { name: 'Меню' });
  fireEvent.click(screen.getByRole('button', { name: /Вернуться к отчёту/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Открыть меню тест' }));
  await screen.findByRole('heading', { name: 'Меню' });
});

test('audio section survives reload for an existing account with checkins', async () => {
  vi.mocked(db.loadCheckins).mockResolvedValue([{ date: '2026-11-15', weight: 60 }]);
  saveView('menu', 'audio');
  mount();
  await screen.findByText('Я выбираю');
  expect(readView()).toEqual({ step: 'menu', section: 'audio' });
});

test('profile load failure keeps saved navigation for retry', async () => {
  saveView('menu', 'profile');
  vi.mocked(db.loadUserProfile).mockRejectedValueOnce(new Error('offline'));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));
  await screen.findByRole('heading', { name: 'Профиль' });
});

test('saved section cannot skip incomplete onboarding', async () => {
  saveView('menu', 'profile');
  vi.mocked(db.loadUserProfile).mockResolvedValue({ name: 'Инга' });
  mount();
  await screen.findByRole('button', { name: 'Женщина' });
  expect(screen.queryByRole('heading', { name: 'Профиль' })).not.toBeInTheDocument();
  expect(readView()).toBeNull();
});

test('protected restored section still requires active access', async () => {
  access.active = false;
  saveView('menu', 'audio');
  mount();
  await screen.findByText(/Промокод|Доступ|доступ/, {}, { timeout: 3000 });
  expect(screen.queryByText('Я выбираю')).not.toBeInTheDocument();
});

test('logout and a new login cannot restore the old section, even for the same user', async () => {
  saveView('menu', 'profile');
  mount();
  await screen.findByRole('heading', { name: 'Профиль' });
  act(() => { clearTokens(); notifyAuthChange('SIGNED_OUT'); });
  await screen.findByText('auth-test');
  act(() => { login(); notifyAuthChange('SIGNED_IN'); });
  await screen.findByRole('button', { name: 'Открыть меню тест' });
  fireEvent.click(screen.getByRole('button', { name: 'Открыть меню тест' }));
  await screen.findByRole('heading', { name: 'Меню' });
});

test('old account cannot overwrite navigation after account switch; token refresh preserves view', () => {
  saveView('menu', 'profile');
  const old = sessionSnapshot();
  setTokens('renewed', 'renewed-refresh');
  expect(readView()?.section).toBe('profile');
  login('B');
  expect(readView()).toBeNull();
  saveView('menu', 'audio');
  saveView('menu', 'profile', old);
  expect(readView()?.section).toBe('audio');
});

test('invalid or unavailable storage falls back without breaking startup', async () => {
  sessionStorage.setItem('legche-view-v1', '{broken');
  expect(readView()).toBeNull();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  mount();
  await screen.findByRole('button', { name: 'Открыть меню тест' });
});
