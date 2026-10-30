import { DIARY_AI_LIMIT_MESSAGE } from '@/lib/request-limits';
import { useSaveAction, SAVE_ERROR } from '@/hooks/use-save-action';
import { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useMealDiary, MealMeta, ProteinPortion, LightSwapMeta } from '@/lib/nutrition/use-meal-diary';
import { mealFacts } from '../../../server/nutrition/facts.js';
import { DietAnalysis } from './DietAnalysis';
import { currentSession } from '@/lib/auth-storage';
import { analyzeMorningWeight, MorningWeightAnalysis } from '@/lib/morning-analysis';
import { localDay } from '@/lib/achievement-client';
import { toast } from 'sonner';
import { LIGHT_RECIPES, timesLighter, LightRecipeEntry } from '@/lib/light-version';
import { withName, hasName } from '@/lib/user-name';
import { VoiceInput } from './VoiceInput';
import { saveMealPlan, loadMealPlanForDate, loadTodayCheckin, loadLightSavings, loadProgramProgress, logUserEvent, type MealTag, type LightSavings, type ProgramProgress } from '@/lib/db';
import { PROGRAM_MONTH1, type ProgramLink } from '@/lib/program-month1';
import { ProgramDayCard, currentProgramDay, localDateStr } from './ProgramDayCard';
import { findSwapHint, registerHintShown, muteSwapPair, kgEquivalent, COPILKA_TEXTS, HINT_TEXTS, type SwapPair } from '@/lib/swap-base';
import { GoalReachedModal } from './GoalReachedModal';
import { FixationProgressCard } from './FixationProgressCard';
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

// Карта «категория опроса → рецепты лёгких версий» (id из light-version.ts)
const CATEGORY_RECIPES: Record<string, string[]> = {
  'Блины и сырники': ['bliny'],
  'Десерты': ['nezhnost', 'milfey', 'sharlotka'],
  'Несладкая выпечка': ['pirozhki', 'pizza'],
  'Паста и каши': ['oatmeal'],
  'Салаты с майонезом': [],
  'Жирные вторые блюда': ['turkey-cutlets', 'fried-potatoes-mushrooms'],
  'Вечерние перекусы': [],
  'Сладкие напитки': ['cappuccino'],
};

const PLANNING_INTRO_KEY = 'meal_planning_intro_shown';


type DailyTab = 'morning' | 'meals' | 'analysis';

export function DailyScreen() {
  const { setStep, addWeightEntry, profile, calculations, weeklyData, dailyReports, updateProfile, performFixationAction } = useApp();
  const todayInit = localDay();
  const [tab, setTab] = useState<DailyTab>(() => {
    try {
      const savedDate = localStorage.getItem('dailyActiveTabDate');
      const savedTab = localStorage.getItem('dailyActiveTab') as DailyTab | null;
      if (savedDate === todayInit && savedTab && ['morning', 'meals', 'analysis'].includes(savedTab)) {
        return savedTab;
      }
    } catch {}
    return 'morning';
  });
  const [weight, setWeight] = useState('');
  const [sleep, setSleep] = useState('');
  const [stool, setStool] = useState<boolean | null>(null);
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
  const [today, setToday] = useState(localDay);
  useEffect(() => { const timer = window.setInterval(() => setToday(localDay()), 30000); return () => clearInterval(timer); }, []);
  const diary = useMealDiary(today);
  const { meals, mealMeta } = diary;
  const morningDirty = useRef(new Set<string>());
  const morningSaving = useRef(false);
  const [morningReady, setMorningReady] = useState(false);
  const [morningBusy, setMorningBusy] = useState(false);
  const owner = currentSession()?.user.id;
  useEffect(() => {
    let cancelled = false;
    morningDirty.current.clear(); setMorningReady(false);
    setWeight(''); setSleep(''); setSteps(''); setStool(null); setMorningAnalysis(null);
    loadTodayCheckin(today).then(row => {
      if (cancelled || currentSession()?.user.id !== owner) return;
      if (row) {
        if (!morningDirty.current.has('weight')) setWeight(row.weight == null ? '' : String(row.weight));
        if (!morningDirty.current.has('sleep')) setSleep(row.sleepHours == null ? '' : String(row.sleepHours));
        if (!morningDirty.current.has('steps')) setSteps(row.stepsYesterday == null ? '' : String(row.stepsYesterday));
        if (!morningDirty.current.has('stool')) setStool(row.stoolYesterday ?? null);
      }
      setMorningReady(true);
    });
    return () => { cancelled = true; };
  }, [today, owner]);
  // Копилка лёгкости и подсказки замен
  const [lightSavings, setLightSavings] = useState<LightSavings | null>(null);
  const [pendingHint, setPendingHint] = useState<{ pair: SwapPair; revealed: boolean } | null>(null);
  const [showLightPicker, setShowLightPicker] = useState(false);
  const [copilkaOpen, setCopilkaOpen] = useState(false);
  const [lightPickerQuery, setLightPickerQuery] = useState('');
  // Лёгкие рецепты, выбранные в текущем окне ввода (своё + лёгкое в одной записи)
  const [draftLightSwaps, setDraftLightSwaps] = useState<{ recipeId: string; name: string; savedKcal: number }[]>([]);

  const [waterCount, setWaterCount] = useState<number>(() => {
    try {
      const todayStr = localDay();
      const savedDate = localStorage.getItem('waterDate');
      const savedCount = localStorage.getItem('waterCount');
      if (savedDate === todayStr && savedCount) {
        return parseInt(savedCount, 10) || 0;
      }
    } catch {}
    return 0;
  });
  const [showMealInput, setShowMealInput] = useState(false);
  // Флажки, отмечаемые прямо при вводе приёма (чтобы не искать карточку внизу)
  const emptyDraftFlags = { protein: false, carbs: false, fiber: false, sweet: false };
  // Разовая обучающая подсказка про флажки/лёгкие рецепты — показывается,
  // пока пользователь не нажмёт «Понятно».
  const [showMealHint, setShowMealHint] = useState(() => {
    try { return localStorage.getItem('inga-meal-hint-dismissed') !== '1'; } catch { return true; }
  });
  const dismissMealHint = () => {
    setShowMealHint(false);
    try { localStorage.setItem('inga-meal-hint-dismissed', '1'); } catch {}
  };
  const [draftFlags, setDraftFlags] = useState(emptyDraftFlags);
  const draftTouched = useRef(new Set<string>());
  const toggleDraftFlag = (key: keyof typeof emptyDraftFlags) => {
    draftTouched.current.add(key);
    setDraftFlags(f => ({ ...f, [key]: !f[key] }));
  };
  const [showEveningInput, setShowEveningInput] = useState(false);
  const [eveningText, setEveningText] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [morningAnalysis, setMorningAnalysis] = useState<MorningWeightAnalysis | null>(null);
  const [showGoalReached, setShowGoalReached] = useState(false);
  const [enteringFixation, setEnteringFixation] = useState(false);
  const [showPlanning, setShowPlanning] = useState(false);
  const [planText, setPlanText] = useState('');
  const [planSavedMessage, setPlanSavedMessage] = useState(false);
  const [yesterdayPlan, setYesterdayPlan] = useState<string | null>(null);
  const [selectedFoods, setSelectedFoods] = useState<string[]>([]);
  const [foodSurveyAnswered, setFoodSurveyAnswered] = useState(false);
  const [showMorningCheckin, setShowMorningCheckin] = useState(false);

  const tomorrow = localDay(new Date(Date.now() + 86400000));

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
  // dayNumber больше не считается отдельно от dailyReports — раньше он мог
  // расходиться с «ДЕНЬ N ИЗ 30» на карточке программы (два разных счётчика
  // на одном экране путали пользователя). Теперь оба места показывают один
  // и тот же programDayNum, см. ниже.

  const showFoodSurvey = !foodSurveyAnswered && (!profile.food_preferences || profile.food_preferences.length === 0) && weeklyData.length === 0;
  const showCheckinFields = !showFoodSurvey || showMorningCheckin;

  const toggleFood = (label: string) => {
    setSelectedFoods(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]);
  };

  const { save, saving, saveError } = useSaveAction();
  const handleSubmitFoodSurvey = async () => {
    if (selectedFoods.length === 0) return;
    if (!(await save(() => updateProfile({ food_preferences: selectedFoods })))) return;
    setFoodSurveyAnswered(true);
    setTimeout(() => setShowMorningCheckin(true), 600);
  };

  const ingaResponse = (() => {
    const first = selectedFoods[0] ?? '';
    const n = selectedFoods.length;
    if (n <= 2) return `Поняла, запомнила! 🧡 У меня есть рецепт для «${first}». Покажу сегодня — вы удивитесь, насколько это просто.`;
    if (n <= 4) return `Хороший список! 🧡 Начнём с «${first}» — покажу сегодня. Остальное разберём по одному в день.`;
    return `Вы любите поесть со вкусом — это прекрасно! 😄 Всё это можно оставить. Начнём с «${first}» — уже сегодня.`;
  })();

  // Detect "sweet trigger" from weight gain reasons
  const sweetTrigger = (profile.weightGainReasons ?? []).some(r =>
    r.toLowerCase().includes('сладк')
  );

  // Load yesterday's plan (if any) to show as soft hint on meals tab
  useEffect(() => {
    loadMealPlanForDate(today).then(setYesterdayPlan).catch(() => {});
  }, [today]);

  // Persist water count to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('waterCount', String(waterCount));
      localStorage.setItem('waterDate', localDay());
    } catch {}
  }, [waterCount]);

  // If morning checkin already saved today → always go to meals tab
  useEffect(() => {
    const checkinToday = weeklyData.some(e => e.date === today);
    if (checkinToday && tab === 'morning') {
      try {
        localStorage.setItem('dailyActiveTab', 'meals');
        localStorage.setItem('dailyActiveTabDate', today);
      } catch {}
      setTab('meals');
    }
  }, [weeklyData, today]);

  // Программа «Месяц 1»: прогресс, раскрытие карточки на Утре
  const [programProgress, setProgramProgress] = useState<ProgramProgress | null>(null);
  const [programExpanded, setProgramExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadProgramProgress(1).then(p => { if (!cancelled && p) setProgramProgress(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [today]);

  const programDayNum = currentProgramDay(programProgress);
  const programDay = PROGRAM_MONTH1[programDayNum - 1];
  const programDayIsNew = !programProgress || !programProgress.opened_days.includes(programDayNum);

  const handleProgramExpand = () => {
    const next = !programExpanded;
    setProgramExpanded(next);
    if (next && programDayIsNew) {
      // Тап «раскрыла» = день засчитан (правило согласовано)
      logUserEvent('program_day_opened', { month: 1, day: programDayNum, date: localDateStr() }).catch(() => {});
      setProgramProgress(prev => ({
        opened_days: [...(prev?.opened_days ?? []), programDayNum],
        last_day: programDayNum,
        last_opened_at: new Date().toISOString(),
        tasks_done: prev?.tasks_done ?? [],
      }));
    }
  };

  const handleProgramTask = (done: boolean) => {
    logUserEvent(done ? 'program_task_done' : 'program_task_undone', { month: 1, day: programDayNum }).catch(() => {});
    setProgramProgress(prev => prev ? {
      ...prev,
      tasks_done: done
        ? [...prev.tasks_done.filter(d => d !== programDayNum), programDayNum]
        : prev.tasks_done.filter(d => d !== programDayNum),
    } : prev);
  };

  const handleProgramJump = (link: Pick<ProgramLink, 'jump'>) => {
    // returnTo: универсальный «откуда пришли» — «Назад» в меню/на карточке
    // вернёт сюда, на «Утро», независимо от того, какой это день программы.
    try { localStorage.setItem('inga-menu-jump', JSON.stringify({ ...link.jump, returnTo: 'daily' })); } catch {}
    setStep('menu');
  };

  // Копилка лёгкости: сумма за текущий месяц
  useEffect(() => {
    let cancelled = false;
    loadLightSavings(today.slice(0, 7)).then(s => {
      if (!cancelled && s) setLightSavings(s);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [today]);




  const handleSaveMorning = async () => {
    if (!morningReady || morningSaving.current) return;
    const number = (value: string) => Number(value.replace(',', '.'));
    if ((weight && (!Number.isFinite(number(weight)) || number(weight) <= 0 || number(weight)>999.9)) ||
        (sleep && (!Number.isFinite(number(sleep)) || number(sleep)<0 || number(sleep)>24)) ||
        (steps && (!Number.isInteger(number(steps)) || number(steps)<0))) {
      toast.error('Проверьте введённые показатели.'); return;
    }
    morningSaving.current=true; setMorningBusy(true);
    const savedOwner=owner, savedDate=today;
    try {
      await addWeightEntry(today, morningDirty.current.has('weight') && weight ? number(weight) : undefined, {
        sleepHours:morningDirty.current.has('sleep') && sleep ? number(sleep) : undefined,
        stepsYesterday:morningDirty.current.has('steps') && steps ? number(steps) : undefined,
        stoolYesterday:morningDirty.current.has('stool') ? stool : undefined,
      });
      if (currentSession()?.user.id !== savedOwner || localDay() !== savedDate) return;
      morningDirty.current.clear();
    } catch { toast.error('Не удалось сохранить показатели. Повторите попытку.'); return; }
    finally { morningSaving.current=false; setMorningBusy(false); }
    if (weight) {
      const w = number(weight);
      // Build history excluding today's just-added entry to avoid self-comparison
      const history = weeklyData.filter(e => e.date !== today);
      const yesterdayDateStr = localDay(new Date(Date.now() - 86400000));
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
      }
    } else {
      setMorningAnalysis(null);
      setTab('meals');
    }
  };

  const handleEnterFixation = async () => {
    if (enteringFixation) return;
    setEnteringFixation(true);
    try {
      await performFixationAction({ action:'enter' });
      setShowGoalReached(false);
      handleProgramJump({ jump: { section:'how-to', nutrientSection:'Фиксация' } });
    } catch { toast.error('Не удалось сохранить изменения. Повторите попытку.'); }
    finally { setEnteringFixation(false); }
  };

  const openMaintenanceLesson = () => {
    handleProgramJump({ jump: { section:'how-to', nutrientSection:'Сохранение' } });
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

  // Metadata patches do not rewrite datetime or unrelated metadata.
  const persistMetaPatch = (idx: number, partial: Record<string, unknown>) => {
    const row=mealMeta[idx];
    if (row) void diary.patch(row.id, {meta:partial});
  };
  const addMealEntry = async (
    text: string, isEvening=false, timeOverride?:string, lightSwap?:LightSwapMeta,
    initialFlags?:{protein:boolean;carbs:boolean;fiber:boolean;sweet:boolean},
  ) => {
    const t=text.trim();
    if (!t) return false;
    const time=timeOverride || nowHHMM();
    const name=isEvening?'Вечерний перекус':mealNameByTime(time);
    const meta:Record<string,unknown>={isEvening,proteinPortion:'palm',proteinAi:null,proteinManual:false,sweet:!!initialFlags?.sweet,...(lightSwap?{lightSwap}:{})};
    for (const key of ['protein','carbs','fiber'] as const) {
      if (draftTouched.current.has(key)) {meta[key]=!!initialFlags?.[key];meta[`${key}FlagManual`]=true;}
    }
    const ok=await diary.add(t,mealTagFromName(name),timeToIso(time),meta);
    if (!ok) return false;
    // Обучающая подсказка о лёгкой замене — только для обычной еды,
    // не для записей «Из лёгких рецептов». Лимиты и «Не сейчас» — в swap-base.
    if (!lightSwap) {
      const stage = profile.currentStage ?? 'loss';
      const pair = findSwapHint(t, stage);
      if (pair) {
        registerHintShown();
        setPendingHint({ pair, revealed: false });
      }
    }
    return true;
  };

  // Запись еды из лёгкого рецепта: реальная еда → зачёт в Копилку лёгкости.
  // Зачёт = classicKcal − lightKcal рецепта (согласовано; начислений за клики нет).
  // Выбор лёгкого рецепта в окне ввода: название дописывается в текст приёма,
  // зачёт (разница классика−лёгкая × типичная порция) прикрепится к записи при сохранении.
  const pickLightRecipe = (recipe: LightRecipeEntry) => {
    const savedKcal = Math.round((recipe.classicKcal - recipe.lightKcal) * recipe.portionGrams / 100);
    setMealText(prev => prev.trim() ? `${prev.trim()}, ${recipe.name}` : recipe.name);
    setDraftLightSwaps(prev => [...prev, { recipeId: recipe.recipeId, name: recipe.name, savedKcal }]);
    setShowLightPicker(false);
    setLightPickerQuery('');
  };

  const removeDraftLightSwap = (idx: number) => {
    setDraftLightSwaps(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddMeal = async () => {
    if (mealText.trim()) {
      const lightSwap: LightSwapMeta | undefined = draftLightSwaps.length
        ? {
            recipeIds: draftLightSwaps.map(s => s.recipeId),
            savedKcal: draftLightSwaps.reduce((sum, s) => sum + s.savedKcal, 0),
          }
        : undefined;
      if (!await addMealEntry(mealText.trim(), false, mealTime, lightSwap, draftFlags)) return;
      if (lightSwap) {
        // Оптимистично обновляем копилку на экране
        setLightSavings(prev => ({
          total_kcal: (prev?.total_kcal ?? 0) + lightSwap.savedKcal,
          swaps_count: (prev?.swaps_count ?? 0) + draftLightSwaps.length,
        }));
      }
      setMealText('');
      setMealTime(nowHHMM());
      setDraftFlags(emptyDraftFlags); draftTouched.current.clear();
      setDraftLightSwaps([]);
      setShowMealInput(false);
    }
  };

  const handleAddEveningMeal = async () => {
    if (eveningText.trim()) {
      if (!await addMealEntry(eveningText.trim(), true, undefined, undefined, draftFlags)) return;
      setEveningText('');
      setDraftFlags(emptyDraftFlags); draftTouched.current.clear();
      setShowEveningInput(false);
    }
  };

  const updateMealTime = (i:number, newTime:string) => {
    const row=mealMeta[i]; if (!row || !newTime) return;
    const d=new Date(row.datetime); const [h,m]=newTime.split(':').map(Number); d.setHours(h,m);
    void diary.patch(row.id,{datetime:d.toISOString(),mealTag:mealTagFromName(row.isEvening?'Вечерний перекус':mealNameByTime(newTime))});
  };
  const toggleMealFlag = (i:number,key:'protein'|'carbs'|'fiber'|'sweet') => {
    persistMetaPatch(i,{[key]:!mealMeta[i]?.[key],...(key!=='sweet'?{[`${key}FlagManual`]:true}:{})});
  };

  const startNewDay = () => { setShowPlanning(false); setTab('meals'); };

  if (showPlanning) {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <div className="inga-bubble mb-6 w-full max-w-sm space-y-4">
          <h2 className="text-xl font-bold">План на завтра</h2>
          <p className="text-sm text-muted-foreground">
            Знаете, что сильно помогает не срываться? Планирование еды накануне.
            Постарайтесь сегодня вечером заранее продумать, что вы будете есть завтра
            на завтрак, обед, ужин и перекусы. Так вы не останетесь один на один с голодом и случайной едой.
          </p>

          <div className="inga-card">
            <p className="font-semibold mb-2 text-sm">Как планировать</p>
            <p className="text-sm text-muted-foreground">
              Запланируйте, что у вас будет в качестве белка, клетчатки и углеводов
              в каждом приёме пищи, включая перекусы.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Также подумайте, что вы будете есть на Сладкую точку:
              десерт до 100 ккал/100 г или ягоды/фрукты.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Можете даже заранее заказать необходимые продукты или положить
              их в корзину, если покупаете онлайн.
            </p>
          </div>

          <button onClick={startNewDay} className="inga-btn-primary w-full">
            Вернуться к питанию →
          </button>
        </div>
      </div>
    );
  }

  const facts = mealFacts(mealMeta, profile.weight);
  const proteinGrams = facts.protein;
  const proteinTarget = facts.proteinTarget;
  const anyProteinLoading = mealMeta.some(m=>m.proteinLoading);

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 pb-[80px] animate-fade-in-up" style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
      {showGoalReached && (
        <GoalReachedModal sex={profile.gender} onContinue={handleEnterFixation} busy={enteringFixation} />
      )}
      {/* Header: date + day badge */}
      <div className="w-full max-w-sm flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">{dateLabel}</span>
        <div className="flex items-center gap-2">
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
          День {programDayNum}
        </span>
        <button
          onClick={() => setStep('menu')}
          className="text-sm font-semibold"
          style={{
            background: '#fff',
            color: '#FF6200',
            border: '1px solid #FFD9C2',
            borderRadius: '20px',
            padding: '4px 14px',
          }}
        >
          ☰ Меню
        </button>
        </div>
      </div>

      {diary.loading && <p role="status" className="text-sm mb-3">Загружаем дневник…</p>}
      {diary.error && <div className="inga-card mb-3"><p>Не удалось загрузить дневник.</p><button onClick={diary.retry} className="inga-btn-secondary">Повторить</button></div>}
      {diary.analysisLimit && <p role="alert" className="inga-bubble mb-3">{DIARY_AI_LIMIT_MESSAGE}</p>}
      {!diary.loading && diary.pending===0 && mealMeta.some(m=>m.nutritionVersion!==3) && <button onClick={diary.retry} className="text-sm underline mb-3">Повторить оценку состава</button>}
      {/* Tab navigation */}
      <div className="flex gap-2 mb-6 w-full max-w-sm">
        {(['morning', 'meals', 'analysis'] as DailyTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
          >
            {t === 'morning' ? '🌅 Утро' : t === 'meals' ? '🍽️ Питание' : '🔎 Разбор'}
          </button>
        ))}
      </div>


      <div className="w-full max-w-sm">
        {profile.currentStage === 'fixation' && <div className="mb-5"><FixationProgressCard onMaintenance={openMaintenanceLesson} onLesson={() => handleProgramJump({ jump: { section:'how-to', nutrientSection:'Фиксация' } })} /></div>}
        {tab === 'morning' && (
          <div className="space-y-4 animate-fade-in-up">
            {!showFoodSurvey && programDay && (
              <ProgramDayCard
                data={programDay}
                expanded={programExpanded}
                taskDone={Boolean(programProgress?.tasks_done.includes(programDayNum))}
                onToggleExpand={handleProgramExpand}
                onTaskToggle={handleProgramTask}
                onJump={handleProgramJump}
                badge={programDayIsNew ? 'Новое' : undefined}
              />
            )}
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
                      <span className="font-semibold">{profile.name || 'Привет'}</span>, прежде чем начнём — скажите, что вы точно не хотите убирать из меню?
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">Выберите всё, что любите, — я покажу лёгкую версию.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {FOOD_PREFERENCE_OPTIONS.map(opt => {
                    const active = selectedFoods.includes(opt.label);
                    return (
                      <button
                        key={opt.label}
                        disabled={saving}
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

                {saveError && <p role="alert" className="inga-bubble">{SAVE_ERROR}</p>}
                <button
                  onClick={handleSubmitFoodSurvey}
                  disabled={saving || selectedFoods.length === 0}
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

            {foodSurveyAnswered && (() => {
              const ids: string[] = [];
              let hasEmptyCategory = false;
              for (const cat of selectedFoods) {
                const rs = CATEGORY_RECIPES[cat] ?? [];
                if (rs.length === 0) hasEmptyCategory = true;
                for (const id of rs) if (!ids.includes(id)) ids.push(id);
              }
              const cards = ids
                .map(id => LIGHT_RECIPES.find(r => r.recipeId === id))
                .filter((r): r is LightRecipeEntry => !!r)
                .slice(0, 3);
              const openRecipe = (r: LightRecipeEntry) => {
                try { localStorage.setItem('inga-menu-jump', JSON.stringify({ section: 'recipes', recipeSection: r.recipeSection, activeRecipe: r.recipeId, returnTo: 'daily' })); } catch {}
                setStep('menu');
              };
              const openLightVersion = () => {
                try { localStorage.setItem('inga-menu-jump', JSON.stringify({ section: 'light-version', returnTo: 'daily' })); } catch {}
                setStep('menu');
              };
              return (
                <div className="space-y-3 animate-fade-in-up">
                  {cards.map(r => (
                    <div key={r.recipeId} className="inga-card">
                      <p className="font-semibold text-sm mb-2">«{r.name}»</p>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="flex-1 text-center bg-muted rounded-xl py-1.5 px-1">
                          <p className="text-[11px] text-muted-foreground">{r.classicLabel}</p>
                          <p className="text-base text-muted-foreground line-through">~{r.classicKcal} ккал</p>
                        </div>
                        <span className="text-primary shrink-0">→</span>
                        <div className="flex-1 text-center bg-primary/10 rounded-xl py-1.5 px-1">
                          <p className="text-[11px] text-primary">ваша версия</p>
                          <p className="text-base font-bold text-primary">{r.lightKcal} ккал</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {timesLighter(r.classicKcal, r.lightKcal).replace(/^в/, 'В')}{r.tagline ? ` — ${r.tagline}` : ''}
                      </p>
                      <button onClick={() => openRecipe(r)} className="inga-btn-secondary w-full text-sm">Открыть рецепт</button>
                    </div>
                  ))}
                  {hasEmptyCategory && (
                    <div className="inga-bubble">
                      <p className="text-sm">Рецепты скоро появятся! А пока спросите меня в чате, я подскажу замену</p>
                      <button onClick={() => setStep('chat')} className="inga-btn-secondary w-full mt-2 text-sm">Спросить Ингу</button>
                    </div>
                  )}
                  <button onClick={openLightVersion} className="inga-btn-primary w-full">
                    Смотреть все лёгкие версии
                  </button>
                </div>
              );
            })()}

            {foodSurveyAnswered && showMorningCheckin && (
              <p className="text-center text-xs text-muted-foreground italic py-2">
                — А теперь — утренний чек-ин —
              </p>
            )}

            {showCheckinFields && (<>
            <h3 className="text-xl font-bold">Доброе утро! ☀️</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Вес сегодня (кг)</label>
              <input disabled={morningBusy} type="number" value={weight} onChange={e => {
                morningDirty.current.add('weight'); setWeight(e.target.value);
                setMorningAnalysis(null);
              }} className="inga-input" placeholder="70.5" step="0.1" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Сколько часов вы спали?</label>
              <input disabled={morningBusy} type="number" value={sleep} onChange={e => {morningDirty.current.add('sleep');setSleep(e.target.value);setMorningAnalysis(null);}} className="inga-input" placeholder="7" step="0.5" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Шаги вчера</label>
              <input disabled={morningBusy} type="number" value={steps} onChange={e => {morningDirty.current.add('steps');setSteps(e.target.value);setMorningAnalysis(null);}} className="inga-input" placeholder="6000" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Вчера был стул?</label>
              <div className="flex gap-3">
                <button
                  disabled={morningBusy} onClick={() => {morningDirty.current.add('stool');setStool(true);setMorningAnalysis(null);}}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${stool === true ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}
                >
                  Да
                </button>
                <button
                  disabled={morningBusy} onClick={() => {morningDirty.current.add('stool');setStool(false);setMorningAnalysis(null);}}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${stool === false ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}
                >
                  Нет
                </button>
              </div>
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
              <button disabled={!morningReady || morningBusy} onClick={handleSaveMorning} className="inga-btn-primary w-full">
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
          const pct = (v:number,t:number) => Math.min(100,Math.round(v/Math.max(1,t)*100));
          const regular = mealMeta.map((m, i) => ({ ...m, i, desc: meals[i] })).filter(m => !m.isEvening);
          const evening = mealMeta.map((m, i) => ({ ...m, i, desc: meals[i] })).filter(m => m.isEvening);

          const removeMeal = (idx:number) => { const row=mealMeta[idx]; if(row)void diary.remove(row.id); };
          const setMealPortion = (idx:number,portion:ProteinPortion) => {
            const grams={small:15,palm:25,large:40};
            persistMetaPatch(idx,{proteinPortion:portion,proteinAi:grams[portion],proteinManual:true});
          };

          const saveManualProtein = (idx: number, value: string) => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n >= 0 && n < 500) {
              persistMetaPatch(idx, { proteinAi: n, proteinManual: true });
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
                      disabled={diary.pending>0} onClick={() => setEditingTimeIdx(m.i)}
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
                  disabled={diary.pending>0} onClick={() => setConfirmDeleteIndex(m.i)}
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
                  <span>... оценка состава</span>
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
              <div className="flex flex-wrap gap-1.5 mb-2 items-center">
                <button disabled={diary.pending>0} onClick={() => toggleMealFlag(m.i, 'protein')} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={pillStyle(m.protein, 'protein')}>
                  {m.protein === null ? '?' : m.protein ? '✓' : '+'} Белок
                </button>
                {!hideCarbs && (
                  <button disabled={diary.pending>0} onClick={() => toggleMealFlag(m.i, 'carbs')} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={pillStyle(m.carbs, 'carbs')}>
                    {m.carbs === null ? '?' : m.carbs ? '✓' : '+'} Углеводы
                  </button>
                )}
                <button disabled={diary.pending>0} onClick={() => toggleMealFlag(m.i, 'fiber')} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={pillStyle(m.fiber, 'fiber')}>
                  {m.fiber === null ? '?' : m.fiber ? '✓' : '+'} Клетчатка
                </button>
                {!m.isEvening && (
                  <button
                    disabled={diary.pending>0} onClick={() => toggleMealFlag(m.i, 'sweet')}
                    className="text-[11px] font-medium"
                    style={{ color: m.sweet ? '#CF7B5A' : '#8A7A70', background: 'transparent', border: 'none', padding: 0 }}
                  >
                    🍰 {m.sweet ? 'Сладкая точка ✓' : '+ Сладкая точка'}
                  </button>
                )}
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
                          disabled={diary.pending>0} onClick={() => setMealPortion(m.i, opt.key)}
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
                    placeholder="Что вы ели?"
                    onKeyDown={e => e.key === 'Enter' && handleAddMeal()}
                  />
                  <VoiceInput
                    onConfirm={async(text) => { if(await addMealEntry(text,false,mealTime,undefined,draftFlags)){setDraftFlags(emptyDraftFlags);draftTouched.current.clear();setDraftLightSwaps([]);} }}
                    onEdit={(text) => setMealText(text)}
                  />
                </div>
                <button
                  onClick={() => setShowLightPicker(true)}
                  className="text-xs font-medium"
                  style={{ color: '#FF6200', background: 'transparent', border: 'none', padding: 0 }}
                >
                  📋 Из лёгких рецептов
                </button>
                {draftLightSwaps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {draftLightSwaps.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => removeDraftLightSwap(i)}
                        className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                        style={{ background: '#FFF1E8', color: '#FF6200', border: '1px solid #FFD9C2' }}
                        title="Убрать"
                      >
                        {s.name} +{s.savedKcal} 🪙 ✕
                      </button>
                    ))}
                  </div>
                )}
                {showMealHint && (
                  <div className="text-xs leading-relaxed" style={{ background: '#FFF7F0', border: '1px solid #FFD9C2', borderRadius: 10, padding: '8px 10px', color: '#6A5A50' }}>
                    Источники белка, углеводов и клетчатки определяются по описанию блюда. Проверьте отметки и при необходимости поправьте их. «Из лёгких рецептов» — если готовили по нашему рецепту, впишем экономию в Копилку лёгкости.
                    <button onClick={dismissMealHint} className="block mt-1.5 font-semibold" style={{ color: '#FF6200', background: 'transparent', border: 'none', padding: 0 }}>
                      Понятно
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 items-center">
                  <button onClick={() => toggleDraftFlag('protein')} className="text-xs px-3 py-1 rounded-full font-medium" style={pillStyle(draftFlags.protein, 'protein')}>
                    {draftFlags.protein ? '✓' : '+'} Белок
                  </button>
                  <button onClick={() => toggleDraftFlag('carbs')} className="text-xs px-3 py-1 rounded-full font-medium" style={pillStyle(draftFlags.carbs, 'carbs')}>
                    {draftFlags.carbs ? '✓' : '+'} Углеводы
                  </button>
                  <button onClick={() => toggleDraftFlag('fiber')} className="text-xs px-3 py-1 rounded-full font-medium" style={pillStyle(draftFlags.fiber, 'fiber')}>
                    {draftFlags.fiber ? '✓' : '+'} Клетчатка
                  </button>
                  <button onClick={() => toggleDraftFlag('sweet')} className="text-xs font-medium" style={{ color: draftFlags.sweet ? '#CF7B5A' : '#8A7A70', background: 'transparent', border: 'none', padding: 0 }}>
                    🍰 {draftFlags.sweet ? 'Сладкая точка ✓' : '+ Сладкая точка'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button disabled={diary.loading || diary.error} onClick={handleAddMeal} className="inga-btn-primary flex-1">Добавить</button>
                  <button onClick={() => { setShowMealInput(false); setMealText(''); setDraftFlags(emptyDraftFlags); draftTouched.current.clear(); setDraftLightSwaps([]); }} className="inga-btn-secondary flex-1">Отмена</button>
                </div>
              </div>
            )}

            {/* Обучающая подсказка о лёгкой замене */}
            {pendingHint && (
              <div className="bg-white animate-fade-in-up" style={{ borderRadius: 14, border: '1px solid #FFD9C2', padding: 14 }}>
                {!pendingHint.revealed ? (
                  <>
                    <p className="text-sm mb-3" style={{ color: '#2C1A0E' }}>💡 {HINT_TEXTS.teaser}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPendingHint(h => h ? { ...h, revealed: true } : h)}
                        className="inga-btn-primary flex-1 text-sm py-2"
                      >
                        {HINT_TEXTS.showButton}
                      </button>
                      <button
                        onClick={() => { muteSwapPair(pendingHint.pair.id); setPendingHint(null); }}
                        className="inga-btn-secondary flex-1 text-sm py-2"
                      >
                        {HINT_TEXTS.laterButton}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold tracking-wide mb-2" style={{ color: '#8A7A70' }}>{HINT_TEXTS.title.toUpperCase()}</p>
                    <p className="text-sm" style={{ color: '#2C1A0E' }}>
                      <span style={{ color: '#8A7A70' }}>{pendingHint.pair.from}</span>
                      {' → '}
                      <span className="font-semibold">{pendingHint.pair.to}</span>
                    </p>
                    <p className="text-sm font-semibold mt-1" style={{ color: '#FF6200' }}>
                      {HINT_TEXTS.savedLabel(pendingHint.pair.savedKcal)}
                    </p>
                    {pendingHint.pair.comment && (
                      <p className="text-xs mt-1" style={{ color: '#8A7A70' }}>{pendingHint.pair.comment}</p>
                    )}
                    {pendingHint.pair.tip && (
                      <p className="text-xs mt-1" style={{ color: '#8A7A70' }}>{pendingHint.pair.tip}</p>
                    )}
                    <button onClick={() => setPendingHint(null)} className="inga-btn-secondary w-full text-sm py-2 mt-3">
                      Понятно
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Выбор лёгкого рецепта для записи в дневник */}
            {showLightPicker && (() => {
              const SECTION_TITLES: Record<string, string> = {
                breakfasts: 'Завтраки', soups: 'Супы', lunches: 'Вторые блюда',
                baking: 'Несладкая выпечка', sweet: 'Сладкая точка', drinks: 'Напитки',
              };
              const SECTION_ORDER = ['breakfasts', 'soups', 'lunches', 'baking', 'sweet', 'drinks'];
              const q = lightPickerQuery.trim().toLowerCase().replace(/ё/g, 'е');
              const matches = (r: LightRecipeEntry) => !q
                || r.name.toLowerCase().replace(/ё/g, 'е').includes(q)
                || r.aliases.some(a => a.toLowerCase().replace(/ё/g, 'е').includes(q));
              const filtered = LIGHT_RECIPES.filter(matches);
              return (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => { setShowLightPicker(false); setLightPickerQuery(''); }}>
                <div
                  className="bg-card rounded-2xl w-full max-w-md shadow-xl animate-fade-in-up flex flex-col"
                  style={{ maxHeight: '75vh' }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="p-5 pb-3">
                    <p className="text-base font-semibold">Из лёгких рецептов</p>
                    <p className="text-xs mt-1" style={{ color: '#8A7A70' }}>
                      Что вы приготовили? Разница с классикой попадёт в Копилку лёгкости.
                    </p>
                    <input
                      value={lightPickerQuery}
                      onChange={e => setLightPickerQuery(e.target.value)}
                      placeholder="Поиск: блины, суп, чизкейк…"
                      className="w-full mt-3 text-sm bg-white"
                      style={{ borderRadius: 10, border: '1px solid #EDE5DF', padding: '8px 12px', outline: 'none' }}
                    />
                  </div>
                  <div className="overflow-y-auto px-5 pb-3 space-y-2">
                    {filtered.length === 0 && (
                      <p className="text-sm py-4 text-center" style={{ color: '#8A7A70' }}>Ничего не нашлось — попробуйте другое слово</p>
                    )}
                    {SECTION_ORDER.map(sec => {
                      const inSection = filtered.filter(r => r.recipeSection === sec);
                      if (inSection.length === 0) return null;
                      return (
                        <div key={sec}>
                          <p className="text-[11px] font-bold tracking-wide mt-2 mb-1" style={{ color: '#A89A8E' }}>
                            {(SECTION_TITLES[sec] || sec).toUpperCase()}
                          </p>
                          <div className="space-y-2">
                            {inSection.map(r => {
                              const saved = Math.round((r.classicKcal - r.lightKcal) * r.portionGrams / 100);
                              const label = r.classicLabel.toLowerCase() === r.name.toLowerCase()
                                ? 'классика' : r.classicLabel;
                              return (
                                <button
                                  key={r.recipeId}
                                  onClick={() => pickLightRecipe(r)}
                                  className="w-full text-left bg-white"
                                  style={{ borderRadius: 12, border: '1px solid #EDE5DF', padding: '10px 12px' }}
                                >
                                  <p className="text-sm font-semibold" style={{ color: '#2C1A0E' }}>{r.name}</p>
                                  <p className="text-xs" style={{ color: '#8A7A70' }}>
                                    {label}: ≈{Math.round(r.classicKcal)} → {Math.round(r.lightKcal)} ккал/100 г
                                  </p>
                                  <p className="text-xs" style={{ color: '#8A7A70' }}>
                                    порция {r.portionGrams} {r.recipeSection === 'drinks' ? 'мл' : 'г'}
                                    <span className="font-semibold ml-1" style={{ color: '#FF6200' }}>+{saved} 🪙</span>
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-5 pt-2">
                    <button onClick={() => { setShowLightPicker(false); setLightPickerQuery(''); }} className="inga-btn-secondary w-full text-sm py-2">Отмена</button>
                  </div>
                </div>
              </div>
              );
            })()}


            <div className="bg-white space-y-3" style={{borderRadius:14,border:'1px solid #EDE5DF',padding:14}}>
              <p className="text-xs font-bold tracking-wide text-muted-foreground">СТРУКТУРА ПИТАНИЯ СЕГОДНЯ</p>
              <div className="space-y-2">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="shrink-0">🥩 Белок</span>
                  <span className="min-w-0 text-right">{anyProteinLoading?'Оценка…':facts.unknownProtein===totalMeals?'Недостаточно данных':`≈${proteinGrams} г${facts.unknownProtein?' в оценённых записях':''}`}{proteinTarget?` · цель ${proteinTarget} г`:''}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{background:'#F2EBE5'}} aria-hidden="true">
                  <div style={{width:`${proteinTarget && facts.unknownProtein<totalMeals ? pct(proteinGrams,proteinTarget) : 0}%`,height:'100%',background:'#CF7B5A',transition:'width 0.3s'}} />
                </div>
              </div>
              {([
                ['🌾 Углеводы',facts.carbs,'#C49A3E'],
                ['🥦 Клетчатка',facts.fiber,'#5E9E72'],
              ] as const).map(([label,group,color])=>(
                <div key={label} className="space-y-2">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="shrink-0">{label}</span>
                    <span className="min-w-0 text-right">{group.count ? `В ${group.count} из ${totalMeals} записей` : group.unknown ? 'Недостаточно данных' : 'Источники не отмечены'}{group.unknown>0 && group.count>0?' · есть неоценённые':''}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{background:'#F2EBE5'}} aria-hidden="true">
                    <div style={{width:`${pct(group.count,totalMeals)}%`,height:'100%',background:color,transition:'width 0.3s'}} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Отметки показывают наличие источников в блюдах, а не выполнение дневной нормы. Их можно поправить вручную.</p>
            </div>

            {/* Копилка лёгкости — свёрнутая строка, детали по тапу */}
            <button
              onClick={() => setCopilkaOpen(o => !o)}
              className="bg-white w-full text-left"
              style={{ borderRadius: 14, border: '1px solid #EDE5DF', padding: '10px 14px' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: '#2C1A0E' }}>
                  <span className="mr-1">🪙</span> {COPILKA_TEXTS.title}
                  <span className="tabular-nums" style={{ color: '#FF6200' }}> · {(lightSavings?.total_kcal ?? 0).toLocaleString('ru-RU')}</span>
                </p>
                <span className="text-xs" style={{ color: '#A89A8E' }}>{copilkaOpen ? '▲' : '▼'}</span>
              </div>
              {copilkaOpen && (
                lightSavings && lightSavings.total_kcal > 0 ? (
                  <div className="mt-2">
                    <p className="text-2xl font-bold tabular-nums" style={{ color: '#FF6200' }}>
                      {lightSavings.total_kcal.toLocaleString('ru-RU')}
                      <span className="text-sm font-medium ml-2" style={{ color: '#8A7A70' }}>{COPILKA_TEXTS.monthLabel}</span>
                    </p>
                    {lightSavings.total_kcal >= 770 && (
                      <p className="text-sm mt-1" style={{ color: '#2C1A0E' }}>
                        {COPILKA_TEXTS.kgLine(kgEquivalent(lightSavings.total_kcal))}
                      </p>
                    )}
                    <p className="text-[11px] mt-2" style={{ color: '#A89A8E' }}>{COPILKA_TEXTS.note}</p>
                  </div>
                ) : (
                  <p className="text-sm mt-2" style={{ color: '#8A7A70' }}>{COPILKA_TEXTS.empty}</p>
                )
              )}
            </button>

            <button onClick={()=>setTab('analysis')} className="inga-btn-secondary w-full">Разбор питания сегодня →</button>

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
              {evening.map(m => <div key={m.i} className="mb-2"><MealCard m={m} /></div>)}
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
                      placeholder="Что вы ели?"
                      onKeyDown={e => e.key === 'Enter' && handleAddEveningMeal()}
                    />
                    <VoiceInput
                      onConfirm={async(text) => { if(await addMealEntry(text,true,undefined,undefined,draftFlags)){setDraftFlags(emptyDraftFlags);draftTouched.current.clear();} }}
                      onEdit={(text) => setEveningText(text)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => toggleDraftFlag('protein')} className="text-xs px-3 py-1 rounded-full font-medium" style={pillStyle(draftFlags.protein, 'protein')}>
                      {draftFlags.protein ? '✓' : '+'} Белок
                    </button>
                    <button onClick={() => toggleDraftFlag('fiber')} className="text-xs px-3 py-1 rounded-full font-medium" style={pillStyle(draftFlags.fiber, 'fiber')}>
                      {draftFlags.fiber ? '✓' : '+'} Клетчатка
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddEveningMeal} className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ background: '#4A3580', color: '#fff' }}>Добавить</button>
                    <button onClick={() => { setShowEveningInput(false); setEveningText(''); setDraftFlags(emptyDraftFlags); draftTouched.current.clear(); }} className="inga-btn-secondary flex-1">Отмена</button>
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
                      <button disabled={diary.pending>0} onClick={() => setConfirmDeleteIndex(null)} className="inga-btn-secondary flex-1 text-sm py-2">
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



        {tab === 'analysis' && <DietAnalysis
          date={today} revision={JSON.stringify([mealMeta,profile.currentStage,profile.weight,profile.goalWeight,profile.currentFixationCalories])}
          ready={!diary.loading && !diary.error && diary.pending===0} mealCount={facts.mealCount}
          protein={facts.protein} unknownProtein={facts.unknownProtein} proteinTarget={facts.proteinTarget}
          onRecipe={recipe=>{localStorage.setItem('inga-menu-jump',JSON.stringify({section:'recipes',recipeSection:recipe.recipeSection,activeRecipe:recipe.recipeId,returnTo:'daily'}));setStep('menu');}}
          onPlan={()=>setShowPlanning(true)} />}
      </div>

      <button
        onClick={() => setStep('menu')}
        className="mt-6 w-full max-w-md inga-btn-secondary font-semibold"
        style={{ borderRadius: 12 }}
      >
        ☰ Открыть меню
      </button>

      {/* Fixed bottom chat panel */}
      <button
        onClick={() => setStep('chat')}
        className="fixed bottom-0 z-50 flex items-center gap-[10px] px-4 py-[14px] bg-white"
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
            Задайте вопрос или расскажите, как проходит день
          </p>
        </div>
        <span className="text-[18px]" style={{ color: '#FF6200' }}>
          ›
        </span>
      </button>
    </div>
  );
}
