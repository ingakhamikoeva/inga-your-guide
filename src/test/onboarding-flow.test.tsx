import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { UserProfile } from '@/lib/types';
import { setTokens } from '@/lib/auth-storage';
import * as db from '@/lib/db';
import Index from '@/pages/Index';

vi.mock('@/lib/achievement-client', () => ({ useAchievements: () => ({ medals: [], streakDays: 0, uniqueRecipes: 0, reset: resetAchievements }) }));
vi.mock('@/context/SubscriptionContext', () => ({
  SubscriptionProvider: ({ children }: { children: ReactNode }) => children,
  useSubscription: () => ({ access: { active: true }, refresh: async () => null }),
}));
vi.mock('@/components/inga/AuthScreen', () => ({ AuthScreen: () => <div>auth-test-screen</div> }));
vi.mock('@/components/inga/DailyScreen', () => ({ DailyScreen: () => <div>daily-test-screen</div> }));
vi.mock('@/components/inga/MenuScreen', () => ({ MenuScreen: () => null }));
vi.mock('@/components/inga/ChatScreen', () => ({ ChatScreen: () => null }));
vi.mock('@/lib/db', () => ({
  saveUserProfile: vi.fn(), saveUserPlan: vi.fn(), saveAssessmentAnswers: vi.fn(), saveBehaviorProfile: vi.fn(),
  startTrial: vi.fn(), logUserEvent: vi.fn(),
  loadUserProfile: vi.fn(), loadUserPlan: vi.fn(), loadBehaviorProfile: vi.fn(), loadAssessmentAnswers: vi.fn(), loadCheckins: vi.fn(),
  saveFixationAction: vi.fn(), saveDailyCheckin: vi.fn(), saveEveningReflection: vi.fn(), requestConsultation: vi.fn(),
}));
const resetAchievements = () => {};
const named: Partial<UserProfile> = { name: 'Мария', gender: 'female' };
const complete: Partial<UserProfile> = { ...named, age: 40, height: 165, weight: 70, goalWeight: 60, kgToLose: 10, stepsPerDay: 5000 };
let saved: Partial<UserProfile>;
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); saved = {};
  setTokens('A', 'RA', { id: 'A', user_id: 'A', email: 'a@example.invalid', email_verified: true });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.mocked(db.loadUserProfile).mockImplementation(async () => ({ ...saved }));
  vi.mocked(db.loadUserPlan).mockResolvedValue(null);
  vi.mocked(db.loadBehaviorProfile).mockResolvedValue(null);
  vi.mocked(db.loadAssessmentAnswers).mockResolvedValue(null);
  vi.mocked(db.loadCheckins).mockResolvedValue([]);
  vi.mocked(db.saveUserProfile).mockImplementation(async data => { saved = { ...saved, ...data }; });
  vi.mocked(db.saveUserPlan).mockResolvedValue(undefined);
  vi.mocked(db.startTrial).mockResolvedValue(undefined);
  vi.mocked(db.logUserEvent).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('onboarding: forward/back navigation reaches diary without motivation, with B2 save gates intact', async () => {
  render(<Index />);
  fireEvent.change(await screen.findByPlaceholderText('Например, Мария'), { target: { value: 'Мария' } });
  fireEvent.click(screen.getByRole('button', { name: 'Женщина' }));
  fireEvent.click(screen.getByRole('button', { name: 'Приятно познакомиться →' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Это моя цель →' }));
  await screen.findByPlaceholderText('30');
  expect(screen.queryByText(/что для вас изменится/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Это моя цель →' }));
  fireEvent.change(await screen.findByPlaceholderText('30'), { target: { value: '40' } });
  fireEvent.change(screen.getByPlaceholderText('165'), { target: { value: '165' } });
  fireEvent.change(screen.getByPlaceholderText('70'), { target: { value: '70' } });
  vi.mocked(db.saveUserProfile).mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить изменения. Попробуйте ещё раз.');
  expect(screen.getByPlaceholderText('70')).toHaveValue(70);
  expect(screen.queryByRole('button', { name: /Метод тарелки/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
  fireEvent.click(await screen.findByRole('button', { name: /Метод тарелки/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Мой метод →' }));
  await screen.findByText('РАЗБОР — ВАШ НАВИГАТОР ПО ДНЮ', { exact: false });
  expect(screen.queryByText('ВЕЧЕРОМ — 2 МИНУТЫ', { exact: false })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Мой метод →' }));
  fireEvent.click(await screen.findByRole('button', { name: 'К первому дню →' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Начнём, Мария →' }));
  await screen.findByText('daily-test-screen');
  expect(db.saveUserPlan).toHaveBeenCalledTimes(1);
  expect(db.startTrial).toHaveBeenCalledTimes(1);
  expect(saved.motivation).toBeUndefined();
});

test.each([
  { name: 'goal not chosen', profile: named, expected: 'goal' },
  { name: 'kilogram goal saved, no measurements', profile: { ...named, kgToLose: 10 }, expected: 'survey' },
  { name: 'target weight saved, no motivation or measurements', profile: { ...named, goalWeight: 60 }, expected: 'survey' },
  { name: 'complete measurements without motivation', profile: complete, expected: 'method' },
])('onboarding: reload resumes $name', async ({ profile, expected }) => {
  saved = { ...profile };
  render(<Index />);
  if (expected === 'goal') await screen.findByRole('button', { name: 'Это моя цель →' });
  if (expected === 'survey') await screen.findByPlaceholderText('30');
  if (expected === 'method') await screen.findByRole('button', { name: /Метод тарелки/ });
  expect(screen.queryByText(/что для вас изменится/i)).not.toBeInTheDocument();
});

test('onboarding: successful goal save survives reload before target weight is calculated', async () => {
  saved = { ...named };
  const first = render(<Index />);
  fireEvent.click(await screen.findByRole('button', { name: 'Это моя цель →' }));
  await screen.findByPlaceholderText('30');
  first.unmount();
  render(<Index />);
  await screen.findByPlaceholderText('30');
  expect(screen.queryByRole('button', { name: 'Это моя цель →' })).not.toBeInTheDocument();
});

test('onboarding: old saved why step is skipped and previously collected motivation is preserved', async () => {
  saved = { ...named, kgToLose: 10, motivation: ['Хочу позаботиться о здоровье'] };
  localStorage.setItem('inga-app-state', JSON.stringify({ userId: 'A', step: 'why', profile: saved }));
  render(<Index />);
  await screen.findByPlaceholderText('30');
  await waitFor(() => expect(JSON.parse(localStorage.getItem('inga-app-state')!).profile.motivation).toEqual(saved.motivation));
  expect(db.saveUserProfile).not.toHaveBeenCalled();
});

test('onboarding: existing completed account still opens diary', async () => {
  saved = { ...complete, trackingMethod: 'plate' };
  render(<Index />);
  await screen.findByText('daily-test-screen');
  expect(db.startTrial).not.toHaveBeenCalled();
});
