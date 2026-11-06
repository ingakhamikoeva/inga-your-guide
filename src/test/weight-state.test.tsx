import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { UserProfile } from '@/lib/types';
import { AppProvider, useApp } from '@/context/AppContext';
import { setTokens, clearTokens, notifyAuthChange } from '@/lib/auth-storage';
import { calculateAll } from '@/lib/calculations';
import { SurveyDataScreen } from '@/components/inga/SurveyDataScreen';
import { SurveyNameScreen } from '@/components/inga/SurveyNameScreen';
import { RouteReadyScreen } from '@/components/inga/RouteReadyScreen';
import { ChatScreen } from '@/components/inga/ChatScreen';
import { MenuScreen } from '@/components/inga/MenuScreen';
import { DailyScreen } from '@/components/inga/DailyScreen';
import * as db from '@/lib/db';
import { askInga } from '@/lib/ai-provider';

vi.mock('@/lib/achievement-client', () => ({ localDay: () => '2026-10-31', deviceTimezone: () => 'Europe/Moscow', useAchievements: () => ({ medals: [], streakDays: 0, uniqueRecipes: 0, reset: resetAchievements }) }));
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: () => ({ access: { active: true }, refresh: async () => null }) }));
vi.mock('@/components/inga/VoiceInput', () => ({ VoiceInput: () => null }));
vi.mock('@/components/inga/ProgressPhotosSection', () => ({ ProgressPhotosSection: () => null }));
vi.mock('@/lib/app-settings', () => ({ getSetting: async () => null }));
vi.mock('@/lib/ai-provider', () => ({ askInga: vi.fn(), classifyRoute: () => 'general' }));
vi.mock('@/lib/nutrition/use-meal-diary', () => ({ useMealDiary: () => ({ meals: [], mealMeta: [], loading: false, pending: 0, analysisLimit: false }) }));
vi.mock('@/lib/db', () => ({
  saveUserProfile: vi.fn(), saveUserPlan: vi.fn(), saveAssessmentAnswers: vi.fn(), saveBehaviorProfile: vi.fn(),
  startTrial: vi.fn(), logUserEvent: vi.fn(), loadUserProfile: vi.fn(), loadUserPlan: vi.fn(),
  loadBehaviorProfile: vi.fn(), loadAssessmentAnswers: vi.fn(), loadCheckins: vi.fn(),
  saveFixationAction: vi.fn(), saveDailyCheckin: vi.fn(), saveEveningReflection: vi.fn(), requestConsultation: vi.fn(), saveChatEvent: vi.fn(),
  loadProgramProgress: vi.fn(), loadTodayCheckin: vi.fn(), loadMealPlanForDate: vi.fn(), loadLightSavings: vi.fn(), saveMealPlan: vi.fn(),
}));
const resetAchievements = () => {};
let app: ReturnType<typeof useApp>;
function Probe() { app = useApp(); return null; }

const base: Partial<UserProfile> = { name: 'Мария', gender: 'female', age: 50, height: 160, weight: 60, startWeight: 60,
  stepsPerDay: 5000, goalWeight: 55, trackingMethod: 'plate', currentStage: 'loss' };
const plan = { calorieTarget: 1900, corridorMin: 1500, corridorMax: 1650 };
function seed() {
  localStorage.setItem('inga-app-state', JSON.stringify({ userId: 'A', step: 'daily', profile: base,
    calculations: { ...calculateAll(base), totalCalories: 1900, deficit25: 1450, corridorMin: 1500, corridorMax: 1650 }, weeklyData: [] }));
}
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  setTokens('A', 'RA', { id: 'A', user_id: 'A', email: 'a@i3.invalid', email_verified: true });
  seed();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
  vi.mocked(db.loadUserProfile).mockResolvedValue(base);
  vi.mocked(db.loadUserPlan).mockResolvedValue(plan);
  vi.mocked(db.loadBehaviorProfile).mockResolvedValue(null);
  vi.mocked(db.loadAssessmentAnswers).mockResolvedValue(null);
  vi.mocked(db.loadCheckins).mockResolvedValue([]);
  vi.mocked(db.saveUserProfile).mockResolvedValue(undefined);
  vi.mocked(db.saveUserPlan).mockResolvedValue(undefined);
  vi.mocked(db.logUserEvent).mockResolvedValue(undefined);
  vi.mocked(db.saveChatEvent).mockResolvedValue(undefined);
  vi.mocked(db.loadProgramProgress).mockResolvedValue(null);
  vi.mocked(db.loadTodayCheckin).mockResolvedValue(null);
  vi.mocked(db.loadMealPlanForDate).mockResolvedValue(null);
  vi.mocked(db.loadLightSavings).mockResolvedValue(null);
  vi.mocked(askInga).mockResolvedValue({ answer: 'Тестовый ответ', route: 'general', ok: true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('I3: confirmed morning weight refreshes BMI and chat, preserving saved calorie bounds', async () => {
  vi.mocked(db.saveDailyCheckin).mockResolvedValue({ weight: 58.3, startWeight: 60, weightDate: '2026-11-06' });
  render(<AppProvider><Probe /><ChatScreen /></AppProvider>);
  await act(async () => { await app.addWeightEntry('2026-11-06', 58.3); });
  expect(app.profile.weight).toBe(58.3); expect(app.profile.startWeight).toBe(60);
  expect(app.calculations?.bmi).toBe(22.8); expect(app.calculations?.bmr).toBe(calculateAll({...base,weight:58.3}).bmr);
  expect(app.calculations).toMatchObject({totalCalories:1900,corridorMin:1500,corridorMax:1650});
  expect(db.saveUserPlan).not.toHaveBeenCalled(); expect(db.saveUserProfile).not.toHaveBeenCalled();
  const input = screen.getByPlaceholderText('Напишите сообщение...');
  fireEvent.change(input, {target:{value:'Какой у меня вес?'}}); fireEvent.submit(input.closest('form')!);
  await waitFor(()=>expect(askInga).toHaveBeenCalled());
  expect(vi.mocked(askInga).mock.calls[0][0].userContext).toMatchObject({weight:58.3,deficitCorridor:{min:1500,max:1650}});
});

test('I3: loading profile displays separate starting, current and goal weights and correct progress', async () => {
  vi.mocked(db.loadUserProfile).mockResolvedValue({...base,weight:58.3,startWeight:60,weightDate:'2026-11-06'});
  vi.mocked(db.loadCheckins).mockResolvedValue([{date:'2026-11-06',weight:58.3}]);
  localStorage.setItem('inga-menu-jump', JSON.stringify({section:'profile'}));
  render(<AppProvider><Probe /><MenuScreen /></AppProvider>);
  await act(async()=>{await app.hydrateFromDb();});
  expect(app.profile.weight).toBe(58.3); expect(app.profile.startWeight).toBe(60);
  expect(await screen.findByText('60 кг')).toBeVisible();
  expect(screen.getByText('58.3 кг')).toBeVisible();
  expect(screen.getByText('55 кг')).toBeVisible();
  expect(screen.getByText(/1.7 кг/)).toBeVisible();
  expect(app.calculations).toMatchObject({totalCalories:1900,corridorMin:1500,corridorMax:1650,bmi:22.8});
});

test('I3: old-date corrections and metric-only writes retain server-confirmed latest weight', async () => {
  vi.mocked(db.saveDailyCheckin).mockResolvedValue({weight:58.3,startWeight:60,weightDate:'2026-11-06'});
  render(<AppProvider><Probe /></AppProvider>);
  await act(async()=>{await app.addWeightEntry('2026-11-06',58.3);});
  await act(async()=>{await app.addWeightEntry('2026-11-01',59.5);});
  expect(app.profile.weight).toBe(58.3);
  expect(app.weeklyData).toEqual([{date:'2026-11-01',weight:59.5},{date:'2026-11-06',weight:58.3}]);
  vi.mocked(db.saveDailyCheckin).mockResolvedValue(undefined);
  await act(async()=>{await app.addWeightEntry('2026-11-06',undefined,{sleepHours:0});});
  expect(app.profile.weight).toBe(58.3); expect(app.profile.startWeight).toBe(60);
});

test('I3: failed save leaves weight, measurements and calculations unchanged; retry publishes confirmation', async () => {
  vi.mocked(db.saveDailyCheckin).mockRejectedValueOnce(new Error('503'))
    .mockResolvedValueOnce({weight:58.3,startWeight:60,weightDate:'2026-11-06'});
  render(<AppProvider><Probe /></AppProvider>);
  const before = app.calculations;
  await act(async()=>{await expect(app.addWeightEntry('2026-11-06',58.3)).rejects.toThrow('503');});
  expect(app.profile.weight).toBe(60); expect(app.weeklyData).toEqual([]); expect(app.calculations).toBe(before);
  await act(async()=>{await app.addWeightEntry('2026-11-06',58.3);});
  expect(app.profile.weight).toBe(58.3);
});

test('I3: a late weight response cannot enter a new session even when the account ID is the same', async () => {
  let resolve!: (value: db.WeightState) => void;
  vi.mocked(db.saveDailyCheckin).mockReturnValue(new Promise(r=>{resolve=r;}));
  render(<AppProvider><Probe /></AppProvider>);
  let pending: Promise<unknown>;
  act(()=>{pending=app.addWeightEntry('2026-11-06',58.3).catch(e=>e);});
  act(()=>{clearTokens(); notifyAuthChange('SIGNED_OUT'); setTokens('A2','RA2',{id:'A',user_id:'A',email:'a@i3.invalid'}); notifyAuthChange('SIGNED_IN');});
  await act(async()=>{resolve({weight:58.3,startWeight:60,weightDate:'2026-11-06'}); await pending;});
  expect(app.profile.weight).toBeUndefined(); expect(app.weeklyData).toEqual([]);
});

test('I3: explicit profile edit uses authoritative weight and refreshes diary without changing start/stage', async () => {
  vi.mocked(db.saveUserProfile).mockResolvedValue({weight:58.1,startWeight:60,weightDate:'2026-11-06'});
  render(<AppProvider><Probe /></AppProvider>);
  await act(async()=>{await app.updateProfile({weight:58.1});});
  expect(app.profile).toMatchObject({weight:58.1,startWeight:60,currentStage:'loss'});
  expect(app.weeklyData).toEqual([{date:'2026-11-06',weight:58.1}]);
  expect(app.calculations).toMatchObject({totalCalories:1900,corridorMin:1500,corridorMax:1650});
  await act(async()=>{await app.syncToDb();});
  expect(db.saveUserProfile).toHaveBeenLastCalledWith(expect.anything(),{recordWeight:false});
});
