import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { AppStep } from '@/lib/types';
import { checkGoalBmi } from '@/lib/calculations';

export function GoalWeightScreen() {
  const { profile, updateProfile, setStep } = useApp();
  const [goalWeight, setGoalWeight] = useState('');
  const [message, setMessage] = useState('');
  const [safeWeight, setSafeWeight] = useState<number | null>(null);
  const [comfortableWeight, setComfortableWeight] = useState<number | null>(null);
  const [status, setStatus] = useState<'unsafe' | 'borderline' | 'ready' | null>(null);

  const resetCheck = () => {
    setMessage('');
    setSafeWeight(null);
    setComfortableWeight(null);
    setStatus(null);
  };

  const handleCheck = () => {
    const gw = parseFloat(goalWeight);
    if (!gw || !profile.height) return;

    const check = checkGoalBmi(gw, profile.height);

    if (check.isUnsafe) {
      setSafeWeight(check.minHealthyWeight);
      setMessage(`Такой вес будет ниже безопасной нормы для твоего роста. Нижняя граница здорового веса для тебя — ${check.minHealthyWeight} кг. Давай выберем цель, с которой ты будешь чувствовать себя хорошо и устойчиво.`);
      setStatus('unsafe');
    } else if (check.isBorderlineLow) {
      setComfortableWeight(check.comfortableWeight);
      setMessage(`Это очень низкий вес для твоего роста. Он находится на нижней границе нормы, и удерживать его может быть сложно. Обычно комфортнее чувствуется диапазон немного выше. Если хочешь, можно начать с более устойчивой цели — например, ${check.comfortableWeight} кг, а дальше двигаться постепенно.`);
      setStatus('borderline');
    } else if (check.isHealthy) {
      setMessage('Отличная цель. Всё получится, я рядом 💛');
      updateProfile({ goalWeight: gw });
      setStatus('ready');
    } else {
      setMessage('Это хорошая промежуточная цель. Можно двигаться поэтапно — так спокойнее и устойчивее.');
      updateProfile({ goalWeight: gw });
      setStatus('ready');
    }
  };

  const chooseSafeGoal = () => {
    if (!safeWeight) return;
    updateProfile({ goalWeight: safeWeight });
    setGoalWeight(String(safeWeight));
    setStatus('ready');
    setMessage('Хорошо, берём эту цель как более устойчивую отправную точку.');
  };

  const chooseComfortableGoal = () => {
    if (!comfortableWeight) return;
    updateProfile({ goalWeight: comfortableWeight });
    setGoalWeight(String(comfortableWeight));
    setStatus('ready');
    setMessage('Отлично, начнём с более комфортной цели и дальше будем двигаться постепенно.');
  };

  const keepBorderlineGoal = () => {
    const gw = parseFloat(goalWeight);
    if (!gw) return;
    updateProfile({ goalWeight: gw });
    setStatus('ready');
    setMessage('Хорошо, оставляем эту цель и будем следить, чтобы путь к ней был устойчивым.');
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-2">Какая у тебя цель по весу?</h2>
      <p className="text-muted-foreground mb-6">Введи желаемый вес в кг</p>

      <div className="w-full max-w-sm space-y-4">
        <input
          type="number"
          value={goalWeight}
          onChange={e => { setGoalWeight(e.target.value); resetCheck(); }}
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

        {status === 'unsafe' && (
          <div className="space-y-3">
            <button onClick={chooseSafeGoal} className="inga-btn-primary w-full">
              Поставить безопасную цель
            </button>
            <button onClick={resetCheck} className="inga-btn-secondary w-full">
              Изменить цель
            </button>
          </div>
        )}

        {status === 'borderline' && (
          <div className="space-y-3">
            <button onClick={keepBorderlineGoal} className="inga-btn-primary w-full">
              Оставить эту цель
            </button>
            <button onClick={chooseComfortableGoal} className="inga-btn-secondary w-full">
              Выбрать более комфортную
            </button>
          </div>
        )}

        {status === 'ready' && (
          <button onClick={() => setStep('measurements' as AppStep)} className="inga-btn-primary w-full">
            Далее →
          </button>
        )}
      </div>
    </div>
  );
}
