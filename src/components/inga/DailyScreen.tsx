import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { getText } from '@/lib/gender-text';
import { analyzeDailyNutrition } from '@/lib/daily-analysis';
import { analyzeMorningWeight, MorningWeightAnalysis } from '@/lib/morning-analysis';
import { buildGamificationSummary, getMedalStyle } from '@/lib/gamification';
import { Medal } from '@/lib/types';
import { withName, hasName } from '@/lib/user-name';
import { VoiceInput } from './VoiceInput';
import { saveMealPlan, loadMealPlanForDate } from '@/lib/db';
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
  const { setStep, addDailyReport, addWeightEntry, addAwardedMedal, profile, calculations, weeklyData, dailyReports, medals, updateProfile } = useApp();
  const [tab, setTab] = useState<DailyTab>('morning');
  const [weight, setWeight] = useState('');
  const [sleep, setSleep] = useState('');
  const [steps, setSteps] = useState('');
  const [mealText, setMealText] = useState('');
  const [meals, setMeals] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [emotion, setEmotion] = useState('');
  const [hunger, setHunger] = useState(3);
  const [hardest, setHardest] = useState('');
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

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // Russian date string: "Пятница, 13 июня"
  const dateLabel = (() => {
    const raw = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();
  const dayNumber = (dailyReports?.length ?? 0) + 1;

  const showFoodSurvey = !foodSurveyAnswered && (!profile.food_preferences || profile.food_preferences.length === 0);
  const showCheckinFields = !showFoodSurvey || showMorningCheckin;

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


  const handleSaveMorning = () => {
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
      setTab('meals');
    }
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

  const handleAddMeal = () => {
    if (mealText.trim()) {
      setMeals(prev => [...prev, mealText.trim()]);
      setMealText('');
    }
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

    // Show meal-planning intro after the FIRST completed day, only once.
    const introShown = (() => {
      try { return localStorage.getItem(PLANNING_INTRO_KEY) === 'true'; } catch { return false; }
    })();
    const completedDaysBefore = dailyReports.filter(r => r.date !== today).length;
    if (!introShown && completedDaysBefore === 0) {
      setShowPlanning(true);
    } else {
      setSaved(true);
    }
  };

  const finishPlanning = () => {
    try { localStorage.setItem(PLANNING_INTRO_KEY, 'true'); } catch {}
    setShowPlanning(false);
    setPlanSavedMessage(false);
    setSaved(true);
  };

  const handleSavePlan = async () => {
    const text = planText.trim();
    if (!text) {
      finishPlanning();
      return;
    }
    try {
      await saveMealPlan(tomorrow, text);
    } catch {}
    setPlanSavedMessage(true);
  };


  if (showPlanning) {
    const plannedVerb = getText('планировала', 'планировал', profile.gender);
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <div className="inga-bubble mb-6 w-full max-w-sm space-y-4">
          {!planSavedMessage ? (
            <>
              <h2 className="text-xl font-bold">План на завтра</h2>
              <p className="text-sm text-muted-foreground">
                Знаешь, что сильно помогает не срываться? Планирование еды накануне.
              </p>
              <p className="text-sm text-muted-foreground">
                Постарайся вечером заранее подумать, что ты будешь есть завтра: завтрак, обед, ужин и перекусы. Так ты не остаёшься {getText('одна', 'один', profile.gender)} на один с голодом и случайной едой.
              </p>

              <div className="inga-card">
                <p className="font-semibold mb-2 text-sm">Как планировать</p>
                <p className="text-sm text-muted-foreground mb-1">В каждый основной приём пищи добавь:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• нежирный белок</li>
                  <li>• клетчатку / овощи</li>
                  <li>• сложные углеводы</li>
                  {sweetTrigger && <li>• сладкую точку после основного приёма пищи</li>}
                </ul>
                {sweetTrigger && (
                  <p className="text-xs text-muted-foreground italic mt-2">
                    Сладкая точка — не отдельный перекус и не перед сном. Лучше после завтрака, обеда или дневного приёма пищи.
                  </p>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Не нужно расписывать идеально. Достаточно набросать основу — так завтра будет проще держать ритм.
              </p>

              <div>
                <label className="block text-sm font-medium mb-2">Хочешь коротко записать план на завтра?</label>
                <textarea
                  value={planText}
                  onChange={e => setPlanText(e.target.value)}
                  className="inga-input min-h-[96px] resize-none"
                  placeholder="Например: завтрак — омлет и овощи, обед — курица с гречкой, ужин — рыба с салатом"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={handleSavePlan} className="inga-btn-primary flex-1">
                  Сохранить план
                </button>
                <button onClick={finishPlanning} className="inga-btn-secondary flex-1">
                  Пропустить
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-base">
                Отлично. Завтра у тебя уже есть опора — это сильно упрощает день.
              </p>
              <button onClick={finishPlanning} className="inga-btn-primary w-full">
                Продолжить →
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <div className="inga-bubble mb-6 w-full max-w-sm space-y-4">
          <p className="text-lg font-semibold">
            {analysis.obstacles.length >= 2 && hasName(profile.name)
              ? withName(profile.name, 'день был непростой. Давай не усложнять — завтра вернёмся в ритм с одного простого шага.')
              : 'Я посмотрела твой день.'}
          </p>

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

          {analysis.good.length > 0 && (
            <div>
              <p className="font-semibold mb-1">Что было хорошо</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {analysis.good.map(item => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          )}

          <div>
            <p className="font-semibold mb-1">Что мешает снижению веса</p>
            {analysis.obstacles.length > 0 ? (
              <ul className="text-sm text-muted-foreground space-y-1">
                {analysis.obstacles.map(item => <li key={item}>• {item}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Я не вижу явных моментов, которые сильно мешали бы цели сегодня.</p>
            )}
            <p className="text-sm text-muted-foreground mt-2">{analysis.conclusion}</p>
          </div>

          {analysis.swaps.length > 0 && (
            <div>
              <p className="font-semibold mb-1">Мягкие замены на завтра</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {analysis.swaps.map(s => (
                  <li key={s.from}>• <span className="font-medium text-foreground">{s.from}</span> → {s.to} <span className="opacity-70">({s.why})</span></li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-2 italic">Не убираем любимое — просто заменяем на вариант, который лучше подходит цели.</p>
            </div>
          )}

          <div>
            <p className="font-semibold mb-1">Что сделать завтра</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {analysis.steps.map(item => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        </div>
        <div className="flex gap-3 w-full max-w-sm">
          <button
            onClick={() => {
              setSaved(false);
              setTab('morning');
              setMeals([]);
              setMealText('');
              setWeight('');
              setSleep('');
              setSteps('');
              setEmotion('');
              setHunger(3);
              setHardest('');
              setMorningAnalysis(null);
              setAwardedMedal(null);
              setShowPlanning(false);
              setPlanText('');
              setPlanSavedMessage(false);
            }}
            className="inga-btn-secondary flex-1"
          >
            Новый день
          </button>
          <button onClick={() => setStep('menu')} className="inga-btn-primary flex-1">
            Меню
          </button>
        </div>
        <button
          onClick={() => setStep('chat')}
          className="mt-3 w-full max-w-sm inga-btn-secondary"
        >
          💬 Обсудить с Ингой
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
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


        {tab === 'meals' && (
          <div className="space-y-4 animate-fade-in-up">
            <DailySummaryCard
              meals={meals}
              date={today}
              calorieTarget={calculations?.totalCalories ?? null}
              goalWeightKg={profile.goalWeight}
            />
            <h3 className="text-xl font-bold">{getText('Что ты ела сегодня?', 'Что ты ел сегодня?', profile.gender)}</h3>
            <p className="text-sm text-muted-foreground">Запиши каждый приём пищи</p>

            {yesterdayPlan && (
              <div className="inga-bubble text-sm space-y-1">
                <p className="text-muted-foreground">
                  Вчера ты {getText('планировала', 'планировал', profile.gender)} на сегодня:
                </p>
                <p className="font-medium whitespace-pre-wrap">{yesterdayPlan}</p>
                <p className="text-xs text-muted-foreground italic">
                  Можно идти по плану или изменить его по ситуации.
                </p>
              </div>
            )}

            {meals.map((m, i) => {
              const isEditing = editingIndex === i;
              const isConfirmingDelete = confirmDeleteIndex === i;
              return (
                <div key={i} className="inga-card text-sm space-y-2">
                  {isEditing ? (
                    <>
                      <input
                        value={editingText}
                        onChange={e => setEditingText(e.target.value)}
                        autoFocus
                        className="inga-input"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && editingText.trim()) {
                            setMeals(prev => prev.map((mm, idx) => idx === i ? editingText.trim() : mm));
                            setEditingIndex(null);
                          }
                          if (e.key === 'Escape') setEditingIndex(null);
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (!editingText.trim()) return;
                            setMeals(prev => prev.map((mm, idx) => idx === i ? editingText.trim() : mm));
                            setEditingIndex(null);
                          }}
                          className="inga-btn-primary text-xs py-1.5 px-3 flex-1"
                        >
                          Сохранить
                        </button>
                        <button
                          onClick={() => setEditingIndex(null)}
                          className="inga-btn-secondary text-xs py-1.5 px-3 flex-1"
                        >
                          Отмена
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground italic">Анализ дня обновится после сохранения.</p>
                    </>
                  ) : isConfirmingDelete ? (
                    <>
                      <p>Удалить этот приём пищи?</p>
                      <p className="text-xs text-muted-foreground italic">«{m}»</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setMeals(prev => prev.filter((_, idx) => idx !== i));
                            setConfirmDeleteIndex(null);
                          }}
                          className="inga-btn-primary text-xs py-1.5 px-3 flex-1"
                        >
                          Да, удалить
                        </button>
                        <button
                          onClick={() => setConfirmDeleteIndex(null)}
                          className="inga-btn-secondary text-xs py-1.5 px-3 flex-1"
                        >
                          Отмена
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex-1">✅ {m}</span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => { setEditingIndex(i); setEditingText(m); setConfirmDeleteIndex(null); }}
                          className="text-xs px-2 py-1 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
                          aria-label="Изменить"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteIndex(i); setEditingIndex(null); }}
                          className="text-xs px-2 py-1 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
                          aria-label="Удалить"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex gap-2">
              <input
                value={mealText}
                onChange={e => setMealText(e.target.value)}
                className="inga-input flex-1"
                placeholder="Овсянка с ягодами..."
                onKeyDown={e => e.key === 'Enter' && handleAddMeal()}
              />
              <VoiceInput
                onConfirm={(text) => setMeals(prev => [...prev, text])}
                onEdit={(text) => setMealText(text)}
              />
              <button onClick={handleAddMeal} className="inga-btn-primary px-4">+</button>
            </div>

            <button onClick={() => setTab('evening')} className="inga-btn-secondary w-full">
              Перейти к вечернему итогу →
            </button>
          </div>
        )}

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
              <label className="block text-sm font-medium mb-1">Что было самым сложным?</label>
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

      {/* Floating chat button — anchored to app container on desktop, corner on mobile */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center">
        <div className="relative w-full max-w-md">
          <button
            onClick={() => setStep('chat')}
            aria-label="Открыть чат с Ингой"
            className="pointer-events-auto absolute bottom-6 right-4 sm:right-2 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-2xl hover:scale-105 transition-transform"
          >
            💬
          </button>
        </div>
      </div>
    </div>
  );
}
