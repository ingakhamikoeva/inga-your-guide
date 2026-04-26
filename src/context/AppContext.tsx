import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppStep, UserProfile, Calculations, DailyReport, Medal } from '@/lib/types';
import { calculateAll, getCorridorForPace } from '@/lib/calculations';
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
    if (profile.paceChoice) {
      const corridor = getCorridorForPace(calc.totalCalories, profile.paceChoice);
      calc.corridorMin = corridor.corridorMin;
      calc.corridorMax = corridor.corridorMax;
    }
    setCalculations(calc);
    // Sync plan to DB
    saveUserPlan(profile, calc).catch(() => {});
    return calc;
  }, [profile]);

  const addDailyReport = useCallback((report: DailyReport) => {
    setDailyReports(prev => [...prev, report]);

    // Sync to DB
    if (report.weight || report.sleepHours || report.stepsYesterday) {
      saveDailyCheckin(report.date, report.weight, report.sleepHours, report.stepsYesterday).catch(() => {});
    }
    if (report.meals.length > 0) {
      report.meals.forEach(m => {
        saveFoodLog(m.description, m.type).catch(() => {});
      });
    }
    if (report.eveningEmotion || report.hungerLevel || report.hardestPart) {
      saveEveningReflection(report.date, report.eveningEmotion, report.hungerLevel, report.hardestPart).catch(() => {});
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
