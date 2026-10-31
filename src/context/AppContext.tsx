import { currentSession, subscribe, sessionSnapshot, isSessionCurrent } from '@/lib/auth-storage';
import { useAchievements } from '@/lib/achievement-client';
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AppStep, UserProfile, Calculations, DailyReport, Medal, FixationAction } from '@/lib/types';
import { calculateAll, calculateCalorieCorridor, roundTo50 } from '@/lib/calculations';
import {
  saveFixationAction,
  saveUserProfile,
  saveUserPlan,
  saveAssessmentAnswers,
  saveBehaviorProfile,
  saveDailyCheckin,
  saveEveningReflection,
  loadUserProfile,
  loadUserPlan,
  loadBehaviorProfile,
  loadAssessmentAnswers,
  loadCheckins,
  logUserEvent,
  startTrial,
  requestConsultation,
} from '@/lib/db';

interface AppState {
  step: AppStep;
  profile: Partial<UserProfile>;
  calculations: Calculations | null;
  dailyReports: DailyReport[];
  weeklyData: { date: string; weight: number }[];
  medals: Medal[];
}

interface AppContextValue extends AppState {
  setStep: (step: AppStep) => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  runCalculations: () => Calculations;
  performFixationAction: (action: FixationAction) => Promise<void>;
  addDailyReport: (report: DailyReport) => void;
  addWeightEntry: (date: string, weight?: number, metrics?: {sleepHours?:number;stepsYesterday?:number;stoolYesterday?:boolean|null}) => Promise<void>;
  achievementStreak: number | null;
  uniqueRecipes: number | null;
  syncToDb: () => Promise<void>;
  hydrateFromDb: () => Promise<AppStep>;
  resetLocalState: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}

const STORAGE_KEY = 'inga-app-state';

function loadState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const userId = currentSession()?.user.id;
      if (!userId || (saved.userId !== undefined && saved.userId !== userId)) return {};
      return saved;
    }
  } catch {}
  return {};
}

function saveLocalState(state: AppState, userId: string | null) {
  if (!userId || currentSession()?.user.id !== userId) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, userId }));
  } catch {}
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [saved] = useState(loadState);
  const stateOwner = useRef(currentSession()?.user.id ?? null);
  const hydrationGeneration = useRef(0);
  const [step, setStep] = useState<AppStep>(saved.step || 'auth');
  const [profile, setProfile] = useState<Partial<UserProfile>>(saved.profile || {});
  const [calculations, setCalculations] = useState<Calculations | null>(() => {
    const calc = saved.calculations;
    if (!calc) return null;
    // Do not display a legacy low corridor before server hydration finishes.
    return Number.isFinite(calc.deficit25) && calc.deficit25 - 100 < 1000
      ? { ...calc, corridorMin: 1000, corridorMax: 1200 } : calc;
  });
  const [dailyReports, setDailyReports] = useState<DailyReport[]>(saved.dailyReports || []);
  const [weeklyData, setWeeklyData] = useState<{ date: string; weight: number }[]>(saved.weeklyData || []);
  const { medals, streakDays: achievementStreak, uniqueRecipes, reset: resetAchievements } = useAchievements();

  const state: AppState = { step, profile, calculations, dailyReports, weeklyData, medals };
  const stateRef = useRef(state);
  stateRef.current = state;
  const ownerId = stateOwner.current;

  // Save to localStorage on every change
  useEffect(() => {
    saveLocalState(state, ownerId);
  }, [step, profile, calculations, dailyReports, weeklyData, medals, ownerId]);

  // Extra safety: flush state to localStorage on tab hide / page unload
  // (iOS Safari may discard the page when screen locks)
  useEffect(() => {
    const flush = () => saveLocalState(state, ownerId);
    window.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  });

  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    const session = sessionSnapshot();
    if (!session.owner) throw new Error('account_changed');
    // Send only the edit; publish it locally only after the server confirms it.
    await saveUserProfile(data);
    if (!isSessionCurrent(session)) throw new Error('account_changed');
    const nextProfile = { ...stateRef.current.profile, ...data };
    stateRef.current = { ...stateRef.current, profile: nextProfile };
    setProfile(nextProfile);
  }, []);

  const performFixationAction = useCallback(async (action: FixationAction) => {
    const userId = currentSession()?.user.id;
    if (!userId) throw new Error('account_changed');
    try {
      const result = await saveFixationAction(action, profile.fixationProgress?.revision ?? 0);
      if (currentSession()?.user.id !== userId) throw new Error('account_changed');
      // State is updated only after the server commits. Never send another profile PUT.
      setProfile(prev => ({ ...prev, ...result }));
    } catch (error) {
      if (error instanceof Error && error.message === 'stale_fixation') {
        const fresh = await loadUserProfile();
        if (fresh && currentSession()?.user.id === userId) {
          const keys = ['fixationProgress', 'currentStage', 'goalReachedAt', 'fixationStartedAt',
            'maintenanceStartedAt', 'equilibriumCalories', 'currentFixationCalories',
            'fixationWeekNumber', 'lastCalorieIncreaseAt', 'goalWeight'] as const;
          setProfile(prev => ({ ...prev, ...Object.fromEntries(keys.map(key => [key, fresh[key]])) }));
        }
      }
      throw error;
    }
  }, [profile.fixationProgress?.revision]);

  const runCalculations = useCallback(() => {
    const calc = calculateAll(stateRef.current.profile);
    stateRef.current = { ...stateRef.current, calculations: calc };
    setCalculations(calc);
    // This is a preview. syncToDb explicitly persists it before starting the trial.
    return calc;
  }, [profile]);

  const addDailyReport = useCallback((report: DailyReport) => {
    setDailyReports(prev => [...prev, report]);

    // Weight is saved explicitly in the morning, never replayed by the evening report.
    if (report.sleepHours != null || report.stepsYesterday != null || report.stoolYesterday != null) {
      saveDailyCheckin(report.date, undefined, report.sleepHours, report.stepsYesterday, report.stoolYesterday).catch(() => {});
    }
    // Meals are already persisted by DailyScreen.addMealEntry.
    // Saving a report must not create or overwrite food logs.
    if (report.eveningEmotion || report.hungerLevel || report.hardestPart || report.dayWin || report.sweetPointDone !== undefined) {
      saveEveningReflection(report.date, report.eveningEmotion, report.hungerLevel, report.hardestPart, report.sweetPointDone ?? null, report.dayWin).catch(() => {});
    }

  }, []);

  const addWeightEntry = useCallback(async (date: string, weight?: number, metrics?: {sleepHours?:number;stepsYesterday?:number;stoolYesterday?:boolean|null}) => {
    const userId = currentSession()?.user.id;
    if (!userId) throw new Error('account_changed');
    await saveDailyCheckin(date, weight, metrics?.sleepHours, metrics?.stepsYesterday, metrics?.stoolYesterday);
    if (currentSession()?.user.id !== userId) throw new Error('account_changed');
    if (weight != null) setWeeklyData(prev => [...prev.filter(entry => entry.date !== date), { date, weight }]);
  }, []);

  // Full sync to DB (called manually or on key events)
  const syncToDb = useCallback(async () => {
    const session = sessionSnapshot();
    const check = () => {
      if (!session.owner || !isSessionCurrent(session)) throw new Error('account_changed');
    };
    check();
    const { profile: currentProfile, calculations: currentCalculations } = stateRef.current;
    await saveUserProfile(currentProfile);
    check();
    // RouteReady's effect may not have rendered its preview yet.
    const plan = currentCalculations || (currentProfile.height && currentProfile.weight && currentProfile.age
      ? calculateAll(currentProfile) : null);
    if (plan) {
      await saveUserPlan(currentProfile, plan);
      check();
    }
    if (currentProfile.foodTestAnswers) {
      await saveAssessmentAnswers(currentProfile.foodTestAnswers);
      check();
    }
    if (currentProfile.foodProfile) {
      await saveBehaviorProfile(currentProfile.foodProfile);
      check();
    }
  }, []);

  // Hydrate state from DB after auth (essential for cross-domain login where localStorage is empty)
  // Полный сброс локального состояния. Нужен при регистрации нового аккаунта:
  // иначе профиль предыдущего пользователя остаётся в localStorage, подмешивается
  // в hydrateFromDb и новичок проскакивает онбординг сразу в дневник.
  const resetLocalState = useCallback(() => {
    hydrationGeneration.current++;
    stateOwner.current = currentSession()?.user.id ?? null;
    // Reset the live snapshot too: an auth callback may still hold an old hydrate function.
    stateRef.current = { ...stateRef.current, profile: {}, calculations: null, dailyReports: [], weeklyData: [], medals: [] };
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setProfile({});
    setCalculations(null);
    setDailyReports([]);
    setWeeklyData([]);
    resetAchievements();
  }, [resetAchievements]);

  useEffect(() => subscribe((_event, session) => {
    if ((session?.user.id ?? null) !== stateOwner.current) {
      resetLocalState();
      if (!session) setStep('auth');
    }
  }), [resetLocalState]);

  useEffect(() => () => { hydrationGeneration.current++; }, []);

  const hydrateFromDb = useCallback(async (): Promise<AppStep> => {
    const userId = currentSession()?.user.id;
    if (!userId) return 'auth';
    const generation = ++hydrationGeneration.current;

    const [dbProfile, dbPlan, dbBehavior, dbAnswers, dbCheckins] = await Promise.all([
      loadUserProfile({ strict: true }),
      loadUserPlan({ strict: true }),
      loadBehaviorProfile({ strict: true }),
      loadAssessmentAnswers({ strict: true }),
      loadCheckins({ strict: true }),
    ]);

    if (currentSession()?.user.id !== userId || generation !== hydrationGeneration.current) return 'auth';
    // A failed profile read must not be interpreted as a new account or a reset stage.
    if (!dbProfile) throw new Error('profile_load_failed');

    const sameAccount = stateOwner.current === userId;
    const localProfile = sameAccount ? stateRef.current.profile : {};
    const stageKeys = ['goalReachedAt', 'fixationStartedAt', 'maintenanceStartedAt',
      'equilibriumCalories', 'currentFixationCalories', 'fixationWeekNumber', 'lastCalorieIncreaseAt'] as const;

    const merged: Partial<UserProfile> = {
      ...localProfile,
      ...dbProfile,
      // JSON omits undefined server fields. Clear old stage dates explicitly.
      ...Object.fromEntries(stageKeys.map(key => [key, dbProfile[key]])),
      currentStage: dbProfile.currentStage ?? 'loss',
      fixationProgress: dbProfile.fixationProgress ?? null,
      goalWeight: dbProfile.goalWeight,
      goal_weight_kg: dbProfile.goalWeight,
      // A loaded profile is authoritative, including an absent sex.
      ...(dbProfile ? { gender: dbProfile.gender === 'male' || dbProfile.gender === 'female' ? dbProfile.gender : undefined } : {}),
      ...(dbPlan?.paceChoice ? { paceChoice: dbPlan.paceChoice } : {}),
      ...(dbPlan?.trackingMethod ? { trackingMethod: dbPlan.trackingMethod } : {}),
      ...(dbBehavior ? { foodProfile: dbBehavior } : {}),
      ...(dbAnswers ? { foodTestAnswers: dbAnswers } : {}),
    };
    stateOwner.current = userId;
    if (!sameAccount) {
      setDailyReports([]);
      resetAchievements();
    }
    setProfile(merged);
    setWeeklyData(dbCheckins);
    setCalculations(null);

    // Require an explicit saved choice before resuming onboarding or the diary.
    if (merged.gender !== 'male' && merged.gender !== 'female') {
      setCalculations(null);
      setStep('survey-name');
      return 'survey-name';
    }

    if (merged.height && merged.weight && merged.age) {
      const calc = calculateAll(merged);
      // Apply the same corridor rule to a saved maintenance-calorie plan.
      if (dbPlan?.calorieTarget) {
        calc.totalCalories = roundTo50(dbPlan.calorieTarget);
        Object.assign(calc, calculateCalorieCorridor(dbPlan.calorieTarget));
      }
      setCalculations(calc);
    }

    // Пользователь с чек-инами уже прошёл онбординг
    if (dbCheckins.length > 0) {
      setStep('daily');
      return 'daily';
    }


    // Determine resume step based on data completeness.
    const resume = (() => {
      if (!merged.name) return 'survey-name';
      if (merged.trackingMethod) return 'daily';
      const hasGoal = !!(merged.goal_weight_kg || merged.goalWeight);
      const hasSurveyData = !!(merged.age && merged.height && merged.weight);
      // If the user already has goal + full survey data saved in DB,
      // onboarding is effectively done — only the tracking method is missing.
      if (hasGoal && hasSurveyData) return 'tracking-method';
      // The kilogram goal is saved before the body measurements and target weight.
      const hasKilogramGoal = typeof merged.kgToLose === 'number'
        && Number.isFinite(merged.kgToLose) && merged.kgToLose > 0;
      if (!hasGoal && !hasKilogramGoal) return 'goal';
      if (!hasSurveyData) return 'survey-data';
      return 'tracking-method';
    })() as AppStep;

    setStep(resume);
    return resume;
  }, [resetAchievements]);

  return (
    <AppContext.Provider
      value={{
        step, setStep,
        profile, updateProfile, performFixationAction,
        calculations, runCalculations,
        dailyReports, addDailyReport,
        weeklyData, addWeightEntry,
        medals, achievementStreak, uniqueRecipes,
        syncToDb,
        hydrateFromDb,
        resetLocalState,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
