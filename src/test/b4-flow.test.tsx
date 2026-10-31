import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { UserProfile } from '@/lib/types';
import { AppProvider, useApp } from '@/context/AppContext';
import { setTokens } from '@/lib/auth-storage';
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
const low: Partial<UserProfile> = { name: 'Мария', gender: 'female', age: 60, height: 150, weight: 55, stepsPerDay: 3000, kgToLose: 5, goalWeight: 50, trackingMethod: 'plate' };
const aiNote = 'Отвечает ИИ-помощник. Он может ошибаться и не заменяет консультацию специалиста.';
function seed(profile = low, legacy = false) {
  const calculations = calculateAll(profile);
  if (legacy) { calculations.corridorMin = 850; calculations.corridorMax = 1050; }
  localStorage.setItem('inga-app-state', JSON.stringify({ userId: 'A', step: 'survey-data', profile: { ...profile, calorie_target: legacy ? 950 : undefined }, calculations }));
}
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  setTokens('A', 'RA', { id: 'A', user_id: 'A', email: 'a@b4.invalid', email_verified: true });
  seed();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
  vi.mocked(db.loadUserProfile).mockResolvedValue(low);
  vi.mocked(db.loadUserPlan).mockResolvedValue({ calorieTarget: 1250, corridorMin: 850, corridorMax: 1050, trackingMethod: 'plate' });
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
  vi.mocked(db.saveDailyCheckin).mockResolvedValue(undefined);
  vi.mocked(askInga).mockResolvedValue({ answer: 'Тестовый ответ', route: 'general' });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('B4: survey keeps the greeting, shows the replacement range, and saves its midpoint', async () => {
  render(<AppProvider><Probe /><SurveyDataScreen /></AppProvider>);
  expect(screen.getByText('Расскажите о себе — рассчитаю вашу личную норму калорий.')).toBeVisible();
  expect(screen.getByText('Расчётная калорийность для удержания веса')).toBeVisible();
  expect(screen.getByText('1000–1200 ккал')).toBeVisible();
  expect(screen.getByText('По расчёту получается низкое значение. Приложение рекомендует 1000–1200 ккал. Такой режим не предназначен для длительного применения. Перед началом проконсультируйтесь со специалистом, чтобы согласовать калорийность, состав рациона и продолжительность.')).toBeVisible();
  expect(screen.queryByText('950 ккал')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
  await waitFor(() => expect(app.step).toBe('tracking-method'));
  expect(db.saveUserProfile).toHaveBeenCalledWith(expect.objectContaining({ calorie_target: 1100, weight: 55 }));
});

test('B4: ordinary survey numbers and no extra applicability checkbox are retained', () => {
  seed({ ...low, age: 40, height: 165, weight: 70, stepsPerDay: 5000 });
  render(<AppProvider><SurveyDataScreen /></AppProvider>);
  expect(screen.getByText('1 150 ккал')).toBeVisible();
  expect(screen.queryByText(/По расчёту получается низкое/)).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

test('B4: old browser cache and saved server plan both receive the minimum rule without changing maintenance calories', async () => {
  seed(low, true);
  render(<AppProvider><Probe /></AppProvider>);
  expect(app.calculations?.corridorMin).toBe(1000);
  expect(app.calculations?.corridorMax).toBe(1200);
  await act(async () => { await app.hydrateFromDb(); });
  expect(app.calculations?.totalCalories).toBe(1250);
  expect(app.calculations?.deficit25).toBe(950);
  await act(async () => { await app.syncToDb(); });
  expect(db.saveUserPlan).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ corridorMin: 1000, corridorMax: 1200, totalCalories: 1250 }));
});

test('B4: route ready does not display an obsolete single 950 kcal target', async () => {
  seed(low, true);
  render(<AppProvider><RouteReadyScreen /></AppProvider>);
  expect(screen.getByText(/норма 1000–1200 ккал/)).toBeVisible();
  expect(screen.queryByText(/норма 950 ккал/)).not.toBeInTheDocument();
});

test('B4: profile does not display an obsolete single 950 kcal target', async () => {
  seed(low, true);
  localStorage.setItem('inga-menu-jump', JSON.stringify({ section: 'profile' }));
  render(<AppProvider><MenuScreen /></AppProvider>);
  expect(await screen.findByText('1000–1200 ккал/день')).toBeVisible();
  expect(screen.queryByText('950 ккал/день')).not.toBeInTheDocument();
});

test('B4: chat sends the new corridor and shows its AI note once across messages', async () => {
  seed(low, true);
  render(<AppProvider><ChatScreen /></AppProvider>);
  const input = screen.getByPlaceholderText('Напишите сообщение...');
  for (const message of ['Что приготовить?', 'Ещё вариант']) {
    fireEvent.change(input, { target: { value: message } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(input).not.toBeDisabled());
  }
  expect(askInga).toHaveBeenCalledTimes(2);
  expect(askInga).toHaveBeenLastCalledWith(expect.objectContaining({ userContext: expect.objectContaining({ deficitCorridor: { min: 1000, max: 1200 } }) }));
  expect(screen.getAllByText(aiNote)).toHaveLength(1);
});

test.each(['fixation', 'maintenance'] as const)('B4: chat does not pass a weight-loss corridor on %s', async stage => {
  seed({ ...low, currentStage: stage }, true);
  render(<AppProvider><ChatScreen /></AppProvider>);
  const input = screen.getByPlaceholderText('Напишите сообщение...');
  fireEvent.change(input, { target: { value: 'Что приготовить?' } });
  fireEvent.submit(input.closest('form')!);
  await waitFor(() => expect(askInga).toHaveBeenCalled());
  expect(askInga).toHaveBeenCalledWith(expect.objectContaining({ userContext: expect.objectContaining({ stage, deficitCorridor: undefined }) }));
});

test('B4: onboarding identifies the AI assistant without adding health questions', () => {
  render(<AppProvider><SurveyNameScreen /></AppProvider>);
  expect(screen.getByText('Привет! Я ИИ-помощник Инги')).toBeVisible();
  expect(screen.queryByText(/ваш персональный нутрициолог/)).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

test('B4: actual morning screen passes the maintenance stage and renders the measured interval', async () => {
  seed({ ...low, currentStage: 'maintenance', food_preferences: ['Десерты'] });
  const saved = JSON.parse(localStorage.getItem('inga-app-state')!);
  saved.weeklyData = [{ date: '2026-10-25', weight: 54 }];
  localStorage.setItem('inga-app-state', JSON.stringify(saved));
  render(<AppProvider><DailyScreen /></AppProvider>);
  const button = await screen.findByRole('button', { name: 'Сохранить →' });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.change(screen.getByPlaceholderText('70.5'), { target: { value: '49' } });
  await act(async () => { fireEvent.click(button); });
  // Existing navigation opens meals after the first saved check-in; return to its analysis.
  fireEvent.click(screen.getByRole('button', { name: '🌅 Утро' }));
  expect(await screen.findByText('Сейчас наша задача — сохранять достигнутый вес. Дальнейшее снижение не является целью.')).toBeVisible();
  expect(screen.getByText('С предыдущего измерения вес снизился на 5 кг.')).toBeVisible();
  expect(screen.getByText(/• за 6 дней:/)).toBeVisible();
  expect(screen.queryByText(/Это хороший темп/)).not.toBeInTheDocument();
  expect(db.saveDailyCheckin).toHaveBeenCalledWith('2026-10-31', 49, undefined, undefined, undefined);
});
