import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { checkGoalBmi } from '@/lib/calculations';

export function GoalWeightScreen() {
  const { profile, updateProfile, setStep } = useApp();
  const [goalWeight, setGoalWeight] = useState('');
  const [message, setMessage] = useState('');

  const handleCheck = () => {
    const gw = parseFloat(goalWeight);
    if (!gw || !profile.height) return;

    const check = checkGoalBmi(gw, profile.height);

    if (check.isTooLow) {
      setMessage(`Нижняя граница здорового веса для тебя — ${check.minHealthyWeight} кг. Давай пока зафиксируем это число как цель.`);
      updateProfile({ goalWeight: check.minHealthyWeight });
    } else if (check.isHealthy) {
      setMessage('Отличная цель! Всё получится, я рядом 💪');
      updateProfile({ goalWeight: gw });
    } else {
      setMessage('Эта цель в пределах нормы. Давай двигаться к ней вместе!');
      updateProfile({ goalWeight: gw });
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-2">Какая у тебя цель по весу?</h2>
      <p className="text-muted-foreground mb-6">Введи желаемый вес в кг</p>

      <div className="w-full max-w-sm space-y-4">
        <input
          type="number"
          value={goalWeight}
          onChange={e => { setGoalWeight(e.target.value); setMessage(''); }}
          className="inga-input text-center text-2xl"
          placeholder="60"
        />

        {!message && (
          <button
            onClick={handleCheck}
            disabled={!goalWeight}
            className="inga-btn-primary w-full disabled:opacity-40"
          >
            Проверить
          </button>
        )}

        {message && (
          <div className="inga-bubble animate-scale-in">
            <p>{message}</p>
          </div>
        )}

        {message && (
          <button onClick={() => setStep('measurements')} className="inga-btn-primary w-full">
            Далее →
          </button>
        )}
      </div>
    </div>
  );
}
