import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Slider } from '@/components/ui/slider';
import ingaPhoto from '@/assets/inga-photo.jpg';
import { roundTo50, checkGoalBmi, goalWeightWarning } from '@/lib/calculations';

export function SurveyDataScreen() {
  const { profile, updateProfile, setStep } = useApp();
  const sex = profile.gender === 'female' || profile.gender === 'male' ? profile.gender : null;

  const [age, setAge] = useState<string>(profile.age ? String(profile.age) : '');
  const [height, setHeight] = useState<string>(profile.height ? String(profile.height) : '');
  const [weight, setWeight] = useState<string>(profile.weight ? String(profile.weight) : '');
  const [steps, setSteps] = useState<number>(profile.stepsPerDay ?? 5000);
  const [goalDraft, setGoalDraft] = useState<string | null>(null);
  const [showGoalError, setShowGoalError] = useState(false);

  const ageN = parseInt(age) || 0;
  const heightN = parseInt(height) || 0;
  const weightN = parseFloat(weight) || 0;

  const stepCalories = useMemo(() => {
    return Math.round(steps * (sex === 'male' ? 0.04 : 0.02));
  }, [steps, sex]);

  const { tdee, deficit } = useMemo(() => {
    if (!sex || !ageN || !heightN || !weightN) return { tdee: 0, deficit: 0 };
    const bmr = sex === 'female'
      ? 655.1 + 9.563 * weightN + 1.85 * heightN - 4.676 * ageN
      : 66.5 + 13.75 * weightN + 5.003 * heightN - 6.775 * ageN;
    const t = Math.round(bmr + stepCalories);
    return { tdee: roundTo50(t), deficit: roundTo50(t * 0.75) };
  }, [ageN, heightN, weightN, stepCalories, sex]);

  const canProceed = sex !== null && [ageN, heightN, weightN].every(n => Number.isFinite(n) && n > 0);
  const requestedGoal = goalDraft === null
    ? Math.round((weightN - (profile.kgToLose ?? 5)) * 10) / 10
    : Number(goalDraft);
  const goalIsUnsafe = canProceed && checkGoalBmi(requestedGoal, heightN).isUnsafe;

  const handleNext = () => {
    if (!canProceed || sex === null) return;
    if (goalIsUnsafe) { setShowGoalError(true); return; }
    const enteredWeight = weightN;

    updateProfile({
      age: ageN,
      height: heightN,
      weight: enteredWeight,
      current_weight_kg: enteredWeight,
      goal_weight_kg: requestedGoal,
      goalWeight: requestedGoal,
      kgToLose: Math.round((enteredWeight - requestedGoal) * 10) / 10,
      stepsPerDay: steps,
      gender: sex,
      ...({ calorie_target: deficit } as any),
    });
    setStep('tracking-method');
  };

  const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/,/g, ' ');

  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    if (sex === null) setStep('survey-name');
  }, [sex, setStep]);

  if (sex === null) return null;

  return (
    <div className="flex flex-col min-h-screen px-6 py-6 animate-fade-in-up" style={{ background: '#FAF5F0', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
      {/* Progress bar with back button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setStep('why')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
          style={{ background: '#F4EEE8', color: '#3B2A20' }}
          aria-label="Назад"
        >
          ←
        </button>
        <div className="flex gap-1.5 flex-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full"
              style={{ background: i < 4 ? '#FF6200' : '#E8E2DC' }}
            />
          ))}
        </div>
      </div>

      {/* Inga greeting */}
      <div className="flex items-start gap-3 mb-6">
        <img
          src={ingaPhoto}
          alt="Инга"
          className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          style={{ border: '2px solid #FF6200' }}
        />
        <div
          className="px-4 py-3 text-sm"
          style={{
            background: '#F4EEE8',
            color: '#3B2A20',
            borderRadius: '12px',
            borderBottomLeftRadius: '3px',
          }}
        >
          Расскажите о себе — рассчитаю вашу личную норму калорий.
        </div>
      </div>

      <div className="w-full space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#3B2A20' }}>Возраст (лет)</label>
          <input type="number" value={age} onChange={e => setAge(e.target.value)} className="inga-input" placeholder="30" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#3B2A20' }}>Рост (см)</label>
          <input type="number" value={height} onChange={e => setHeight(e.target.value)} className="inga-input" placeholder="165" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#3B2A20' }}>Текущий вес (кг)</label>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="inga-input" placeholder="70" />
        </div>

        <div className="pt-2">
          <div className="flex justify-between items-baseline mb-2 text-sm" style={{ color: '#3B2A20' }}>
            <span>Шагов в день</span>
            <span className="font-semibold">{fmt(steps)} (+{stepCalories} ккал)</span>
          </div>
          <Slider
            value={[steps]}
            onValueChange={v => setSteps(v[0])}
            min={0}
            max={20000}
            step={500}
          />
        </div>

        {/* Calculation card */}
        <div
          className="mt-6 rounded-xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #F0E6DC' }}
        >
          <div
            className="px-4 py-2 text-xs font-bold tracking-wider"
            style={{ background: '#FF6200', color: '#FFFFFF' }}
          >
            ВАШ РАСЧЁТ
          </div>
          <div className="px-4 py-3 flex justify-between items-center text-sm" style={{ color: '#3B2A20' }}>
            <span>Суточная норма</span>
            <span className="font-bold">{tdee ? `${fmt(tdee)} ккал` : '—'}</span>
          </div>
          <div className="px-4 py-3 flex justify-between items-center text-sm border-t" style={{ color: '#3B2A20', borderColor: '#F0E6DC' }}>
            <span>Для снижения веса</span>
            <span className="font-bold" style={{ color: '#FF6200' }}>{deficit ? `${fmt(deficit)} ккал` : '—'}</span>
          </div>
        </div>

        {showGoalError && goalIsUnsafe && (
          <div className="inga-bubble" role="alert">
            <p>{goalWeightWarning(heightN)}</p>
            {goalDraft === null && (
              <button
                type="button"
                onClick={() => setGoalDraft(String(requestedGoal))}
                className="inga-btn-secondary w-full mt-3"
              >
                Изменить цель
              </button>
            )}
          </div>
        )}
        {goalDraft !== null && (
          <div>
            <label htmlFor="survey-goal-weight" className="block text-sm font-medium mb-1" style={{ color: '#3B2A20' }}>Цель</label>
            <div className="flex items-center gap-2">
              <input id="survey-goal-weight" type="number" step="0.1" autoFocus value={goalDraft} onChange={e => setGoalDraft(e.target.value)} className="inga-input" />
              <span>кг</span>
            </div>
          </div>
        )}
        <button
          onClick={handleNext}
          className="inga-btn-primary w-full mt-6"
        >
          Дальше →
        </button>
      </div>
    </div>
  );
}
