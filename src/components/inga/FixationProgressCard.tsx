import { useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { localDay } from '@/lib/achievement-client';
import { fixationEquilibrium } from '@/lib/fixation';

export function FixationProgressCard({ onMaintenance, onLesson }: { onMaintenance: () => void; onLesson: () => void }) {
  const { profile, weeklyData, performFixationAction } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const today = localDay();
  const goal = profile.goalWeight;
  const progress = profile.fixationProgress;
  const goalChanged = progress && progress.goalWeight !== goal;
  const equilibrium = progress?.equilibriumCalories ?? fixationEquilibrium(profile, weeklyData, today);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
  const weights = weeklyData.filter(entry => entry.date >= localDay(weekStart) && entry.date <= today
    && Number.isFinite(entry.weight) && entry.weight > 0).sort((a,b) => a.date.localeCompare(b.date));
  const latest = weights.at(-1);
  const canComplete = !!goal && latest?.date === today && Math.abs(latest.weight - goal) <= 1;
  const run = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      await performFixationAction(goalChanged ? {action:'enter'} : {action:'complete',confirmed:true});
      if (goalChanged) onLesson(); else onMaintenance();
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(code === 'fresh_weight_required' ? 'Сначала сохраните сегодняшний вес, затем вернитесь к этому шагу.'
        : code === 'weight_outside_corridor' ? 'Сегодняшний вес вне вашего коридора. Пока продолжайте фиксацию и наблюдение.'
        : 'Не удалось сохранить изменения. Повторите попытку.');
    } finally { inFlight.current = false; setBusy(false); }
  };
  return <section className="inga-card space-y-4 text-base leading-relaxed" aria-busy={busy}>
    <h2 className="text-xl font-semibold">Фиксация веса</h2>
    {!goalChanged && equilibrium !== null && <p>Ваша расчётная равновесная калорийность — примерно <strong>{equilibrium} ккал в день</strong>.</p>}
    <p>Без веса порций и данных о калорийности, белках, жирах и углеводах на 100 г продукта приложение оценивает калорийность питания приблизительно.</p>
    <button type="button" className="underline" onClick={onLesson}>Фиксация результата</button>
    <h3 className="font-semibold">Вес за последние 7 дней</h3>
    {weights.length ? <ul className="space-y-1">{weights.map(w => <li key={w.date}>{w.date.split('-').reverse().join('.')} — {w.weight.toLocaleString('ru-RU')} кг</li>)}</ul>
      : <p>За последние 7 дней пока нет сохранённых измерений.</p>}
    {goal && <p>Ваш безопасный коридор веса: {(goal - 1).toLocaleString('ru-RU')}–{(goal + 1).toLocaleString('ru-RU')} кг.</p>}
    {!goalChanged && <>
      <p>Вы вышли на питание для поддержания веса, и вес остаётся в вашем безопасном коридоре? Можно переходить к сохранению результата.</p>
      <p>Решение о переходе на этап сохранения веса принимаете вы. Для перехода нажмите кнопку «Перейти к сохранению веса».</p>
      {!canComplete && <p>Для перехода нужен сохранённый сегодняшний вес в вашем коридоре. Если измерений недостаточно, продолжайте наблюдение.</p>}
    </>}
    <button type="button" className="inga-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={busy || (goalChanged ? !latest || !goal || latest.weight > goal : !canComplete)} onClick={run}>
      {goalChanged ? 'Перейти к фиксации веса' : 'Перейти к сохранению веса'}
    </button>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}
