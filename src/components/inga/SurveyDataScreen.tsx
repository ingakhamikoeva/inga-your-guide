import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Slider } from '@/components/ui/slider';
import ingaPhoto from '@/assets/inga-photo.jpg';

export function SurveyDataScreen() {
  const { profile, updateProfile, setStep } = useApp();
  const sex: 'female' | 'male' = (profile as any).sex || profile.gender || 'female';

  const [age, setAge] = useState<string>(profile.age ? String(profile.age) : '');
  const [height, setHeight] = useState<string>(profile.height ? String(profile.height) : '');
  const [weight, setWeight] = useState<string>(profile.weight ? String(profile.weight) : '');
  const [steps, setSteps] = useState<number>(profile.stepsPerDay ?? 5000);

  const ageN = parseInt(age) || 0;
  const heightN = parseInt(height) || 0;
  const weightN = parseFloat(weight) || 0;

  const stepCalories = useMemo(() => {
    return Math.round(steps * (sex === 'male' ? 0.04 : 0.02));
  }, [steps, sex]);

  const { tdee, deficit } = useMemo(() => {
    if (!ageN || !heightN || !weightN) return { tdee: 0, deficit: 0 };
    const bmr = sex === 'female'
      ? 655.1 + 9.563 * weightN + 1.85 * heightN - 4.676 * ageN
      : 66.5 + 13.75 * weightN + 5.003 * heightN - 6.775 * ageN;
    const t = Math.round(bmr + stepCalories);
    return { tdee: t, deficit: Math.round(t * 0.75) };
  }, [ageN, heightN, weightN, stepCalories, sex]);

  const canProceed = ageN > 0 && heightN > 0 && weightN > 0;

  const handleNext = () => {
    updateProfile({
      age: ageN,
      height: heightN,
      weight: weightN,
      stepsPerDay: steps,
      gender: sex,
      ...({ calorie_target: deficit } as any),
    });
    setStep('tracking-method');
  };

  const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/,/g, ' ');

  return (
    <div className="flex flex-col min-h-screen px-6 py-6 animate-fade-in-up" style={{ background: '#FAF5F0' }}>
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
          Расскажи о себе — рассчитаю твою личную норму калорий.
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
            ТВОЙ РАСЧЁТ
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

        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="inga-btn-primary w-full mt-6 disabled:opacity-40"
        >
          Рассчитать →
        </button>
      </div>
    </div>
  );
}
