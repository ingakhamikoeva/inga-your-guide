import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { getText } from '@/lib/gender-text';
import { analyzeDailyNutrition } from '@/lib/daily-analysis';
import { analyzeMorningWeight, MorningWeightAnalysis } from '@/lib/morning-analysis';
import { buildGamificationSummary, getMedalStyle } from '@/lib/gamification';
import { Medal } from '@/lib/types';
import { withName, hasName } from '@/lib/user-name';
import { VoiceInput } from './VoiceInput';
import { saveMealPlan, loadMealPlanForDate, saveDailyCheckin, saveFoodLog, loadFoodLogs, updateFoodLog, deleteFoodLog, loadTodayCheckin, type MealTag } from '@/lib/db';
import { resolveMealNutrition } from '@/lib/nutrition/food-lookup';
import { DailySummaryCard } from './DailySummaryCard';
import { GoalReachedModal } from './GoalReachedModal';
import { FixationCompleteModal } from './FixationCompleteModal';
import { hasReachedGoal, corridorStatus } from '@/lib/soft-swap';
import ingaPhoto from '@/assets/inga-photo.jpg';

const FOOD_PREFERENCE_OPTIONS = [
  { emoji: '🥞', label: 'Блины и сырники' },
  { emoji: '🍰', label: 'Десерты' },
  { emoji: '🥐', label: 'Несладкая выпечка' },
  { emoji: '🍝', label: 'Паста и каши' },
  { emoji: '🥗', label: 'Салаты с майонезом' },
  { emoji: '🍖', label: 'Жирные вторые блюда' },
  { emoji: '🌙', label: 'Вечерние перекусы' },
  { emoji: '🧃', label: 'Сладкие напитки' },
];

const PLANNING_INTRO_KEY = 'meal_planning_intro_shown';


type DailyTab = 'morning' | 'meals' | 'evening';

export function DailyScreen() {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const { setStep, addDailyReport, addWeightEntry, addAwardedMedal, profile, calculations, weeklyData, dailyReports, medals, updateProfile } = useApp();
  const [tab, setTab] = useState<DailyTab>(() => {
    try {
      const savedDate = localStorage.getItem('dailyActiveTabDate');
      const savedTab = localStorage.getItem('dailyActiveTab') as DailyTab | null;
      if (savedDate === today && savedTab && ['morning', 'meals', 'evening'].includes(savedTab)) {
        return savedTab;
      }
    } catch {}
    return 'morning';
  });
  const [weight, setWeight] = useState('');
  const [sleep, setSleep] = useState('');
  const [steps, setSteps] = useState('');
  const [mealText, setMealText] = useState('');
  const nowHHMM = () => {
    const n = new Date();
    return `${n.getHours().toString().padStart(2, '0')}:${n.getMinutes().toString().padStart(2, '0')}`;
  };
  const [mealTime, setMealTime] = useState<string>(nowHHMM());
  const [editingTimeIdx, setEditingTimeIdx] = useState<number | null>(null);
  const [editingProteinIdx, setEditingProteinIdx] = useState<number | null>(null);
  const [editingProteinValue, setEditingProteinValue] = useState('');
  const [meals, setMeals] = useState<string[]>([]);
  type ProteinPortion = 'small' | 'palm' | 'large';
  type MealMeta = {
    id?: string;
    protein: boolean; carbs: boolean; fiber: boolean; sweet: boolean;
    time: string; name: string; isEvening: boolean; proteinPortion: ProteinPortion;
    proteinAi: number | null; proteinLoading: boolean; proteinManual: boolean;
  };
  const [mealMeta, setMealMeta] = useState<MealMeta[]>([]);
  const [waterCount, setWaterCount] = useState(0);
  const [showMealInput, setShowMealInput] = useState(false);
  const [showEveningInput, setShowEveningInput] = useState(false);
  const [eveningText, setEveningText] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [emotion, setEmotion] = useState('');
  const [hunger, setHunger] = useState(3);
  const [hardest, setHardest] = useState('');
  const [dayWin, setDayWin] = useState('');
  const [sweetPoint, setSweetPoint] = useState<'yes' | 'no' | ''>('');

  const [saved, setSaved] = useState(false);
  const [morningAnalysis, setMorningAnalysis] = useState<MorningWeightAnalysis | null>(null);
  const [awardedMedal, setAwardedMedal] = useState<Medal | null>(null);
  const [showGoalReached, setShowGoalReached] = useState(false);
  const [showFixationDone, setShowFixationDone] = useState(false);
  const [showPlanning, setShowPlanning] = useState(false);
  const [planText, setPlanText] = useState('');
  const [planSavedMessage, setPlanSavedMessage] = useState(false);
  const [yesterdayPlan, setYesterdayPlan] = useState<string | null>(null);
  const [selectedFoods, setSelectedFoods] = useState<string[]>([]);
  const [foodSurveyAnswered, setFoodSurveyAnswered] = useState(false);
  const [showMorningCheckin, setShowMorningCheckin] = useState(false);
  const analysis = analyzeDailyNutrition(meals, profile.gender);

  // Persist active tab (and current date) so reloading restores it, but reset on a new day
  useEffect(() => {
    try {
      localStorage.setItem('dailyActiveTab', tab);
      localStorage.setItem('dailyActiveTabDate', today);
    } catch {}
  }, [tab, today]);

  // Russian date string: "Пятница, 13 июня"
  const dateLabel = (() => {
    const raw = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();
  const dayNumber = (dailyReports?.length ?? 0) + 1;

  const showFoodSurvey = !foodSurveyAnswered && (!profile.food_preferences || profile.food_preferences.length === 0) && weeklyData.length === 0;
  const showCheckinFields = !showFoodSurvey || showMorningCheckin;

  type StoredMeal = {
    id?: string;
    text?: string;
    raw_text?: string;
    description?: string;
    protein?: boolean;
    carbs?: boolean;
    fiber?: boolean;
    sweet?: boolean;
    time?: string;
    name?: string;
    isEvening?: boolean;
    proteinPortion?: ProteinPortion;
    proteinAi?: number | null;
    proteinLoading?: boolean;
    proteinManual?: boolean;
  };

  const morningStorageKey = () => `morning_${new Date().toDateString()}`;
  const mealsStorageKey = () => `meals_${new Date().toDateString()}`;

  const storedMealNameByTime = (time: string, isEvening = false) => {
    if (isEvening) return 'Вечерний перекус';
    const h = parseInt(time.split(':')[0] || '0', 10);
    if (h >= 6 && h < 10) return 'Завтрак';
    if (h >= 10 && h < 12) return 'Перекус';
    if (h >= 12 && h < 15) return 'Обед';
    if (h >= 15 && h < 18) return 'Полдник';
    if (h >= 18 && h < 21) return 'Ужин';
    return 'Вечерний перекус';
  };

  const createMealMeta = (time: string, name: string, isEvening = false, proteinLoading = false): MealMeta => ({
    protein: false,
    carbs: false,
    fiber: false,
    sweet: false,
    time,
    name,
    isEvening,
    proteinPortion: 'palm',
    proteinAi: null,
    proteinLoading,
    proteinManual: false,
  });

  const normalizeStoredMeal = (entry: unknown): { text: string; meta: MealMeta } | null => {
    if (typeof entry === 'string') {
      const time = nowHHMM();
      return { text: entry, meta: createMealMeta(time, storedMealNameByTime(time)) };
    }
    if (!entry || typeof entry !== 'object') return null;
    const item = entry as StoredMeal;
    const text = item.text ?? item.raw_text ?? item.description ?? '';
    if (!text) return null;
    const time = item.time ?? nowHHMM();
    const isEvening = Boolean(item.isEvening);
    const name = item.name ?? storedMealNameByTime(time, isEvening);
    const portion: ProteinPortion = item.proteinPortion === 'small' || item.proteinPortion === 'large' ? item.proteinPortion : 'palm';
    return {
      text,
      meta: {
        id: item.id,
        protein: Boolean(item.protein),
        carbs: Boolean(item.carbs),
        fiber: Boolean(item.fiber),
        sweet: Boolean(item.sweet),
        time,
        name,
        isEvening,
        proteinPortion: portion,
        proteinAi: typeof item.proteinAi === 'number' ? item.proteinAi : null,
        proteinLoading: false,
        proteinManual: Boolean(item.proteinManual),
      },
    };
  };

  const serializeStoredMeal = (text: string, meta: MealMeta): StoredMeal => ({
    id: meta.id,
    text,
    protein: meta.protein,
    carbs: meta.carbs,
    fiber: meta.fiber,
    sweet: meta.sweet,
    time: meta.time,
    name: meta.name,
    isEvening: meta.isEvening,
    proteinPortion: meta.proteinPortion,
    proteinAi: meta.proteinAi,
    proteinLoading: false,
    proteinManual: meta.proteinManual,
  });

  const readStoredMeals = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(mealsStorageKey()) || '[]');
      if (!Array.isArray(parsed)) return { texts: [] as string[], metas: [] as MealMeta[] };
      const normalized = parsed.map(normalizeStoredMeal).filter(Boolean) as { text: string; meta: MealMeta }[];
      return { texts: normalized.map(m => m.text), metas: normalized.map(m => m.meta) };
    } catch {
      return { texts: [] as string[], metas: [] as MealMeta[] };
    }
  };

  const writeStoredMeals = (texts: string[], metas: MealMeta[]) => {
    try {
      localStorage.setItem(mealsStorageKey(), JSON.stringify(texts.map((text, i) => {
        const fallbackTime = nowHHMM();
        return serializeStoredMeal(text, metas[i] ?? createMealMeta(fallbackTime, storedMealNameByTime(fallbackTime)));
      })));
    } catch {}
  };

  const appendStoredMeal = (text: string, meta: MealMeta) => {
    try {
      const existing = JSON.parse(localStorage.getItem(mealsStorageKey()) || '[]');
      const next = Array.isArray(existing) ? existing : [];
      next.push(serializeStoredMeal(text, meta));
      localStorage.setItem(mealsStorageKey(), JSON.stringify(next));
    } catch {}
  };

  const updateStoredMeal = (idx: number, text: string | undefined, partial: Partial<MealMeta>) => {
    try {
      const existing = JSON.parse(localStorage.getItem(mealsStorageKey()) || '[]');
      if (!Array.isArray(existing) || idx < 0 || idx >= existing.length) return;
      const current = normalizeStoredMeal(existing[idx]);
      if (!current) return;
      existing[idx] = serializeStoredMeal(text ?? current.text, { ...current.meta, ...partial });
      localStorage.setItem(mealsStorageKey(), JSON.stringify(existing));
    } catch {}
  };

  const removeStoredMeal = (idx: number) => {
    try {
      const existing = JSON.parse(localStorage.getItem(mealsStorageKey()) || '[]');
      if (!Array.isArray(existing)) return;
      localStorage.setItem(mealsStorageKey(), JSON.stringify(existing.filter((_, i) => i !== idx)));
    } catch {}
  };

  const toggleFood = (label: string) => {
    setSelectedFoods(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]);
  };

  const handleSubmitFoodSurvey = () => {
    if (selectedFoods.length === 0) return;
    updateProfile({ food_preferences: selectedFoods });
    setFoodSurveyAnswered(true);
    setTimeout(() => setShowMorningCheckin(true), 600);
  };

  const ingaResponse = (() => {
    const first = selectedFoods[0] ?? '';
    const n = selectedFoods.length;
    if (n <= 2) return `Поняла, запомнила! 🧡 У меня есть рецепт для «${first}». Покажу сегодня — ты удивишься, насколько это просто.`;
    if (n <= 4) return `Хороший список! 🧡 Начнём с «${first}» — покажу сегодня. Остальное разберём по одному в день.`;
    return `Ты любишь поесть со вкусом — это прекрасно! 😄 Всё это можно оставить. Начнём с «${first}» — уже сегодня.`;
  })();

  // Detect "sweet trigger" from weight gain reasons
  const sweetTrigger = (profile.weightGainReasons ?? []).some(r =>
    r.toLowerCase().includes('сладк')
  );

  // Load yesterday's plan (if any) to show as soft hint on meals tab
  useEffect(() => {
    loadMealPlanForDate(today).then(setYesterdayPlan).catch(() => {});
  }, [today]);

  // Load today's meals from localStorage first so navigation never clears them.
  useEffect(() => {
    if (tab !== 'meals') return;
    let cancelled = false;
    const stored = readStoredMeals();
    if (stored.texts.length > 0) {
      setMeals(stored.texts);
      setMealMeta(stored.metas);
      return;
    }
    loadFoodLogs(today).then(rows => {
      if (cancelled || !rows?.length) return;
      const texts: string[] = [];
      const metas: MealMeta[] = [];
      for (const r of rows) {
        const m = (r.meta ?? {}) as Record<string, unknown>;
        const d = new Date(r.datetime);
        const hh = d.getHours().toString().padStart(2, '0');
        const mm = d.getMinutes().toString().padStart(2, '0');
        const time = `${hh}:${mm}`;
        const isEvening = Boolean(m.isEvening);
        const name = isEvening ? 'Вечерний перекус' : (() => {
          const h = d.getHours();
          if (h >= 6 && h < 10) return 'Завтрак';
          if (h >= 10 && h < 12) return 'Перекус';
          if (h >= 12 && h < 15) return 'Обед';
          if (h >= 15 && h < 18) return 'Полдник';
          if (h >= 18 && h < 21) return 'Ужин';
          return 'Вечерний перекус';
        })();
        texts.push(r.raw_text ?? '');
        metas.push({
          id: r.log_id,
          protein: Boolean(m.protein),
          carbs: Boolean(m.carbs),
          fiber: Boolean(m.fiber),
          sweet: Boolean(m.sweet),
          time, name, isEvening,
          proteinPortion: (m.proteinPortion as ProteinPortion) ?? 'palm',
          proteinAi: typeof m.proteinAi === 'number' ? (m.proteinAi as number) : null,
          proteinLoading: false,
          proteinManual: Boolean(m.proteinManual),
        });
      }
      setMeals(texts);
      setMealMeta(metas);
      writeStoredMeals(texts, metas);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [tab, today]);

  // Load today's morning check-in from localStorage first so the form survives navigation.
  useEffect(() => {
    if (tab !== 'morning') return;
    try {
      const saved = localStorage.getItem(morningStorageKey());
      if (saved) {
        const data = JSON.parse(saved);
        setWeight(data.weight || '');
        setSleep(data.sleep || '');
        setSteps(data.steps || '');
        return;
      }
    } catch {}
    let cancelled = false;
    loadTodayCheckin(today).then(c => {
      if (cancelled || !c) return;
      if (c.weight != null) setWeight(prev => prev || String(c.weight));
      if (c.sleepHours != null) setSleep(prev => prev || String(c.sleepHours));
      if (c.stepsYesterday != null) setSteps(prev => prev || String(c.stepsYesterday));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [tab, today]);




  const handleSaveMorning = () => {
    try {
      localStorage.setItem(morningStorageKey(), JSON.stringify({
        weight,
        sleep,
        steps,
        savedAt: Date.now(),
      }));
    } catch {}
    saveDailyCheckin(
      today,
      weight ? parseFloat(weight) : undefined,
      sleep ? parseFloat(sleep) : undefined,
      steps ? parseInt(steps) : undefined,
    ).catch(() => {});

    if (weight) {
      const w = parseFloat(weight);
      addWeightEntry(today, w);
      // Build history excluding today's just-added entry to avoid self-comparison
      const history = weeklyData.filter(e => e.date !== today);
      const yesterdayDateStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const yesterdayReport = dailyReports.find(r => r.date === yesterdayDateStr);
      const result = analyzeMorningWeight(
        today,
        w,
        history,
        yesterdayReport,
        sleep ? parseFloat(sleep) : undefined,
        steps ? parseInt(steps) : undefined,
        profile.gender,
      );
      setMorningAnalysis(result);
      // Stage transition checks
      const stage = profile.currentStage ?? 'loss';
      const currentWeight = w;
      const targetWeight = profile.goal_weight_kg || profile.goalWeight || 0;
      const isGoalReached = targetWeight > 0 && currentWeight <= targetWeight && currentWeight > 0;
      if (stage === 'loss' && isGoalReached && !profile.goalReachedAt) {
        setShowGoalReached(true);
      } else if (
        stage === 'fixation' &&
        profile.goalWeight &&
        profile.equilibriumCalories &&
        profile.currentFixationCalories &&
        profile.currentFixationCalories >= profile.equilibriumCalories &&
        corridorStatus(w, profile.goalWeight) === 'in_range'
      ) {
        setShowFixationDone(true);
      } else if (stage === 'fixation' && profile.lastCalorieIncreaseAt && profile.currentFixationCalories) {
        // Weekly +200 ramp toward equilibrium
        const lastInc = new Date(profile.lastCalorieIncreaseAt).getTime();
        const daysSince = Math.floor((Date.now() - lastInc) / (1000 * 60 * 60 * 24));
        const eq = profile.equilibriumCalories ?? calculations?.totalCalories;
        if (daysSince >= 7 && eq && profile.currentFixationCalories < eq) {
          const next = Math.min(eq, profile.currentFixationCalories + 200);
          updateProfile({
            currentFixationCalories: next,
            fixationWeekNumber: (profile.fixationWeekNumber ?? 1) + 1,
            lastCalorieIncreaseAt: today,
          });
        }
      }
    } else {
      setMorningAnalysis(null);
    }
    setTab('meals');
  };

  const handleEnterFixation = () => {
    setShowGoalReached(false);
    const target = calculations?.totalCalories;
    const startCalories = calculations?.corridorMin ?? (target ? target - 400 : undefined);
    updateProfile({
      currentStage: 'fixation',
      goalReachedAt: today,
      fixationStartedAt: today,
      fixationWeekNumber: 1,
      currentFixationCalories: startCalories,
      equilibriumCalories: target ?? undefined,
      lastCalorieIncreaseAt: today,
    });
  };

  const handleEnterMaintenance = () => {
    setShowFixationDone(false);
    updateProfile({
      currentStage: 'maintenance',
      maintenanceStartedAt: today,
    });
  };

  const formatDelta = (d: number | null) => {
    if (d === null) return '—';
    if (d === 0) return '0 кг';
    return d > 0 ? `+${d} кг` : `${d} кг`;
  };

  const mealNameByHour = (h: number) => {
    if (h >= 6 && h < 10) return 'Завтрак';
    if (h >= 10 && h < 12) return 'Перекус';
    if (h >= 12 && h < 15) return 'Обед';
    if (h >= 15 && h < 18) return 'Полдник';
    if (h >= 18 && h < 21) return 'Ужин';
    return 'Вечерний перекус';
  };

  const mealNameByTime = (time: string) => {
    const h = parseInt(time.split(':')[0] || '0', 10);
    return mealNameByHour(h);
  };

  const mealTagFromName = (name: string): MealTag => {
    if (name === 'Завтрак') return 'breakfast';
    if (name === 'Обед') return 'lunch';
    if (name === 'Ужин') return 'dinner';
    return 'snack';
  };

  // Build an ISO datetime for today + HH:MM
  const timeToIso = (time: string): string => {
    const [hh, mm] = time.split(':').map(n => parseInt(n, 10));
    const d = new Date();
    d.setHours(hh || 0, mm || 0, 0, 0);
    return d.toISOString();
  };

  // Persisted patch helper — fire-and-forget by id
  const persistMetaPatch = (idx: number, partial: Partial<MealMeta>) => {
    setMealMeta(prev => {
      const next = prev.map((m, k) => k === idx ? { ...m, ...partial } : m);
      const m = next[idx];
      if (m?.id) {
        const metaPayload = {
          protein: m.protein, carbs: m.carbs, fiber: m.fiber, sweet: m.sweet,
          isEvening: m.isEvening, proteinPortion: m.proteinPortion,
          proteinAi: m.proteinAi, proteinManual: m.proteinManual,
        };
        updateFoodLog(m.id, {
          mealTag: mealTagFromName(m.name),
          datetime: timeToIso(m.time),
          meta: metaPayload,
        }).catch(() => {});
      }
      writeStoredMeals(meals, next);
      return next;
    });
  };

  const addMealEntry = (text: string, isEvening = false, timeOverride?: string) => {
    const t = text.trim();
    if (!t) return;
    const time = timeOverride || nowHHMM();
    const name = isEvening ? 'Вечерний перекус' : mealNameByTime(time);
    const meta: MealMeta = createMealMeta(time, name, isEvening, true);
    let newIdx = -1;
    appendStoredMeal(t, meta);
    setMeals(prev => {
      newIdx = prev.length;
      // kick off AI estimation
      resolveMealNutrition(t)
        .then(res => {
          const grams = Math.round(res.protein_g || 0);
          setMealMeta(curr => {
            const next = curr.map((mm, k) => k === newIdx
              ? { ...mm, proteinAi: grams, proteinLoading: false }
              : mm);
            updateStoredMeal(newIdx, t, { proteinAi: grams, proteinLoading: false });
            const m = next[newIdx];
            if (m?.id) {
              updateFoodLog(m.id, {
                meta: {
                  protein: m.protein, carbs: m.carbs, fiber: m.fiber, sweet: m.sweet,
                  isEvening: m.isEvening, proteinPortion: m.proteinPortion,
                  proteinAi: m.proteinAi, proteinManual: m.proteinManual,
                },
              }).catch(() => {});
            }
            return next;
          });
        })
        .catch(() => {
          updateStoredMeal(newIdx, t, { proteinLoading: false });
          setMealMeta(curr => curr.map((mm, k) => k === newIdx
            ? { ...mm, proteinLoading: false }
            : mm));
        });
      return [...prev, t];
    });
    setMealMeta(prev => [...prev, meta]);

    // Fire-and-forget DB save; backfill id on the row when it returns.
    saveFoodLog(t, mealTagFromName(name), {
      datetime: timeToIso(time),
      meta: {
        protein: false, carbs: false, fiber: false, sweet: false,
        isEvening, proteinPortion: 'palm',
        proteinAi: null, proteinManual: false,
      },
    })
      .then(row => {
        if (!row?.log_id) return;
        setMealMeta(curr => {
          const next = curr.map((mm, k) => k === newIdx ? { ...mm, id: row.log_id } : mm);
          const m = next[newIdx];
          if (m) updateStoredMeal(newIdx, t, { ...m, id: row.log_id });
          if (m) {
            // Backfill any meta changes (e.g. AI protein estimate) that
            // landed before the DB row was persisted.
            updateFoodLog(row.log_id, {
              meta: {
                protein: m.protein, carbs: m.carbs, fiber: m.fiber, sweet: m.sweet,
                isEvening: m.isEvening, proteinPortion: m.proteinPortion,
                proteinAi: m.proteinAi, proteinManual: m.proteinManual,
              },
            }).catch(() => {});
          }
          return next;
        });
      })
      .catch(() => {});
  };

  const handleAddMeal = () => {
    if (mealText.trim()) {
      addMealEntry(mealText.trim(), false, mealTime);
      setMealText('');
      setMealTime(nowHHMM());
      setShowMealInput(false);
    }
  };

  const handleAddEveningMeal = () => {
    if (eveningText.trim()) {
      addMealEntry(eveningText.trim(), true);
      setEveningText('');
      setShowEveningInput(false);
    }
  };

  const updateMealTime = (i: number, newTime: string) => {
    if (!newTime) return;
    setMealMeta(prev => {
      const next = prev.map((m, idx) => idx === i
        ? { ...m, time: newTime, name: m.isEvening ? 'Вечерний перекус' : mealNameByTime(newTime) }
        : m);
      const m = next[i];
      if (m) updateStoredMeal(i, meals[i], { time: newTime, name: m.name });
      if (m?.id) {
        updateFoodLog(m.id, {
          mealTag: mealTagFromName(m.name),
          datetime: timeToIso(newTime),
        }).catch(() => {});
      }
      return next;
    });
  };

  const toggleMealFlag = (i: number, key: 'protein' | 'carbs' | 'fiber' | 'sweet') => {
    persistMetaPatch(i, { [key]: !mealMeta[i]?.[key] } as Partial<MealMeta>);
  };

  const handleSaveEvening = () => {
    const report = {
      date: today,
      weight: weight ? parseFloat(weight) : undefined,
      sleepHours: sleep ? parseFloat(sleep) : undefined,
      stepsYesterday: steps ? parseInt(steps) : undefined,
      meals: meals.map((m, i) => ({ time: '', description: m, type: 'snack' as const })),
      eveningEmotion: emotion,
      hungerLevel: hunger,
      hardestPart: hardest,
      dayWin: dayWin.trim() || undefined,
      sweetPointDone: sweetPoint === '' ? null : sweetPoint === 'yes',

    };
    addDailyReport(report);
    const summary = buildGamificationSummary(
      today,
      weight ? [...weeklyData.filter(w => w.date !== today), { date: today, weight: parseFloat(weight) }] : weeklyData,
      [...dailyReports.filter(r => r.date !== today), report],
      medals,
    );
    if (summary.nextMedal) {
      addAwardedMedal(summary.nextMedal);
      setAwardedMedal(summary.nextMedal);
    }

    setSaved(true);
  };

  const startNewDay = () => {
    setSaved(false);
    setShowPlanning(false);
    setPlanText('');
    setPlanSavedMessage(false);
    setTab('morning');
    setMeals([]);
    setMealMeta([]);
    setMealText('');
    setWeight('');
    setSleep('');
    setSteps('');
    setEmotion('');
    setHunger(3);
    setHardest('');
    setDayWin('');
    setSweetPoint('');
    setWaterCount(0);
    setMorningAnalysis(null);
    setAwardedMedal(null);
    try {
      localStorage.removeItem('dailyActiveTab');
      localStorage.removeItem('dailyActiveTabDate');
    } catch {}
  };



  if (showPlanning) {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <div className="inga-bubble mb-6 w-full max-w-sm space-y-4">
          <h2 className="text-xl font-bold">План на завтра</h2>
          <p className="text-sm text-muted-foreground">
            Знаешь, что сильно помогает не срываться? Планирование еды накануне.
            Постарайся сегодня вечером заранее продумать, что ты будешь есть завтра
            на завтрак, обед, ужин и перекусы. Так ты не {getText('останешься одна', 'останешься один', profile.gender)} на один с голодом и случайной едой.
          </p>

          <div className="inga-card">
            <p className="font-semibold mb-2 text-sm">Как планировать</p>
            <p className="text-sm text-muted-foreground">
              Запланируй, что у тебя будет в качестве белка, клетчатки и углеводов
              в каждом приёме пищи, включая перекусы.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Также подумай, что ты будешь есть на Сладкую точку:
              десерт до 100 ккал/100 г или ягоды/фрукты.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Можешь даже заранее заказать необходимые продукты или положить
              их в корзину, если покупаешь онлайн.
            </p>
          </div>

          <button onClick={startNewDay} className="inga-btn-primary w-full">
            Продумала, начнём новый день →
          </button>
        </div>
      </div>
    );
  }

  if (saved) {
    // Achievement calculations
    const mealCount = mealMeta.length;
    const proteinCount = mealMeta.filter(m => m.protein).length;
    const fiberCount = mealMeta.filter(m => m.fiber).length;
    const eveningSnack = mealMeta.some(m => m.isEvening);
    const proteinPct = mealCount > 0 ? proteinCount / mealCount : 0;
    const fiberPct = mealCount > 0 ? fiberCount / mealCount : 0;

    const waterOk = waterCount >= 6;
    const proteinOk = proteinPct >= 0.8;
    const fiberOk = fiberPct >= 0.6;
    const sweetOk = sweetPoint === 'yes';
    const perfect = waterOk && proteinOk && fiberOk;

    const achievements: { icon: string; label: string }[] = [];
    if (waterOk) achievements.push({ icon: '💧', label: 'Вода' });
    if (proteinOk) achievements.push({ icon: '🥩', label: 'Белок' });
    if (fiberOk) achievements.push({ icon: '🥦', label: 'Клетчатка' });
    if (sweetOk) achievements.push({ icon: '🍰', label: 'Сладкая точка' });
    if (eveningSnack) achievements.push({ icon: '🌙', label: 'Вечерний перекус' });

    const userName = hasName(profile.name) ? profile.name : '';
    const greeting = userName ? `${userName}, ` : '';

    let ingaMessage: string;
    if (perfect) {
      ingaMessage = `${greeting}сегодня ты ${getText('держала', 'держал', profile.gender)} структуру весь день. Это именно то, что меняет привычки 🧡`;
    } else {
      const wins: string[] = [];
      if (proteinOk) wins.push('план по белку');
      if (fiberOk) wins.push('клетчатку');
      if (waterOk) wins.push('норму воды');
      if (sweetOk) wins.push('сладкую точку');
      const improvements: string[] = [];
      if (!fiberOk) improvements.push('добавь больше клетчатки — свежие овощи к каждому приёму пищи');
      else if (!proteinOk) improvements.push('добавь белок в каждый приём пищи');
      else if (!waterOk) improvements.push('выпей побольше воды — хотя бы 6 стаканов');
      else improvements.push('продолжай в том же духе 🧡');

      if (wins.length > 0) {
        ingaMessage = `Ты ${getText('отлично выполнила', 'отлично выполнил', profile.gender)} ${wins.slice(0, 2).join(' и ')}! Завтра ${improvements[0]}.`;
      } else {
        ingaMessage = `${greeting}завтра ${improvements[0]}. Один маленький шаг — и день уже другой 🧡`;
      }
    }

    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <div className="inga-bubble mb-6 w-full max-w-sm space-y-4">
          <h2 className="text-xl font-bold text-center">День завершён ✨</h2>

          {perfect && (
            <div className="inga-card border-primary/40 bg-primary/5 text-center">
              <div className="text-5xl mb-2">🌟</div>
              <p className="font-semibold text-primary">Идеальный день!</p>
            </div>
          )}

          {achievements.length > 0 && (
            <div>
              <p className="font-semibold mb-2 text-sm">Твои достижения</p>
              <div className="flex flex-wrap gap-2">
                {achievements.map(a => (
                  <div
                    key={a.label}
                    className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm"
                  >
                    <span>{a.icon}</span>
                    <span className="font-medium">{a.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="inga-card">
            <p className="text-sm">{ingaMessage}</p>
          </div>

          {awardedMedal && (
            <div className="inga-card border-primary/40 bg-primary/5">
              <p className="text-sm font-semibold mb-1">Новая медаль</p>
              <div className="flex items-start gap-3">
                <span className={`text-3xl ${getMedalStyle(awardedMedal.type).tone}`}>{getMedalStyle(awardedMedal.type).icon}</span>
                <div>
                  <p className="font-semibold">{awardedMedal.title}</p>
                  <p className="text-sm text-muted-foreground">{awardedMedal.description}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              try { localStorage.setItem(PLANNING_INTRO_KEY, 'true'); } catch {}
              setShowPlanning(true);
            }}
            className="inga-btn-primary w-full"
          >
            Спланировать завтра →
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 pb-[80px] animate-fade-in-up" style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
      {showGoalReached && (
        <GoalReachedModal sex={profile.gender} onContinue={handleEnterFixation} />
      )}
      {showFixationDone && (
        <FixationCompleteModal sex={profile.gender} onContinue={handleEnterMaintenance} />
      )}
      {/* Header: date + day badge */}
      <div className="w-full max-w-sm flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">{dateLabel}</span>
        <span
          style={{
            background: '#FAEEDA',
            color: '#FF6200',
            fontWeight: 600,
            borderRadius: '20px',
            padding: '2px 10px',
            fontSize: '12px',
          }}
        >
          День {dayNumber}
        </span>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 mb-6 w-full max-w-sm">
        {(['morning', 'meals', 'evening'] as DailyTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
          >
            {t === 'morning' ? '🌅 Утро' : t === 'meals' ? '🍽️ Питание' : '🌙 Вечер'}
          </button>
        ))}
      </div>


      <div className="w-full max-w-sm">
        {tab === 'morning' && (
          <div className="space-y-4 animate-fade-in-up">
            {showFoodSurvey && (
              <div className="space-y-4">
                <div className="inga-bubble flex gap-3 items-start">
                  <img
                    src={ingaPhoto}
                    alt="Инга"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      border: '2px solid #FF6200',
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                  <div className="text-sm">
                    <p>
                      <span className="font-semibold">{profile.name || 'Привет'}</span>, прежде чем начнём — скажи, что ты точно не хочешь убирать из меню?
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">Выбери всё что любишь — я покажу лёгкую версию.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {FOOD_PREFERENCE_OPTIONS.map(opt => {
                    const active = selectedFoods.includes(opt.label);
                    return (
                      <button
                        key={opt.label}
                        onClick={() => toggleFood(opt.label)}
                        className="text-left p-3 rounded-2xl text-sm font-medium transition-colors flex items-start gap-2"
                        style={{
                          background: active ? '#FFF1E0' : '#FFFFFF',
                          border: active ? '2px solid #FF6200' : '1px solid #EFE6DC',
                        }}
                      >
                        <span className="text-lg leading-none">{opt.emoji}</span>
                        <span className="leading-tight">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleSubmitFoodSurvey}
                  disabled={selectedFoods.length === 0}
                  className="inga-btn-primary w-full disabled:opacity-50"
                >
                  Показать лёгкие версии →
                </button>
              </div>
            )}

            {foodSurveyAnswered && (
              <div className="inga-bubble flex gap-3 items-start animate-fade-in-up">
                <img
                  src={ingaPhoto}
                  alt="Инга"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: '2px solid #FF6200',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
                <p className="text-sm">{ingaResponse}</p>
              </div>
            )}

            {foodSurveyAnswered && showMorningCheckin && (
              <p className="text-center text-xs text-muted-foreground italic py-2">
                — А теперь — утренний чек-ин —
              </p>
            )}

            {showCheckinFields && (<>
            <h3 className="text-xl font-bold">Доброе утро! ☀️</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Вес сегодня (кг)</label>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="inga-input" placeholder="70.5" step="0.1" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{getText('Сколько часов спала?', 'Сколько часов спал?', profile.gender)}</label>
              <input type="number" value={sleep} onChange={e => setSleep(e.target.value)} className="inga-input" placeholder="7" step="0.5" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Шаги вчера</label>
              <input type="number" value={steps} onChange={e => setSteps(e.target.value)} className="inga-input" placeholder="6000" />
            </div>
            {!morningAnalysis && (
              <div className="inga-bubble">
                <p className="text-sm text-muted-foreground">Вес может колебаться по разным причинам. Мы смотрим не на день, а на тенденцию.</p>
              </div>
            )}

            {morningAnalysis && (
              <div className="inga-bubble space-y-3 animate-fade-in-up">
                <p className="font-semibold">Динамика веса</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• за 1 день: {formatDelta(morningAnalysis.dayDelta)}</li>
                  <li>• за 7 дней: {morningAnalysis.weekDataAvailable ? formatDelta(morningAnalysis.weekDelta) : 'пока мало данных'}</li>
                </ul>

                <div>
                  <p className="font-semibold mb-1">Что это может значить</p>
                  <p className="text-sm text-muted-foreground">{morningAnalysis.meaning}</p>
                  <p className="text-sm text-muted-foreground mt-2">{morningAnalysis.weeklyComment}</p>
                </div>

                <div>
                  <p className="font-semibold mb-1">Фокус на сегодня</p>
                  <p className="text-sm text-muted-foreground">{morningAnalysis.focus}</p>
                </div>
              </div>
            )}

            {!morningAnalysis ? (
              <button onClick={handleSaveMorning} className="inga-btn-primary w-full">
                Сохранить →
              </button>
            ) : (
              <button onClick={() => setTab('meals')} className="inga-btn-primary w-full">
                Перейти к питанию →
              </button>
            )}
            </>)}
          </div>
        )}


        {tab === 'meals' && (() => {
          const totalMeals = mealMeta.length;
          const carbsMeals = mealMeta.filter(m => m.carbs).length;
          const fiberMeals = mealMeta.filter(m => m.fiber).length;
          const portionGrams: Record<ProteinPortion, number> = { small: 15, palm: 25, large: 40 };
          const proteinGrams = mealMeta.reduce(
            (sum, m) => sum + (m.proteinAi ?? (m.protein ? portionGrams[m.proteinPortion] : 0)),
            0
          );
          const anyProteinLoading = mealMeta.some(m => m.proteinLoading);
          const proteinTarget = Math.round((profile.weight || 80) * 1.5);
          const carbsTarget = Math.max(3, totalMeals || 3);
          const fiberTarget = Math.max(3, totalMeals || 3);
          const pct = (v: number, t: number) => Math.min(100, Math.round((v / Math.max(1, t)) * 100));
          const userName = profile.name || 'Друг';

          const ingaMsg = (() => {
            if (totalMeals === 0) return 'Добавь первый приём пищи — не доводи себя до голода 🧡';
            if (waterCount < 4) return `${userName}, выпей ещё воды — пока только ${waterCount} из 6 стаканов 💧`;
            if (proteinGrams < proteinTarget * 0.6) return 'Белка маловато сегодня. Добавь мясо, рыбу, яичный белок или творог к следующему приёму.';
            if (fiberMeals / totalMeals < 0.5) return 'Маловато клетчатки. Добавь овощи или ягоды к следующему приёму 🥦';
            if (waterCount >= 5 && proteinGrams >= proteinTarget * 0.8 && fiberMeals / totalMeals >= 0.6) {
              return 'Хороший день — структура держится. Продолжай в том же духе 🧡';
            }
            return 'Структура дня складывается. Не забывай про воду, белок и клетчатку 🧡';
          })();

          const regular = mealMeta.map((m, i) => ({ ...m, i, desc: meals[i] })).filter(m => !m.isEvening);
          const evening = mealMeta.map((m, i) => ({ ...m, i, desc: meals[i] })).filter(m => m.isEvening);

          const removeMeal = (idx: number) => {
            const target = mealMeta[idx];
            if (target?.id) deleteFoodLog(target.id).catch(() => {});
            setMeals(prev => prev.filter((_, k) => k !== idx));
            setMealMeta(prev => prev.filter((_, k) => k !== idx));
          };

          const setMealPortion = (idx: number, portion: ProteinPortion) => {
            persistMetaPatch(idx, { proteinPortion: portion });
          };

          const saveManualProtein = (idx: number, value: string) => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n >= 0 && n < 500) {
              persistMetaPatch(idx, { proteinAi: n, proteinLoading: false, proteinManual: true });
            }
            setEditingProteinIdx(null);
            setEditingProteinValue('');
          };



          const pillStyle = (active: boolean, kind: 'protein' | 'carbs' | 'fiber') => {
            if (!active) return { background: '#F7F2EE', color: '#8A7A70', border: '1px solid #E5DDD8' };
            if (kind === 'protein') return { background: '#F9EDEA', color: '#CF7B5A', border: '1px solid #CF7B5A' };
            if (kind === 'carbs') return { background: '#FAF4E5', color: '#C49A3E', border: '1px solid #C49A3E' };
            return { background: '#EDF5F0', color: '#5E9E72', border: '1px solid #5E9E72' };
          };

          const MealCard = ({ m, hideCarbs = false }: { m: typeof regular[number]; hideCarbs?: boolean }) => (
            <div className="bg-white" style={{ borderRadius: 14, border: '1px solid #EDE5DF', padding: 14 }}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-semibold text-sm flex items-center gap-1">
                  <span>{m.name}</span>
                  <span style={{ color: '#8A7A70' }}>·</span>
                  {editingTimeIdx === m.i ? (
                    <input
                      type="time"
                      autoFocus
                      value={m.time}
                      onChange={e => updateMealTime(m.i, e.target.value)}
                      onBlur={() => setEditingTimeIdx(null)}
                      onKeyDown={e => { if (e.key === 'Enter') setEditingTimeIdx(null); }}
                      className="meal-time-input"
                      style={{
                        color: '#6A5A50',
                        background: 'transparent',
                        border: '1px solid #FF6200',
                        borderRadius: 6,
                        padding: '1px 4px',
                        fontSize: 13,
                        fontWeight: 600,
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingTimeIdx(m.i)}
                      style={{
                        color: '#6A5A50',
                        background: 'transparent',
                        border: 'none',
                        padding: '1px 4px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      aria-label="Изменить время"
                    >
                      {m.time}
                    </button>
                  )}
                </span>
                <button
                  onClick={() => setConfirmDeleteIndex(m.i)}
                  className="flex items-center justify-center"
                  style={{ color: '#E53935' }}
                  aria-label="Удалить"
                >
                  <Trash2 size={20} />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{m.desc}</p>
              <div className="flex items-center gap-1.5 mb-3 text-[11px]" style={{ color: '#8A7A70' }}>
                {editingProteinIdx === m.i ? (
                  <>
                    <input
                      type="number"
                      min={0}
                      max={300}
                      autoFocus
                      value={editingProteinValue}
                      onChange={e => setEditingProteinValue(e.target.value)}
                      onBlur={() => saveManualProtein(m.i, editingProteinValue)}
                      onKeyDown={e => { if (e.key === 'Enter') saveManualProtein(m.i, editingProteinValue); }}
                      style={{
                        width: 50, color: '#6A5A50', background: 'transparent',
                        border: '1px solid #CF7B5A', borderRadius: 6, padding: '1px 4px',
                        fontSize: 11, outline: 'none',
                      }}
                    />
                    <span>г белка</span>
                  </>
                ) : m.proteinLoading ? (
                  <span>... оценка белка</span>
                ) : m.proteinAi !== null ? (
                  <>
                    <span>~{m.proteinAi}г белка{m.proteinManual ? '' : ''}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProteinIdx(m.i);
                        setEditingProteinValue(String(m.proteinAi ?? ''));
                      }}
                      aria-label="Скорректировать белок"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11 }}
                    >
                      ✏️
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditingProteinIdx(m.i); setEditingProteinValue(''); }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, color: '#8A7A70' }}
                  >
                    + указать белок ✏️
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <button onClick={() => toggleMealFlag(m.i, 'protein')} className="text-xs px-3 py-1 rounded-full font-medium" style={pillStyle(m.protein, 'protein')}>
                  {m.protein ? '✓' : '+'} Белок
                </button>
                {!hideCarbs && (
                  <button onClick={() => toggleMealFlag(m.i, 'carbs')} className="text-xs px-3 py-1 rounded-full font-medium" style={pillStyle(m.carbs, 'carbs')}>
                    {m.carbs ? '✓' : '+'} Углеводы
                  </button>
                )}
                <button onClick={() => toggleMealFlag(m.i, 'fiber')} className="text-xs px-3 py-1 rounded-full font-medium" style={pillStyle(m.fiber, 'fiber')}>
                  {m.fiber ? '✓' : '+'} Клетчатка
                </button>
              </div>
              {m.protein && (
                <div className="mb-2 pl-1">
                  <p className="text-[11px] mb-1" style={{ color: '#8A7A70' }}>Сколько белка?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { key: 'small' as ProteinPortion, label: '🤏 Меньше ладони' },
                      { key: 'palm' as ProteinPortion, label: '🤚 Ладонь' },
                      { key: 'large' as ProteinPortion, label: '👐 Больше ладони' },
                    ]).map(opt => {
                      const active = m.proteinPortion === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => setMealPortion(m.i, opt.key)}
                          className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                          style={{
                            background: active ? '#F9EDEA' : '#F7F2EE',
                            color: active ? '#CF7B5A' : '#8A7A70',
                            border: active ? '1px solid #CF7B5A' : '1px solid #E5DDD8',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {!m.isEvening && (
                <button
                  onClick={() => toggleMealFlag(m.i, 'sweet')}
                  className="text-xs font-medium"
                  style={{ color: m.sweet ? '#CF7B5A' : '#8A7A70' }}
                >
                  🍰 {m.sweet ? 'Сладкая точка ✓' : '+ Сладкая точка'}
                </button>
              )}
            </div>
          );

          return (
          <div className="space-y-4 animate-fade-in-up">
            {/* Water tracker */}
            <div className="bg-white flex items-center gap-2" style={{ borderRadius: 14, border: '1px solid #EDE5DF', padding: '10px 14px' }}>
              <span className="text-sm font-medium">💧 Вода</span>
              <div className="flex gap-1 flex-1 justify-center">
                {Array.from({ length: 6 }).map((_, i) => (
                  <button key={i} onClick={() => setWaterCount(i + 1 === waterCount ? i : i + 1)} className="text-lg leading-none" aria-label={`Стакан ${i + 1}`}>
                    {i < waterCount ? '🥛' : <span style={{ opacity: 0.3 }}>🥛</span>}
                  </button>
                ))}
              </div>
              <button onClick={() => setWaterCount(c => c + 1)} className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm leading-none flex items-center justify-center" aria-label="Добавить">+</button>
              <span className="text-sm font-semibold tabular-nums">{waterCount}/6</span>
            </div>

            {/* Nutrition structure */}
            <div className="bg-white" style={{ borderRadius: 14, border: '1px solid #EDE5DF', padding: 14 }}>
              <p className="text-xs font-bold tracking-wide mb-3" style={{ color: '#8A7A70' }}>СТРУКТУРА ПИТАНИЯ СЕГОДНЯ</p>
              {[
                { icon: '🥩', label: 'Белок', val: anyProteinLoading ? `...` : `~${proteinGrams}г из ${proteinTarget}г`, color: '#CF7B5A', pct: pct(proteinGrams, proteinTarget) },
                { icon: '🌾', label: 'Углеводы', val: `${carbsMeals}/${carbsTarget}`, color: '#C49A3E', pct: pct(carbsMeals, carbsTarget) },
                { icon: '🥦', label: 'Клетчатка', val: `${fiberMeals}/${fiberTarget}`, color: '#5E9E72', pct: pct(fiberMeals, fiberTarget) },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex items-center gap-3 py-1.5">
                    <span className="text-base">{row.icon}</span>
                    <span className="text-sm w-20">{row.label}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#F2EBE5' }}>
                      <div style={{ width: `${row.pct}%`, height: '100%', background: row.color, transition: 'width 0.3s' }} />
                    </div>
                    <span className="text-xs tabular-nums w-24 text-right" style={{ color: '#8A7A70' }}>{row.val}</span>
                  </div>
                  {row.label === 'Белок' && (
                    <p className="text-[10px] ml-8" style={{ color: '#A89A8E' }}>оценка по описанию блюд</p>
                  )}
                </div>
              ))}
            </div>

            {/* Inga smart card */}
            <div className="inga-bubble flex gap-3 items-start">
              <img src={ingaPhoto} alt="Инга" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              <p className="text-sm">{ingaMsg}</p>
            </div>

            {/* Add meal */}
            {!showMealInput ? (
              <button onClick={() => { setMealTime(nowHHMM()); setShowMealInput(true); }} className="inga-btn-primary w-full" style={{ borderRadius: 12 }}>
                + Добавить приём пищи
              </button>
            ) : (
              <div className="bg-white space-y-2" style={{ borderRadius: 12, border: '1px solid #EDE5DF', padding: 12 }}>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={mealTime}
                    onChange={e => setMealTime(e.target.value)}
                    className="meal-time-input"
                    style={{
                      color: '#6A5A50',
                      background: '#FAF5F0',
                      border: '1px solid transparent',
                      borderRadius: 8,
                      padding: '4px 8px',
                      fontSize: 13,
                      fontWeight: 600,
                      outline: 'none',
                    }}
                    onFocus={e => (e.currentTarget.style.border = '1px solid #FF6200')}
                    onBlur={e => (e.currentTarget.style.border = '1px solid transparent')}
                  />
                  <span className="text-xs" style={{ color: '#8A7A70' }}>{mealNameByTime(mealTime)}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    value={mealText}
                    onChange={e => setMealText(e.target.value)}
                    autoFocus
                    className="inga-input flex-1"
                    placeholder="Что ела?"
                    onKeyDown={e => e.key === 'Enter' && handleAddMeal()}
                  />
                  <VoiceInput
                    onConfirm={(text) => addMealEntry(text, false, mealTime)}
                    onEdit={(text) => setMealText(text)}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddMeal} className="inga-btn-primary flex-1">Добавить</button>
                  <button onClick={() => { setShowMealInput(false); setMealText(''); }} className="inga-btn-secondary flex-1">Отмена</button>
                </div>
              </div>
            )}

            {/* Regular meal cards */}
            {regular.map(m => <MealCard key={m.i} m={m} />)}

            {/* Evening divider */}
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px" style={{ background: '#E5DDD8' }} />
              <span style={{ fontSize: 10, color: '#C0B0A8', letterSpacing: '0.1em' }}>вечер</span>
              <div className="flex-1 h-px" style={{ background: '#E5DDD8' }} />
            </div>

            {/* Evening snack card */}
            <div style={{ background: '#F4F0F9', border: '1.5px solid #C9B8E8', borderRadius: 14, padding: 14 }}>
              <p className="font-semibold text-sm mb-1" style={{ color: '#4A3580' }}>🌙 Вечерний перекус</p>
              <p className="text-xs mb-3" style={{ color: '#4A3580', opacity: 0.85 }}>
                Только белок + клетчатка, без жира и углеводов. Можно есть даже на ночь.
              </p>
              {evening.map(m => <div key={m.i} className="mb-2"><MealCard m={m} hideCarbs /></div>)}
              {!showEveningInput ? (
                <button
                  onClick={() => setShowEveningInput(true)}
                  className="text-sm font-medium px-4 py-2 rounded-xl"
                  style={{ background: '#4A3580', color: '#fff' }}
                >
                  + Записать
                </button>
              ) : (
                <div className="bg-white space-y-2 mt-2" style={{ borderRadius: 12, border: '1px solid #EDE5DF', padding: 12 }}>
                  <div className="flex gap-2">
                    <input
                      value={eveningText}
                      onChange={e => setEveningText(e.target.value)}
                      autoFocus
                      className="inga-input flex-1"
                      placeholder="Что ела?"
                      onKeyDown={e => e.key === 'Enter' && handleAddEveningMeal()}
                    />
                    <VoiceInput
                      onConfirm={(text) => addMealEntry(text, true)}
                      onEdit={(text) => setEveningText(text)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddEveningMeal} className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ background: '#4A3580', color: '#fff' }}>Добавить</button>
                    <button onClick={() => { setShowEveningInput(false); setEveningText(''); }} className="inga-btn-secondary flex-1">Отмена</button>
                  </div>
                </div>
              )}

              {/* Delete confirmation dialog */}
              {confirmDeleteIndex !== null && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDeleteIndex(null)}>
                  <div className="bg-card rounded-2xl p-5 w-full max-w-md shadow-xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                    <p className="text-base font-semibold mb-2">Удалить приём пищи?</p>
                    <p className="text-sm text-muted-foreground mb-5">Это действие нельзя отменить.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmDeleteIndex(null)} className="inga-btn-secondary flex-1 text-sm py-2">
                        Отмена
                      </button>
                      <button
                        onClick={() => { removeMeal(confirmDeleteIndex); setConfirmDeleteIndex(null); }}
                        className="flex-1 text-sm py-2 rounded-xl font-medium"
                        style={{ background: '#E53935', color: '#fff' }}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        })()}



        {tab === 'evening' && (
          <div className="space-y-4 animate-fade-in-up">
            <h3 className="text-xl font-bold">Вечерний итог 🌙</h3>

            <div>
              <label className="block text-sm font-medium mb-2">Эмоция дня</label>
              <div className="flex flex-wrap gap-2">
                {['😊 Спокойствие', '😴 Усталость', '😰 Тревога', '😐 Скука', '😢 Грусть'].map(e => (
                  <button
                    key={e}
                    onClick={() => setEmotion(e)}
                    className={emotion === e ? 'inga-chip-active' : 'inga-chip-inactive'}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Уровень голода (1–5)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setHunger(n)}
                    className={`w-10 h-10 rounded-xl font-bold transition-colors ${hunger === n ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Что сегодня получилось? 🌟</label>
              <input
                value={dayWin}
                onChange={e => setDayWin(e.target.value)}
                className="inga-input"
                placeholder="Выпила норму воды, съела норму белка, не сорвалась вечером..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Была ли сладкая точка сегодня?</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSweetPoint('yes')}
                  className={sweetPoint === 'yes' ? 'inga-chip-active' : 'inga-chip-inactive'}
                >
                  🍰 Да, была
                </button>
                <button
                  onClick={() => setSweetPoint('no')}
                  className={sweetPoint === 'no' ? 'inga-chip-active' : 'inga-chip-inactive'}
                >
                  Нет
                </button>
              </div>
              {sweetPoint === 'no' && (
                <p className="text-xs text-muted-foreground mt-2">
                  Запланируй на завтра — это помогает не срываться
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Что далось с трудом?</label>
              <input value={hardest} onChange={e => setHardest(e.target.value)} className="inga-input" placeholder="Вечером хотелось сладкого..." />
            </div>


            <button onClick={handleSaveEvening} className="inga-btn-primary w-full">
              Завершить день ✨
            </button>
          </div>
        )}
      </div>

      <button onClick={() => setStep('menu')} className="mt-6 text-sm text-muted-foreground underline">
        Открыть меню
      </button>

      {/* Fixed bottom chat panel */}
      <button
        onClick={() => setStep('chat')}
        className="fixed bottom-0 z-50 flex items-center gap-[10px] px-4 py-[14px] border-t border-[#EDE5DF] bg-white"
        style={{ background: '#fff', maxWidth: 480, left: '50%', transform: 'translateX(-50%)', width: '100%', boxShadow: '0 -2px 8px rgba(0,0,0,0.06)', borderRadius: '16px 16px 0 0' }}
      >
        <img
          src={ingaPhoto}
          alt="Инга"
          className="w-[38px] h-[38px] rounded-full flex-shrink-0"
          style={{ border: '2px solid #FAEEDA' }}
        />
        <div className="flex-1 text-left">
          <p className="text-[14px] font-semibold" style={{ color: '#2C1A0E' }}>
            Поговорим?
          </p>
          <p className="text-[12px]" style={{ color: '#A89080' }}>
            Задай вопрос или расскажи, как проходит день
          </p>
        </div>
        <span className="text-[18px]" style={{ color: '#FF6200' }}>
          ›
        </span>
      </button>
    </div>
  );
}
