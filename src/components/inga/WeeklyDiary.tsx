import { useEffect, useState } from 'react';
import { loadDiaryHistory, diaryDate, type DiaryDay } from '@/lib/diary-history';
import { sessionSnapshot, isSessionCurrent } from '@/lib/auth-storage';

// Read-only presentation: seven local diary dates, including the selected day.
// Never infer nutrition targets, missing measurements or an AI weekly analysis.
export function lastSevenDays(date: string, days: DiaryDay[]): DiaryDay[] {
  const end = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(end.getTime())) return [];
  const byDate = new Map(days.map(day=>[day.date,day]));
  return Array.from({length:7},(_,i)=>{
    const d = new Date(end); d.setUTCDate(end.getUTCDate()-6+i);
    const key = d.toISOString().slice(0,10);
    return byDate.get(key) ?? {date:key, meals:[]};
  });
}
export function WeeklyDiary({ date, revision }: {date:string;revision:string}) {
  const [rows,setRows] = useState<DiaryDay[] | null>(null);
  const [error,setError] = useState(false);
  const [attempt,setAttempt] = useState(0);
  const snapshot = sessionSnapshot();
  useEffect(()=>{
    let active = true;
    const session = sessionSnapshot();
    setRows(null); setError(false);
    if (session.owner) {
      loadDiaryHistory().then(data=>{
        if (active && isSessionCurrent(session)) setRows(lastSevenDays(date,data));
      }).catch(()=>{ if (active && isSessionCurrent(session)) setError(true); });
    }
    return ()=>{active=false;};
  },[date,revision,attempt,snapshot.generation,snapshot.owner]);
  const recorded = rows?.filter(day=>day.meals.length>0).length ?? 0;
  const total = rows?.reduce((n,d)=>n+d.meals.length,0) ?? 0;
  return <section className="space-y-3" aria-label="Сводка за неделю">
    <h3 className="text-xl font-bold">Последние 7 дней</h3>
    <p className="text-sm text-muted-foreground">Сводка по сохранённым записям дневника. Дни без записей не означают, что вы ничего не ели.</p>
    {error ? <div className="inga-card"><p role="alert">Не удалось загрузить дневник.</p><button className="inga-btn-secondary mt-3" onClick={()=>setAttempt(n=>n+1)}>Повторить</button></div> : !rows ? <p role="status">Загружаем дневник…</p> : <>
      <div className="inga-card legche-week-summary"><div><span className="text-sm text-muted-foreground">Дней с записями</span><strong>{recorded} / 7</strong></div><div><span className="text-sm text-muted-foreground">Приёмов пищи</span><strong>{total}</strong></div></div>
      {rows.map(day=><div className="inga-card legche-week-row" key={day.date}><div className="flex items-center justify-between gap-2"><h4 className="font-semibold">{diaryDate(day.date)}</h4><span className="text-sm text-muted-foreground">{day.meals.length ? `Записей: ${day.meals.length}` : 'Нет записей'}</span></div>{day.checkin?.weight_kg != null && <p className="text-sm">Вес: {day.checkin.weight_kg} кг</p>}{day.checkin?.sleep_hours != null && <p className="text-sm">Сон: {day.checkin.sleep_hours} ч</p>}{day.checkin?.steps_yesterday != null && <p className="text-sm">Шаги вчера: {day.checkin.steps_yesterday}</p>}</div>)}
    </>}
  </section>;
}
