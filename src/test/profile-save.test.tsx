import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { AppProvider, useApp } from '@/context/AppContext';
import { setTokens, clearTokens } from '@/lib/auth-storage';
import * as db from '@/lib/db';
import { SurveyNameScreen } from '@/components/inga/SurveyNameScreen';
import { RouteReadyScreen } from '@/components/inga/RouteReadyScreen';
import { AccessScreen } from '@/components/inga/AccessScreen';
import { beginTrial } from '@/lib/subscription';

vi.mock('@/lib/achievement-client', () => ({ useAchievements: () => ({ medals: [], streakDays: 0, uniqueRecipes: 0, reset: () => {} }) }));
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: () => ({ access: { status: 'not_started' }, checking: false, error: null, refresh: vi.fn().mockResolvedValue(null) }) }));
vi.mock('@/lib/subscription', () => ({ beginTrial: vi.fn() }));
vi.mock('@/lib/db', () => ({
  saveUserProfile: vi.fn(), saveUserPlan: vi.fn(), saveAssessmentAnswers: vi.fn(), saveBehaviorProfile: vi.fn(),
  isAuthenticated: vi.fn().mockResolvedValue(true), startTrial: vi.fn(), logUserEvent: vi.fn(),
  loadUserProfile: vi.fn(), loadUserPlan: vi.fn(), loadBehaviorProfile: vi.fn(), loadAssessmentAnswers: vi.fn(), loadCheckins: vi.fn(),
  saveFixationAction: vi.fn(), saveDailyCheckin: vi.fn(), saveEveningReflection: vi.fn(), requestConsultation: vi.fn(),
}));
let app: ReturnType<typeof useApp>;
function Probe() { app = useApp(); return <output data-testid="state">{JSON.stringify({ profile: app.profile, step: app.step })}</output>; }
function deferred() {
  let resolve!: () => void; let reject!: (error: Error) => void;
  const promise = new Promise<void>((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  setTokens('A', 'RA', { id: 'A', user_id: 'A', email: 'a@example.invalid' });
  vi.mocked(db.isAuthenticated).mockResolvedValue(true);
  vi.mocked(db.logUserEvent).mockResolvedValue(undefined);
  vi.mocked(db.startTrial).mockResolvedValue(undefined);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('B2: profile changes only after server confirmation', async () => {
  const pending = deferred(); vi.mocked(db.saveUserProfile).mockReturnValue(pending.promise);
  render(<AppProvider><Probe /></AppProvider>);
  let result: unknown;
  act(() => { result = app.updateProfile({ name: 'Saved' }); });
  expect(app.profile.name).toBeUndefined();
  await act(async () => { pending.resolve(); await result; });
  expect(app.profile.name).toBe('Saved');
});

test('B2: failed save is rejected and does not persist optimistic profile', async () => {
  vi.mocked(db.saveUserProfile).mockRejectedValue(new Error('503'));
  render(<AppProvider><Probe /></AppProvider>);
  await act(async () => { await expect(app.updateProfile({ age: 41 })).rejects.toThrow('503'); });
  expect(app.profile.age).toBeUndefined();
  expect(JSON.parse(localStorage.getItem('inga-app-state')!).profile.age).toBeUndefined();
});

test('B2: stale save does not publish profile into another session', async () => {
  const pending = deferred(); vi.mocked(db.saveUserProfile).mockReturnValue(pending.promise);
  render(<AppProvider><Probe /></AppProvider>);
  let result: Promise<unknown>;
  act(() => { result = Promise.resolve(app.updateProfile({ name: 'A' })).catch(e => e); });
  setTokens('B', 'RB', { id: 'B', user_id: 'B', email: 'b@example.invalid' });
  await act(async () => { pending.resolve(); await result; });
  expect(app.profile.name).toBeUndefined();
});

test('B2: name form waits, retains draft on failure and supports retry', async () => {
  const pending = deferred(); vi.mocked(db.saveUserProfile).mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
  render(<AppProvider><Probe /><SurveyNameScreen /></AppProvider>);
  fireEvent.change(screen.getByPlaceholderText('Например, Мария'), { target: { value: 'Мария' } });
  fireEvent.click(screen.getByRole('button', { name: 'Женщина' }));
  const next = screen.getByRole('button', { name: /Приятно познакомиться/ });
  fireEvent.click(next); fireEvent.click(next);
  expect(app.step).toBe('auth'); expect(db.saveUserProfile).toHaveBeenCalledTimes(1);
  await act(async () => { pending.reject(new Error('offline')); });
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить изменения. Попробуйте ещё раз.');
  expect(screen.getByPlaceholderText('Например, Мария')).toHaveValue('Мария');
  fireEvent.click(next);
  await waitFor(() => expect(app.step).toBe('goal'));
  expect(app.profile.name).toBe('Мария');
});

test('B2: failed final synchronization never starts trial or opens diary', async () => {
  vi.mocked(db.saveUserProfile).mockRejectedValue(new Error('503'));
  render(<AppProvider><Probe /><RouteReadyScreen /></AppProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Начнём →' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить изменения. Попробуйте ещё раз.');
  expect(db.startTrial).not.toHaveBeenCalled(); expect(app.step).toBe('auth');
  vi.mocked(db.saveUserProfile).mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await waitFor(() => expect(app.step).toBe('daily'));
  expect(db.startTrial).toHaveBeenCalledTimes(1);
});

test('B2: calculation is a local preview, explicit sync saves the plan', async () => {
  localStorage.setItem('inga-app-state', JSON.stringify({ userId: 'A', profile: { age: 40, gender: 'female', height: 165, weight: 70, stepsPerDay: 5000 } }));
  render(<AppProvider><Probe /></AppProvider>);
  act(() => { app.runCalculations(); });
  expect(db.saveUserPlan).not.toHaveBeenCalled();
  await act(async () => { await app.syncToDb(); });
  expect(db.saveUserPlan).toHaveBeenCalledTimes(1);
});

test('B2: sync without a session fails instead of succeeding silently', async () => {
  render(<AppProvider><Probe /></AppProvider>); clearTokens();
  vi.mocked(db.isAuthenticated).mockResolvedValue(false);
  await expect(app.syncToDb()).rejects.toBeDefined();
  expect(db.saveUserProfile).not.toHaveBeenCalled();
});

test('B2: plan write failure blocks trial even after profile write succeeds', async () => {
  localStorage.setItem('inga-app-state', JSON.stringify({ userId: 'A', profile: { age: 40, gender: 'female', height: 165, weight: 70, stepsPerDay: 5000 } }));
  vi.mocked(db.saveUserPlan).mockRejectedValueOnce(new Error('plan 503')).mockResolvedValue(undefined);
  render(<AppProvider><Probe /><RouteReadyScreen /></AppProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Начнём →' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить изменения. Попробуйте ещё раз.');
  expect(db.startTrial).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await waitFor(() => expect(app.step).toBe('daily'));
  expect(db.saveUserPlan).toHaveBeenCalledTimes(2);
  expect(db.startTrial).toHaveBeenCalledTimes(1);
});

test('B2: successful final sync writes behavior and answers once', async () => {
  localStorage.setItem('inga-app-state', JSON.stringify({ userId: 'A', profile: { foodTestAnswers: [1, 2], foodProfile: { pattern: 'example' } } }));
  render(<AppProvider><Probe /><RouteReadyScreen /></AppProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Начнём →' }));
  await waitFor(() => expect(app.step).toBe('daily'));
  expect(db.saveAssessmentAnswers).toHaveBeenCalledTimes(1);
  expect(db.saveBehaviorProfile).toHaveBeenCalledTimes(1);
});

test('B2: access screen also blocks trial when final plan synchronization fails', async () => {
  localStorage.setItem('inga-app-state', JSON.stringify({ userId: 'A', profile: { age: 40, gender: 'female', height: 165, weight: 70, stepsPerDay: 5000, trackingMethod: 'plate' } }));
  vi.mocked(db.saveUserPlan).mockRejectedValueOnce(new Error('plan 503')).mockResolvedValue(undefined);
  render(<AppProvider><Probe /><AccessScreen onProfile={() => {}} /></AppProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Начать 7 бесплатных дней' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить изменения. Попробуйте ещё раз.');
  expect(beginTrial).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await waitFor(() => expect(beginTrial).toHaveBeenCalledTimes(1));
  expect(db.saveUserPlan).toHaveBeenCalledTimes(2);
});
