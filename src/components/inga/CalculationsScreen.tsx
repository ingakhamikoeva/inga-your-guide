import { useApp } from '@/context/AppContext';
import { useEffect, useState } from 'react';
import { AppStep } from '@/lib/types';
import { withName, hasName } from '@/lib/user-name';

export function CalculationsScreen() {
  const { profile, runCalculations, setStep } = useApp();
  const [calc, setCalc] = useState<ReturnType<typeof runCalculations> | null>(null);

  useEffect(() => {
    const c = runCalculations();
    setCalc(c);
  }, []);

  if (!calc) return null;

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-2">Ваши результаты</h2>
      <p className="text-muted-foreground text-center mb-6 max-w-sm text-sm">
        {hasName(profile.name)
          ? withName(profile.name, 'я записала ваши данные. Сейчас рассчитаю вашу равновесную калорийность.')
          : 'Я записала ваши данные. Сейчас рассчитаю вашу равновесную калорийность.'}
      </p>

      <div className="w-full max-w-sm space-y-4">
        <div className="inga-card">
          <div className="text-sm text-muted-foreground">Индекс массы тела (ИМТ)</div>
          <div className="text-3xl font-bold text-primary">{calc.bmi}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {calc.bmi < 18.5 ? 'Ниже нормы' : calc.bmi <= 24.9 ? 'Норма' : calc.bmi <= 29.9 ? 'Избыточный вес' : 'Ожирение'}
          </div>
        </div>

        <div className="inga-card">
          <div className="text-sm text-muted-foreground">Основной обмен (BMR)</div>
          <div className="text-2xl font-bold">{calc.bmr} <span className="text-base font-normal text-muted-foreground">ккал</span></div>
        </div>

        <div className="inga-card">
          <div className="text-sm text-muted-foreground">Равновесная калорийность</div>
          <div className="text-2xl font-bold text-primary">{calc.totalCalories} <span className="text-base font-normal text-muted-foreground">ккал</span></div>
        </div>

        <div className="inga-card">
          <div className="text-sm text-muted-foreground">Идеальный вес</div>
          <div className="text-xl font-bold">{calc.idealWeight} кг</div>
          <div className="text-sm text-muted-foreground mt-1">
            Верхняя граница нормы: {calc.maxHealthyWeight} кг
          </div>
        </div>
      </div>

      <button onClick={() => setStep('goal-weight' as AppStep)} className="inga-btn-primary w-full max-w-sm mt-8">
        Далее →
      </button>
    </div>
  );
}
