import { useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { GlassIcon } from './GlassIcons';
import { useApp } from '@/context/AppContext';
import { loadDiaryHistory, diaryDate, mealTime, diaryValue, stoolValue, printDiary, type DiaryDay } from '@/lib/diary-history';

export function DiaryHistoryScreen({ onBack }: { onBack: () => void }) {
  const { profile } = useApp();
  const [days, setDays] = useState<DiaryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false);
    loadDiaryHistory().then(data => { if (active) setDays(data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  return <div className="min-h-screen px-5 py-8 flex justify-center"><div className="w-full max-w-md space-y-4">
    <button onClick={onBack} className="text-sm text-muted-foreground underline">← Назад</button>
    <h1 className="text-2xl font-bold">Дневник питания</h1>
    {loading ? <p role="status">Загрузка…</p> : error ? <div role="alert" className="inga-bubble">
      <p>Попробуйте ещё раз.</p><button onClick={() => setAttempt(n => n + 1)} className="inga-btn-secondary mt-3">Повторить</button>
    </div> : <>
      <button disabled={!days.length} onClick={() => printDiary(profile.name, days)} className="inga-btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2 text-white"><FileDown size={20} aria-hidden="true" />Скачать дневник питания</button>
      {!days.length && <p className="inga-bubble">Приёмы пищи не записаны</p>}
      {days.map(day => <section key={day.date} className="inga-card">
        <h2 className="font-semibold mb-3">{diaryDate(day.date)}</h2>
        <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
          <span className="inline-flex items-center gap-1 whitespace-nowrap"><GlassIcon name="scale" size={24} />{diaryValue(day.checkin?.weight_kg, ' кг')}</span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap"><GlassIcon name="sleep" size={24} />{diaryValue(day.checkin?.sleep_hours, ' ч')}</span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap"><GlassIcon name="steps" size={24} />{diaryValue(day.checkin?.steps_yesterday)}</span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap"><GlassIcon name="stool" size={24} />Стул: {stoolValue(day.checkin?.stool_yesterday)}</span>
        </div>
        {day.meals.map(meal => <div key={meal.log_id} className="py-2 border-t border-border">
          <span className="text-xs text-muted-foreground">{mealTime(meal.datetime)}</span>
          <p className="text-sm whitespace-pre-wrap">{meal.raw_text}</p>
        </div>)}
        {!day.meals.length && <p className="text-sm text-muted-foreground">Приёмы пищи не записаны</p>}
      </section>)}
    </>}
  </div></div>;
}
