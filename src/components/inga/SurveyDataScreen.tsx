import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { AppStep } from '@/lib/types';

export function SurveyDataScreen() {
  const { updateProfile, setStep } = useApp();
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [steps, setSteps] = useState('');

  const canProceed = age && height && weight && steps;

  const handleNext = () => {
    updateProfile({
      gender,
      age: parseInt(age),
      height: parseInt(height),
      weight: parseFloat(weight),
      stepsPerDay: parseInt(steps),
    });
    setStep('survey-reasons');
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-2">Введи свои данные</h2>
      <p className="text-muted-foreground mb-8">Это поможет мне рассчитать твои показатели</p>

      <div className="w-full max-w-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Пол</label>
          <div className="flex gap-3">
            <button
              onClick={() => setGender('female')}
              className={gender === 'female' ? 'inga-chip-active flex-1' : 'inga-chip-inactive flex-1'}
            >
              👩 Женщина
            </button>
            <button
              onClick={() => setGender('male')}
              className={gender === 'male' ? 'inga-chip-active flex-1' : 'inga-chip-inactive flex-1'}
            >
              👨 Мужчина
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Возраст (лет)</label>
          <input
            type="number"
            value={age}
            onChange={e => setAge(e.target.value)}
            className="inga-input"
            placeholder="30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Рост (см)</label>
          <input
            type="number"
            value={height}
            onChange={e => setHeight(e.target.value)}
            className="inga-input"
            placeholder="165"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Вес (кг)</label>
          <input
            type="number"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            className="inga-input"
            placeholder="70"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Шаги в день (в среднем)</label>
          <input
            type="number"
            value={steps}
            onChange={e => setSteps(e.target.value)}
            className="inga-input"
            placeholder="5000"
          />
        </div>

        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="inga-btn-primary w-full mt-4 disabled:opacity-40"
        >
          Далее →
        </button>
      </div>
    </div>
  );
}
