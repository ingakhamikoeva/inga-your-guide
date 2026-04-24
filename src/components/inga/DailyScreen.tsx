import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { getText } from '@/lib/gender-text';
import { analyzeDailyNutrition } from '@/lib/daily-analysis';

type DailyTab = 'morning' | 'meals' | 'evening';

export function DailyScreen() {
  const { setStep, addDailyReport, addWeightEntry, profile, calculations } = useApp();
  const [tab, setTab] = useState<DailyTab>('morning');
  const [weight, setWeight] = useState('');
  const [sleep, setSleep] = useState('');
  const [steps, setSteps] = useState('');
  const [mealText, setMealText] = useState('');
  const [meals, setMeals] = useState<string[]>([]);
  const [emotion, setEmotion] = useState('');
  const [hunger, setHunger] = useState(3);
  const [hardest, setHardest] = useState('');
  const [saved, setSaved] = useState(false);
  const analysis = analyzeDailyNutrition(meals, profile.gender);

  const today = new Date().toISOString().slice(0, 10);

  const handleSaveMorning = () => {
    if (weight) addWeightEntry(today, parseFloat(weight));
    setTab('meals');
  };

  const handleAddMeal = () => {
    if (mealText.trim()) {
      setMeals(prev => [...prev, mealText.trim()]);
      setMealText('');
    }
  };

  const handleSaveEvening = () => {
    addDailyReport({
      date: today,
      weight: weight ? parseFloat(weight) : undefined,
      sleepHours: sleep ? parseFloat(sleep) : undefined,
      stepsYesterday: steps ? parseInt(steps) : undefined,
      meals: meals.map((m, i) => ({ time: '', description: m, type: 'snack' as const })),
      eveningEmotion: emotion,
      hungerLevel: hunger,
      hardestPart: hardest,
    });
    setSaved(true);
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <div className="inga-bubble mb-6 w-full max-w-sm space-y-4">
          <p className="text-lg font-semibold">Я посмотрела твой день.</p>

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
            }}
            className="inga-btn-secondary flex-1"
          >
            Новый день
          </button>
          <button onClick={() => setStep('menu')} className="inga-btn-primary flex-1">
            Меню
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
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
            <div className="inga-bubble">
              <p className="text-sm text-muted-foreground">Вес может колебаться по разным причинам. Мы смотрим не на день, а на тенденцию.</p>
            </div>
            <button onClick={handleSaveMorning} className="inga-btn-primary w-full">
              Сохранить →
            </button>
          </div>
        )}

        {tab === 'meals' && (
          <div className="space-y-4 animate-fade-in-up">
            <h3 className="text-xl font-bold">{getText('Что ты ела сегодня?', 'Что ты ел сегодня?', profile.gender)}</h3>
            <p className="text-sm text-muted-foreground">Запиши каждый приём пищи</p>

            {meals.map((m, i) => (
              <div key={i} className="inga-card text-sm">✅ {m}</div>
            ))}

            <div className="flex gap-2">
              <input
                value={mealText}
                onChange={e => setMealText(e.target.value)}
                className="inga-input flex-1"
                placeholder="Овсянка с ягодами..."
                onKeyDown={e => e.key === 'Enter' && handleAddMeal()}
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
    </div>
  );
}
