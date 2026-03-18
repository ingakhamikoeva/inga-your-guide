import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppStep, UserProfile, Calculations, DailyReport } from '@/lib/types';
import { calculateAll, getCorridorForPace } from '@/lib/calculations';

interface AppState {
  step: AppStep;
  profile: Partial<UserProfile>;
  calculations: Calculations | null;
  dailyReports: DailyReport[];
  weeklyData: { date: string; weight: number }[];
}

interface AppContextValue extends AppState {
  setStep: (step: AppStep) => void;
  updateProfile: (data: Partial<UserProfile>) => void;
  runCalculations: () => Calculations;
  addDailyReport: (report: DailyReport) => void;
  addWeightEntry: (date: string, weight: number) => void;
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

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const saved = loadState();
  const [step, setStep] = useState<AppStep>(saved.step || 'welcome');
  const [profile, setProfile] = useState<Partial<UserProfile>>(saved.profile || {});
  const [calculations, setCalculations] = useState<Calculations | null>(saved.calculations || null);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>(saved.dailyReports || []);
  const [weeklyData, setWeeklyData] = useState<{ date: string; weight: number }[]>(saved.weeklyData || []);

  const state: AppState = { step, profile, calculations, dailyReports, weeklyData };

  useEffect(() => {
    saveState(state);
  }, [step, profile, calculations, dailyReports, weeklyData]);

  const updateProfile = useCallback((data: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...data }));
  }, []);

  const runCalculations = useCallback(() => {
    const calc = calculateAll(profile);
    if (profile.paceChoice) {
      const corridor = getCorridorForPace(calc.totalCalories, profile.paceChoice);
      calc.corridorMin = corridor.corridorMin;
      calc.corridorMax = corridor.corridorMax;
    }
    setCalculations(calc);
    return calc;
  }, [profile]);

  const addDailyReport = useCallback((report: DailyReport) => {
    setDailyReports(prev => [...prev, report]);
  }, []);

  const addWeightEntry = useCallback((date: string, weight: number) => {
    setWeeklyData(prev => [...prev, { date, weight }]);
  }, []);

  return (
    <AppContext.Provider
      value={{
        step, setStep,
        profile, updateProfile,
        calculations, runCalculations,
        dailyReports, addDailyReport,
        weeklyData, addWeightEntry,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
