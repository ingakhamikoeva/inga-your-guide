import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppStep, UserProfile, Calculations, DailyReport, Medal } from '@/lib/types';
import { calculateAll, roundTo50 } from '@/lib/calculations';
import {
  isAuthenticated,
  saveUserProfile,
  saveUserPlan,
  saveAssessmentAnswers,
  saveBehaviorProfile,
  saveDailyCheckin,
  saveEveningReflection,
  saveFoodLog,
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
  updateProfile: (data: Partial<UserProfile>) => void;
  runCalculations: () => Calculations;
  addDailyReport: (report: DailyReport) => void;
  addWeightEntry: (date: string, weight: number) => void;
  addAwardedMedal: (medal: Medal) => void;
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
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveLocalState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const saved = loadState();
  const [step, setStep] = useState<AppStep>(saved.step || 'auth');
  const [profile, setProfile] = useState<Partial<UserProfile>>(saved.profile || {});
  const [calculations, setCalculations] = useState<Calculations | null>(saved.calculations || null);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>(saved.dailyReports || []);
  const [weeklyData, setWeeklyData] = useState<{ date: string; weight: number }[]>(saved.weeklyData || []);
  const [medals, setMedals] = useState<Medal[]>(saved.medals || []);

  const state: AppState = { step, profile, calculations, dailyReports, weeklyData, medals };

  // Save to localStorage on every change
  useEffect(() => {
    saveLocalState(state);
  }, [step, profile, calculations, dailyReports, weeklyData, medals]);

  // Extra safety: flush state to localStorage on tab hide / page unload
  // (iOS Safari may discard the page when screen locks)
  useEffect(() => {
    const flush = () => saveLocalState(state);
    window.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  });

  const updateProfile = useCallback((data: Partial<UserProfile>) => {
    setProfile(prev => {
      const updated = { ...prev, ...data };
      // Async DB sync — fire and forget
      saveUserProfile(updated).catch(() => {});
      return updated;
    });
  }, []);

  const runCalculations = useCallback(() => {
    const calc = calculateAll(profile);
    setCalculations(calc);
    // Sync plan to DB
    saveUserPlan(profile, calc).catch(() => {});
    return calc;
  }, [profile]);

  const addDailyReport = useCallback((report: DailyReport) => {
    setDailyReports(prev => [...prev, report]);

    // Sync to DB
    if (report.weight || report.sleepHours || report.stepsYesterday) {
      saveDailyCheckin(report.date, report.weight, report.sleepHours, report.stepsYesterday, report.stoolYesterday).catch(() => {});
    }
    if (report.meals.length > 0) {
      report.meals.forEach(m => {
        saveFoodLog(m.description, m.type).catch(() => {});
      });
    }
    if (report.eveningEmotion || report.hungerLevel || report.hardestPart || report.dayWin || report.sweetPointDone !== undefined) {
      saveEveningReflection(report.date, report.eveningEmotion, report.hungerLevel, report.hardestPart, report.sweetPointDone ?? null, report.dayWin).catch(() => {});
    }

  }, []);

  const addWeightEntry = useCallback((date: string, weight: number) => {
    setWeeklyData(prev => [...prev, { date, weight }]);
    saveDailyCheckin(date, weight).catch(() => {});
  }, []);

  const addAwardedMedal = useCallback((medal: Medal) => {
    setMedals(prev => prev.some(m => m.weekKey === medal.weekKey) ? prev : [...prev, medal]);
  }, []);

  // Full sync to DB (called manually or on key events)
  const syncToDb = useCallback(async () => {
    const authed = await isAuthenticated();
    if (!authed) return;

    await saveUserProfile(profile);
    if (calculations) {
      await saveUserPlan(profile, calculations);
    }
    if (profile.foodTestAnswers) {
      await saveAssessmentAnswers(profile.foodTestAnswers);
    }
    if (profile.foodProfile) {
      await saveBehaviorProfile(profile.foodProfile);
    }
  }, [profile, calculations]);

  // Hydrate state from DB after auth (essential for cross-domain login where localStorage is empty)
  // Полный сброс локального состояния. Нужен при регистрации нового аккаунта:
  // иначе профиль предыдущего пользователя остаётся в localStorage, подмешивается
  // в hydrateFromDb и новичок проскакивает онбординг сразу в дневник.
  const resetLocalState = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setProfile({});
    setCalculations(null);
    setDailyReports([]);
    setWeeklyData([]);
    setMedals([]);
  }, []);

  const hydrateFromDb = useCallback(async (): Promise<AppStep> => {
    const authed = await isAuthenticated();
    if (!authed) return 'auth';

    const [dbProfile, dbPlan, dbBehavior, dbAnswers, dbCheckins] = await Promise.all([
      loadUserProfile(),
      loadUserPlan(),
      loadBehaviorProfile(),
      loadAssessmentAnswers(),
      loadCheckins(),
    ]);

    const merged: Partial<UserProfile> = {
      ...profile,
      ...(dbProfile ?? {}),
      ...(dbPlan?.paceChoice ? { paceChoice: dbPlan.paceChoice } : {}),
      ...(dbPlan?.trackingMethod ? { trackingMethod: dbPlan.trackingMethod } : {}),
      ...(dbBehavior ? { foodProfile: dbBehavior } : {}),
      ...(dbAnswers ? { foodTestAnswers: dbAnswers } : {}),
    };
    setProfile(merged);

    let calc = calculations;
    if (merged.height && merged.weight && merged.age) {
      calc = calculateAll(merged);
      // Если калорийность удержания задана вручную в плане — пересчитываем
      // от неё, чтобы коридор остался дефицитом 25% ±100, а не разъехался.
      if (dbPlan?.calorieTarget) {
        calc.totalCalories = roundTo50(dbPlan.calorieTarget);
        calc.deficit25 = roundTo50(dbPlan.calorieTarget * 0.75);
        calc.corridorMin = calc.deficit25 - 100;
        calc.corridorMax = calc.deficit25 + 100;
      }
      setCalculations(calc);
    }

    if (dbCheckins.length > 0) setWeeklyData(dbCheckins);

    // Пользователь с чек-инами уже прошёл онбординг
    if (dbCheckins.length > 0) {
      setStep('daily');
      return 'daily';
    }


    // Determine resume step based on data completeness.
    // NB: motivation/kgToLose are not persisted in DB, so we must NOT gate
    // resume on them — otherwise every returning user on a fresh device
    // gets bounced back to the "why" screen.
    const resume = (() => {
      if (!merged.name) return 'survey-name';
      if (merged.trackingMethod) return 'daily';
      const hasGoal = !!(merged.goal_weight_kg || merged.goalWeight);
      const hasSurveyData = !!(merged.age && merged.height && merged.weight);
      // If the user already has goal + full survey data saved in DB,
      // onboarding is effectively done — only the tracking method is missing.
      if (hasGoal && hasSurveyData) return 'tracking-method';
      if (!hasGoal) return 'goal';
      if (!merged.motivation?.length) return 'why';
      if (!hasSurveyData) return 'survey-data';
      return 'tracking-method';
    })() as AppStep;

    setStep(resume);
    return resume;
  }, [profile, calculations]);

  return (
    <AppContext.Provider
      value={{
        step, setStep,
        profile, updateProfile,
        calculations, runCalculations,
        dailyReports, addDailyReport,
        weeklyData, addWeightEntry,
        medals, addAwardedMedal,
        syncToDb,
        hydrateFromDb,
        resetLocalState,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
